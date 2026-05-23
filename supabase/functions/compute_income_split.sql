-- compute_income_split(household_id uuid) -> (adult_id, ratio, display_order)
-- See data-model.md §7. Re-derives ratios on every read. Active adults only.
-- Zero-income fallback: equal split.

create or replace function public.compute_income_split(p_household_id uuid)
returns table(adult_id uuid, ratio numeric(10,8), display_order int)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with adults as (
    select id, monthly_income_cents,
           row_number() over (order by created_at, id) as display_order
    from public.household_member
    where household_id = p_household_id
      and role = 'adult'
      and deleted_at is null
  ),
  total as (select sum(monthly_income_cents) as t from adults)
  select
    a.id,
    case
      when (select t from total) = 0
        then (1.0 / nullif((select count(*) from adults), 0))::numeric(10,8)
      else (a.monthly_income_cents::numeric / (select t from total))::numeric(10,8)
    end as ratio,
    a.display_order
  from adults a;
$$;

revoke all on function public.compute_income_split(uuid) from public;
grant execute on function public.compute_income_split(uuid) to authenticated;
