-- set_category_budget(category_id uuid, monthly_budget_cents bigint?) -> uuid
-- Clone-on-write: if the input is system-global, insert/upsert a per-household
-- override carrying the new budget. Passing NULL clears the limit.

create or replace function public.set_category_budget(
  p_category_id          uuid,
  p_monthly_budget_cents bigint
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household         uuid;
  v_source_name       text;
  v_source_household  uuid;
  v_source_pct        smallint;
  v_source_kind       text;
  v_existing_override uuid;
  v_new_id            uuid;
begin
  if p_monthly_budget_cents is not null and p_monthly_budget_cents < 0 then
    raise exception 'monthly_budget_cents must be >= 0 (or null to clear)' using errcode = 'P0001';
  end if;

  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  select name, household_id, default_essential_pct, kind
    into v_source_name, v_source_household, v_source_pct, v_source_kind
    from public.category where id = p_category_id;
  if not found then
    raise exception 'Category not found' using errcode = 'P0001';
  end if;

  if v_source_household = v_household then
    update public.category
       set monthly_budget_cents = p_monthly_budget_cents
     where id = p_category_id;
    return p_category_id;
  end if;

  if v_source_household is null then
    select id into v_existing_override
      from public.category
     where household_id = v_household and name = v_source_name
     limit 1;

    if v_existing_override is not null then
      update public.category
         set monthly_budget_cents = p_monthly_budget_cents
       where id = v_existing_override;
      return v_existing_override;
    end if;

    insert into public.category
      (household_id, name, default_essential_pct, monthly_budget_cents, kind)
    values
      (v_household, v_source_name, v_source_pct, p_monthly_budget_cents, v_source_kind)
    returning id into v_new_id;
    return v_new_id;
  end if;

  raise exception 'Category not in caller household' using errcode = '42501';
end;
$$;

revoke all on function public.set_category_budget(uuid, bigint) from public;
grant execute on function public.set_category_budget(uuid, bigint) to authenticated;
