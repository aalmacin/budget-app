-- apply_split_rule(transaction_id uuid) -> (adult_id, owed_cents)
-- See data-model.md §8 + spec clarification §3. Invariant:
--   sum(owed_cents) = transaction.amount_cents
-- Floor + residual-to-higher-earner; ties broken by display_order asc.

create or replace function public.apply_split_rule(p_transaction_id uuid)
returns table(adult_id uuid, owed_cents bigint)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_amount    bigint;
  v_household uuid;
  v_rule      text;
  v_payer     uuid;
begin
  select amount_cents, household_id, split_rule, paid_by_member_id
    into v_amount, v_household, v_rule, v_payer
    from public.transaction where id = p_transaction_id;

  if v_amount is null then
    return;
  end if;

  -- Unsplit transaction: the payer (or fallback "Adult A") owes the full amount.
  if v_rule is null then
    return query
      select coalesce(v_payer, (
        select adult_id from public.compute_income_split(v_household)
        order by display_order limit 1
      )), v_amount;
    return;
  end if;

  -- Single-adult split (adult_a / adult_b / 50_50 / by_income): allocate per rule.
  if v_rule in ('adult_a','adult_b','50_50') then
    return query
      with adults as (
        select adult_id, display_order
        from public.compute_income_split(v_household)
      ),
      ranked as (
        select adult_id, display_order,
               case
                 when v_rule = 'adult_a' and display_order = 1 then v_amount
                 when v_rule = 'adult_b' and display_order = 2 then v_amount
                 when v_rule = '50_50' then (v_amount / 2)
                 else 0
               end as base
        from adults
      ),
      with_residual as (
        select adult_id, display_order, base,
               case
                 when v_rule = '50_50'
                      and display_order = 1
                      and (v_amount % 2) = 1
                 then base + 1
                 else base
               end as owed
        from ranked
      )
      select adult_id, owed::bigint
      from with_residual
      order by display_order;
    return;
  end if;

  -- by_income: floor each share, then assign residual to the highest-earning
  -- adult (ties broken by display_order asc).
  return query
    with split as (
      select adult_id, ratio, display_order,
             (select monthly_income_cents from public.household_member m where m.id = cis.adult_id) as income
      from public.compute_income_split(v_household) cis
    ),
    floored as (
      select adult_id, ratio, display_order, income,
             floor(v_amount * ratio)::bigint as base
      from split
    ),
    totals as (
      select sum(base) as base_sum from floored
    ),
    ranked as (
      select adult_id, base, income, display_order,
             row_number() over (order by income desc, display_order asc) as winner_rank
      from floored
    )
    select adult_id,
           case when winner_rank = 1
                then base + (v_amount - (select base_sum from totals))
                else base end as owed_cents
    from ranked
    order by display_order;
end;
$$;

revoke all on function public.apply_split_rule(uuid) from public;
grant execute on function public.apply_split_rule(uuid) to authenticated;
