-- get_dashboard_summary(year int, month int) -> jsonb
-- Returns the rolled-up figures the dashboard needs in one round-trip:
--   balance_cents                  (lifetime income − lifetime expense, household-wide)
--   left_to_spend_this_month_cents (total category budgets − month's expense)
--   essential_spent_cents          (sum(expense.amount * essential_pct / 100) for month)
--   treats_spent_cents             (sum(expense.amount * (100-essential_pct) / 100) for month)
--   income_month_cents             (sum(income.amount) for month)
--   recent                         (10 most recent transactions, from transaction_view)

create or replace function public.get_dashboard_summary(p_year int, p_month int)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household       uuid;
  v_month_start     date;
  v_month_end       date;
  v_balance         bigint;
  v_essential       bigint;
  v_treats          bigint;
  v_income          bigint;
  v_total_budget    bigint;
  v_month_expense   bigint;
  v_recent          jsonb;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    return jsonb_build_object();
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + interval '1 month')::date;

  -- Lifetime balance (income - expense).
  select
    coalesce(sum(case when type='income'  then amount_cents else 0 end), 0)
    - coalesce(sum(case when type='expense' then amount_cents else 0 end), 0)
  into v_balance
  from public.transaction
  where household_id = v_household;

  -- This-month essential / treats / income.
  select
    coalesce(sum(case when type='expense'
                       then (amount_cents * essential_pct / 100)
                       else 0 end), 0),
    coalesce(sum(case when type='expense'
                       then (amount_cents * (100 - essential_pct) / 100)
                       else 0 end), 0),
    coalesce(sum(case when type='income' then amount_cents else 0 end), 0),
    coalesce(sum(case when type='expense' then amount_cents else 0 end), 0)
  into v_essential, v_treats, v_income, v_month_expense
  from public.transaction
  where household_id = v_household
    and occurred_on >= v_month_start
    and occurred_on <  v_month_end;

  -- Sum of all (overridden) category budgets for the household.
  select coalesce(sum(monthly_budget_cents), 0)
  into v_total_budget
  from public.category
  where (household_id = v_household
         or (household_id is null
             and not exists (
               select 1 from public.category h
               where h.household_id = v_household and h.name = public.category.name
             )))
    and monthly_budget_cents is not null;

  -- 10 most recent transactions as a JSON array.
  select coalesce(jsonb_agg(row_to_json(r)), '[]'::jsonb)
  into v_recent
  from (
    select *
    from public.transaction_view
    where household_id = v_household
    order by occurred_on desc, created_at desc
    limit 10
  ) r;

  return jsonb_build_object(
    'balance_cents',                  v_balance,
    'left_to_spend_this_month_cents', greatest(v_total_budget - v_month_expense, 0),
    'essential_spent_cents',          v_essential,
    'treats_spent_cents',             v_treats,
    'income_month_cents',             v_income,
    'month_expense_cents',            v_month_expense,
    'recent',                         v_recent
  );
end;
$$;

revoke all on function public.get_dashboard_summary(int, int) from public;
grant execute on function public.get_dashboard_summary(int, int) to authenticated;
