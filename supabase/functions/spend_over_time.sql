-- spend_over_time(range text) -> setof spend_over_time_row
-- 7d/30d -> day buckets; 90d/mtd -> week buckets; 365d/ytd -> month buckets.

create or replace function public.spend_over_time(p_range text default '30d')
returns table(bucket_start date, spent_cents bigint, income_cents bigint)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_from      date;
  v_bucket    text;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then return; end if;

  case p_range
    when '7d'   then v_from := current_date - 7;   v_bucket := 'day';
    when '30d'  then v_from := current_date - 30;  v_bucket := 'day';
    when '90d'  then v_from := current_date - 90;  v_bucket := 'week';
    when 'mtd'  then v_from := date_trunc('month', current_date)::date; v_bucket := 'week';
    when '365d' then v_from := current_date - 365; v_bucket := 'month';
    when 'ytd'  then v_from := date_trunc('year', current_date)::date;  v_bucket := 'month';
    else             v_from := current_date - 30;  v_bucket := 'day';
  end case;

  return query
    select
      date_trunc(v_bucket, t.occurred_on)::date as bucket_start,
      coalesce(sum(case when type='expense' then amount_cents else 0 end), 0)::bigint as spent_cents,
      coalesce(sum(case when type='income'  then amount_cents else 0 end), 0)::bigint as income_cents
    from public.transaction t
    where t.household_id = v_household
      and t.occurred_on >= v_from
    group by 1
    order by 1;
end;
$$;

revoke all on function public.spend_over_time(text) from public;
grant execute on function public.spend_over_time(text) to authenticated;
