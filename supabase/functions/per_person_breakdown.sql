-- per_person_breakdown(year, month, include_general) -> setof per_person_row
-- Per spec FR-025: tagged spend + (optionally) income-proportional share of
-- the household's general (untagged) expenses.

create or replace function public.per_person_breakdown(
  p_year            smallint,
  p_month           smallint,
  p_include_general boolean default false
)
returns table(
  member_id              uuid,
  display_name           text,
  role                   text,
  spent_cents            bigint,
  share_of_general_cents bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household       uuid;
  v_start           date;
  v_end             date;
  v_general_total   bigint;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then return; end if;

  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + interval '1 month')::date;

  -- Untagged "general" household expenses (no for_member_id) over the month.
  select coalesce(sum(amount_cents), 0)::bigint into v_general_total
  from public.transaction
  where household_id = v_household
    and type = 'expense'
    and for_member_id is null
    and occurred_on >= v_start and occurred_on < v_end;

  return query
    with members as (
      select id, display_name, role
      from public.household_member
      where household_id = v_household
    ),
    tagged as (
      select for_member_id as member_id, coalesce(sum(amount_cents),0)::bigint as cents
      from public.transaction
      where household_id = v_household
        and type='expense'
        and for_member_id is not null
        and occurred_on >= v_start and occurred_on < v_end
      group by for_member_id
    ),
    ratios as (
      select adult_id, ratio
      from public.compute_income_split(v_household)
    )
    select
      m.id,
      m.display_name,
      m.role,
      coalesce(t.cents, 0)::bigint as spent_cents,
      case
        when p_include_general and m.role = 'adult'
          then coalesce((select (v_general_total * r.ratio)::bigint
                         from ratios r where r.adult_id = m.id), 0)
        else 0::bigint
      end as share_of_general_cents
    from members m
    left join tagged t on t.member_id = m.id
    order by m.role desc, m.display_name;
end;
$$;

revoke all on function public.per_person_breakdown(smallint, smallint, boolean) from public;
grant execute on function public.per_person_breakdown(smallint, smallint, boolean) to authenticated;
