-- set_category_essential_pct(category_id uuid, pct smallint) -> uuid
-- Clone-on-write: if the row is a system-global (household_id IS NULL), insert
-- a per-household override row with the new pct. Otherwise update in place.
-- Returns the id of the row that now carries the override for the caller's
-- household (which may differ from the input id).

create or replace function public.set_category_essential_pct(
  p_category_id uuid,
  p_pct         smallint
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household        uuid;
  v_existing_override uuid;
  v_source_name      text;
  v_source_household uuid;
  v_source_budget    bigint;
  v_source_kind      text;
  v_new_id           uuid;
begin
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'essential_pct must be between 0 and 100' using errcode = 'P0001';
  end if;

  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  select name, household_id, monthly_budget_cents, kind
    into v_source_name, v_source_household, v_source_budget, v_source_kind
    from public.category
    where id = p_category_id;

  if not found then
    raise exception 'Category not found' using errcode = 'P0001';
  end if;

  -- If the input is already a household-owned row for this household, mutate.
  if v_source_household = v_household then
    update public.category set default_essential_pct = p_pct where id = p_category_id;
    return p_category_id;
  end if;

  -- System-global input: check for an existing override under the same name.
  if v_source_household is null then
    select id into v_existing_override
      from public.category
      where household_id = v_household and name = v_source_name
      limit 1;

    if v_existing_override is not null then
      update public.category set default_essential_pct = p_pct where id = v_existing_override;
      return v_existing_override;
    end if;

    insert into public.category (household_id, name, default_essential_pct, monthly_budget_cents, kind)
    values (v_household, v_source_name, p_pct, v_source_budget, v_source_kind)
    returning id into v_new_id;
    return v_new_id;
  end if;

  -- Input belongs to ANOTHER household: RLS would normally have blocked the
  -- read; surface a permission error to be explicit.
  raise exception 'Category not in caller household' using errcode = '42501';
end;
$$;

revoke all on function public.set_category_essential_pct(uuid, smallint) from public;
grant execute on function public.set_category_essential_pct(uuid, smallint) to authenticated;
