-- list_overlapping_subscriptions() -> setof overlap_callout
-- Heuristic: 2+ active subs in same category. Returns monthly-equivalent total
-- so the UI can render the "review to save $X/mo" callout.

create or replace function public.list_overlapping_subscriptions()
returns table(
  category_name        text,
  count                int,
  monthly_total_cents  bigint,
  subscription_ids     uuid[]
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then return; end if;

  return query
    select
      c.name,
      count(*)::int,
      sum(
        s.amount_cents * case s.cadence
          when 'weekly'    then 52.0 / 12
          when 'biweekly'  then 26.0 / 12
          when 'monthly'   then 1
          when 'quarterly' then 1.0 / 3
          when 'yearly'    then 1.0 / 12
          else 1
        end
      )::bigint,
      array_agg(s.id)
    from public.subscription s
    join public.category c on c.id = s.category_id
    where s.household_id = v_household and s.active = true
    group by c.name
    having count(*) >= 2
    order by sum(s.amount_cents) desc;
end;
$$;

revoke all on function public.list_overlapping_subscriptions() from public;
grant execute on function public.list_overlapping_subscriptions() to authenticated;
