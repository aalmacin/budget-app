-- log_income(payload jsonb) -> uuid
-- amount_cents is the NET (post-tax) amount the user received. v1 does NOT
-- trigger any GST/HST set-aside or withholding (spec clarification §6).
-- income_source is descriptive metadata only (spec clarification §9).

create or replace function public.log_income(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_id        uuid := coalesce((p->>'id')::uuid, gen_random_uuid());
  v_amount    bigint := (p->>'amount_cents')::bigint;
  v_occurred  date := coalesce((p->>'occurred_on')::date, current_date);
  v_category  uuid := (p->>'category_id')::uuid;
  v_notes     text := coalesce(p->>'notes', '');
  v_paid_by   uuid := nullif(p->>'paid_by_member_id', '')::uuid;
  v_source    text := nullif(p->>'income_source', '');
  v_category_household uuid;
  v_member_role text;
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

  if v_source is null then
    raise exception 'income_source required for income' using errcode = 'P0001';
  end if;
  if v_source not in ('Salary','Contract','Self_employed','Benefit','Refund','Gift') then
    raise exception 'Unknown income_source' using errcode = 'P0001';
  end if;

  select household_id into v_category_household
    from public.category where id = v_category;
  if not found
     or (v_category_household is not null and v_category_household <> v_household) then
    raise exception 'Category not found in this household' using errcode = 'P0001';
  end if;

  if v_paid_by is not null then
    select role into v_member_role
      from public.household_member
      where id = v_paid_by and household_id = v_household;
    if not found then
      raise exception 'paid_by_member_id does not belong to this household' using errcode = 'P0001';
    end if;
    if v_member_role <> 'adult' then
      raise exception 'Only adults can earn income' using errcode = 'P0001';
    end if;
  end if;

  insert into public.transaction
    (id, household_id, type, amount_cents, occurred_on, category_id, notes,
     paid_by_member_id, essential_pct, income_source)
  values
    (v_id, v_household, 'income', v_amount, v_occurred, v_category, v_notes,
     v_paid_by, 0, v_source)
  on conflict (id) do nothing;

  return v_id;
end;
$$;

revoke all on function public.log_income(jsonb) from public;
grant execute on function public.log_income(jsonb) to authenticated;
