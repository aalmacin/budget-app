-- list_quick_add_options(p_limit int default 12) -> setof quick_add_option
-- Returns a mixed list of unique-merchant recent expenses (last 60 days)
-- and active subscriptions due within 30 days. Filters out options whose
-- for_member_id references a soft-deleted member (spec clarification §1).
--
-- Depends on `subscription` table from 0004_subscriptions.sql. The body-check
-- is deferred so this file can be applied (or replayed) on a database where
-- 0004 hasn't been applied yet — the function will simply error at call time
-- if the table is missing. The dev workflow is: apply 0001-0004 first, then
-- run every file in supabase/functions/.

set local check_function_bodies = off;

create or replace function public.list_quick_add_options(p_limit int default 12)
returns table(
  source              text,
  source_id           uuid,
  merchant            text,
  amount_cents        bigint,
  category_id         uuid,
  category_name       text,
  for_member_id       uuid,
  paid_by_member_id   uuid,
  essential_pct       smallint,
  split_rule          text,
  last_occurred       date
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_recent_cap int := greatest(1, (p_limit * 7) / 10);  -- ~70% of limit
  v_sub_cap    int := greatest(1, p_limit - v_recent_cap);
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    return;
  end if;

  -- Recent: distinct merchant (notes) per latest expense in last 60 days.
  return query
    with ranked as (
      select
        t.id, t.notes as merchant, t.amount_cents, t.category_id, c.name as category_name,
        t.for_member_id, t.paid_by_member_id, t.essential_pct, t.split_rule, t.occurred_on,
        row_number() over (
          partition by lower(coalesce(nullif(t.notes,''), c.name))
          order by t.occurred_on desc, t.created_at desc
        ) as rn
      from public.transaction t
      join public.category c on c.id = t.category_id
      where t.household_id = v_household
        and t.type = 'expense'
        and t.occurred_on >= current_date - interval '60 days'
        and (t.for_member_id is null
             or exists (
               select 1 from public.household_member m
               where m.id = t.for_member_id and m.deleted_at is null
             ))
    )
    select
      'recent'::text,
      r.id,
      coalesce(nullif(r.merchant,''), r.category_name),
      r.amount_cents,
      r.category_id,
      r.category_name,
      r.for_member_id,
      r.paid_by_member_id,
      r.essential_pct,
      r.split_rule,
      r.occurred_on
    from ranked r
    where r.rn = 1
    order by r.occurred_on desc
    limit v_recent_cap;

  -- Subscriptions: active + renewing within 30 days, member-soft-delete filtered.
  return query
    select
      'subscription'::text,
      s.id,
      s.merchant,
      s.amount_cents,
      s.category_id,
      c.name,
      s.for_member_id,
      s.paid_by_member_id,
      s.essential_pct,
      s.split_rule,
      s.next_renewal_at
    from public.subscription s
    join public.category c on c.id = s.category_id
    where s.household_id = v_household
      and s.active = true
      and s.next_renewal_at <= current_date + interval '30 days'
      and (s.for_member_id is null
           or exists (
             select 1 from public.household_member m
             where m.id = s.for_member_id and m.deleted_at is null
           ))
    order by s.next_renewal_at asc
    limit v_sub_cap;
end;
$$;

revoke all on function public.list_quick_add_options(int) from public;
grant execute on function public.list_quick_add_options(int) to authenticated;

set local check_function_bodies = on;
