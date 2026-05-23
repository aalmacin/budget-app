-- cashflow_kpis(range text) -> jsonb
-- Aggregates per the contracts/reports.md shape.

create or replace function public.cashflow_kpis(p_range text default '30d')
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household   uuid;
  v_from        date;
  v_income      bigint;
  v_expense     bigint;
  v_avg_daily   bigint;
  v_largest     jsonb;
  v_top_cat     jsonb;
  v_insights    text[];
  v_days        int;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then
    return '{}'::jsonb;
  end if;

  case p_range
    when '7d'   then v_from := current_date - 7;
    when '30d'  then v_from := current_date - 30;
    when '90d'  then v_from := current_date - 90;
    when 'mtd'  then v_from := date_trunc('month', current_date)::date;
    when '365d' then v_from := current_date - 365;
    when 'ytd'  then v_from := date_trunc('year', current_date)::date;
    else             v_from := current_date - 30;
  end case;
  v_days := greatest(1, (current_date - v_from));

  select
    coalesce(sum(case when type='income'  then amount_cents else 0 end), 0)::bigint,
    coalesce(sum(case when type='expense' then amount_cents else 0 end), 0)::bigint
  into v_income, v_expense
  from public.transaction
  where household_id = v_household and occurred_on >= v_from;

  v_avg_daily := (v_expense / v_days)::bigint;

  select to_jsonb(r) into v_largest
  from (
    select id, notes as merchant, amount_cents, occurred_on
    from public.transaction
    where household_id = v_household and type='expense' and occurred_on >= v_from
    order by amount_cents desc
    limit 1
  ) r;

  select to_jsonb(r) into v_top_cat
  from (
    select c.id as category_id, c.name, coalesce(sum(t.amount_cents),0)::bigint as spent_cents
    from public.transaction t
    join public.category c on c.id = t.category_id
    where t.household_id = v_household and t.type='expense' and t.occurred_on >= v_from
    group by c.id, c.name
    order by sum(t.amount_cents) desc
    limit 1
  ) r;

  v_insights := array[]::text[];
  if v_income > 0 and v_expense > 0 then
    v_insights := v_insights ||
      format('Net %s this period.',
             to_char((v_income - v_expense) / 100.0, 'FM$999,990.00'));
  end if;
  if v_top_cat is not null then
    v_insights := v_insights ||
      format('Top category: %s (%s).',
             v_top_cat->>'name',
             to_char((v_top_cat->>'spent_cents')::bigint / 100.0, 'FM$999,990.00'));
  end if;

  return jsonb_build_object(
    'income_cents',          v_income,
    'expense_cents',         v_expense,
    'net_cents',             v_income - v_expense,
    'avg_daily_spend_cents', v_avg_daily,
    'largest_expense',       v_largest,
    'top_category',          v_top_cat,
    'insights',              to_jsonb(v_insights)
  );
end;
$$;

revoke all on function public.cashflow_kpis(text) from public;
grant execute on function public.cashflow_kpis(text) to authenticated;
