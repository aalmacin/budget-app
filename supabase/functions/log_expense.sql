-- log_expense(payload jsonb) -> uuid
-- Inserts an expense transaction. Honors:
--   - client-supplied UUID v7 for offline-replay idempotency
--   - category default_essential_pct when essential_pct is omitted

create or replace function public.log_expense(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household       uuid;
  v_id              uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_amount          bigint := (p->>'amount_cents')::bigint;
  v_occurred        date := coalesce((p->>'occurred_on')::date, current_date);
  v_category        uuid := (p->>'category_id')::uuid;
  v_notes           text := coalesce(p->>'notes', '');
  v_paid_by         uuid := nullif(p->>'paid_by_member_id', '')::uuid;
  v_for_member      uuid := nullif(p->>'for_member_id', '')::uuid;
  v_essential_pct   smallint;
  v_split_rule      text := nullif(p->>'split_rule', '');
  v_subscription_id uuid := nullif(p->>'subscription_id', '')::uuid;
  v_occurrence_date date := nullif(p->>'occurrence_date', '')::date;
  v_category_household uuid;
  v_category_default smallint;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;

  select household_id, default_essential_pct
    into v_category_household, v_category_default
    from public.category where id = v_category;

  if not found
     or (v_category_household is not null and v_category_household <> v_household) then
    raise exception 'Category not found in this household' using errcode = 'P0001';
  end if;

  v_essential_pct := coalesce((p->>'essential_pct')::smallint, v_category_default);
  if v_essential_pct < 0 or v_essential_pct > 100 then
    raise exception 'essential_pct must be between 0 and 100' using errcode = 'P0001';
  end if;

  -- Idempotent insert: same UUID = no-op.
  insert into public.transaction
    (id, household_id, type, amount_cents, occurred_on, category_id, notes,
     paid_by_member_id, for_member_id, essential_pct, split_rule,
     subscription_id, occurrence_date)
  values
    (v_id, v_household, 'expense', v_amount, v_occurred, v_category, v_notes,
     v_paid_by, v_for_member, v_essential_pct, v_split_rule,
     v_subscription_id, v_occurrence_date)
  on conflict (id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.log_expense(jsonb) from public;
grant execute on function public.log_expense(jsonb) to authenticated;
