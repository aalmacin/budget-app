-- get_budget_progress(year int, month int, filter text default 'all') -> jsonb[]
-- Per-category progress: limit, spent, essential portion, treats portion.
-- `filter` ∈ {all,essential,treats} restricts the "spent" calculation.
-- Returns one row per visible category (per-household override prefered over
-- system-global with same name).

create or replace function public.get_budget_progress(
  p_year   int,
  p_month  int,
  p_filter text default 'all'
)
returns table(
  category_id            uuid,
  category_name          text,
  monthly_budget_cents   bigint,
  spent_cents            bigint,
  essential_spent_cents  bigint,
  treats_spent_cents     bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household   uuid;
  v_month_start date;
  v_month_end   date;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    return;
  end if;

  if p_filter not in ('all','essential','treats') then
    p_filter := 'all';
  end if;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + interval '1 month')::date;

  return query
    with visible_categories as (
      -- per-household override takes precedence over system-global of same name
      select distinct on (lower(c.name))
        c.id, c.name, c.monthly_budget_cents
      from public.category c
      where (c.household_id = v_household or c.household_id is null)
        and c.kind = 'expense'
      order by lower(c.name), c.household_id nulls last
    ),
    sums as (
      select
        t.category_id,
        sum(t.amount_cents) as spent,
        sum(t.amount_cents * t.essential_pct / 100) as essential,
        sum(t.amount_cents * (100 - t.essential_pct) / 100) as treats
      from public.transaction t
      where t.household_id = v_household
        and t.type = 'expense'
        and t.occurred_on >= v_month_start
        and t.occurred_on <  v_month_end
      group by t.category_id
    )
    select
      vc.id,
      vc.name,
      vc.monthly_budget_cents,
      case p_filter
        when 'essential' then coalesce(s.essential, 0)::bigint
        when 'treats'    then coalesce(s.treats, 0)::bigint
        else                  coalesce(s.spent, 0)::bigint
      end as spent_cents,
      coalesce(s.essential, 0)::bigint,
      coalesce(s.treats, 0)::bigint
    from visible_categories vc
    left join sums s on s.category_id = vc.id
    order by vc.name;
end;
$$;

revoke all on function public.get_budget_progress(int, int, text) from public;
grant execute on function public.get_budget_progress(int, int, text) to authenticated;
