-- materialize_due_subscriptions() -> int
-- Cron-driven. For each active subscription with next_renewal_at <= current_date:
--   1. INSERT a transaction tagged with subscription_id + occurrence_date
--      (unique idempotency index on (subscription_id, occurrence_date) makes
--      retries safe).
--   2. Advance next_renewal_at by the cadence.
-- Returns count of transactions inserted.

create or replace function public.materialize_due_subscriptions()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count    int := 0;
  v_sub      public.subscription%rowtype;
  v_interval interval;
begin
  for v_sub in
    select * from public.subscription
    where active = true and next_renewal_at <= current_date
  loop
    case v_sub.cadence
      when 'weekly'    then v_interval := interval '7 days';
      when 'biweekly'  then v_interval := interval '14 days';
      when 'monthly'   then v_interval := interval '1 month';
      when 'quarterly' then v_interval := interval '3 months';
      when 'yearly'    then v_interval := interval '1 year';
      else                  v_interval := interval '1 month';
    end case;

    -- Idempotent insert. ON CONFLICT skips if (subscription_id, occurrence_date)
    -- already exists (e.g., overlapping cron run).
    insert into public.transaction
      (id, household_id, type, amount_cents, occurred_on, category_id, notes,
       paid_by_member_id, for_member_id, essential_pct, split_rule,
       subscription_id, occurrence_date)
    values
      (gen_random_uuid(),
       v_sub.household_id, 'expense', v_sub.amount_cents, v_sub.next_renewal_at,
       v_sub.category_id, v_sub.merchant,
       v_sub.paid_by_member_id, v_sub.for_member_id, v_sub.essential_pct,
       v_sub.split_rule, v_sub.id, v_sub.next_renewal_at)
    on conflict (subscription_id, occurrence_date)
      where subscription_id is not null and occurrence_date is not null
      do nothing;

    if found then v_count := v_count + 1; end if;

    update public.subscription
       set next_renewal_at = (v_sub.next_renewal_at + v_interval)::date
     where id = v_sub.id;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.materialize_due_subscriptions() from public;
-- Granted to postgres role only — runs from pg_cron under its service identity.
