-- add_kid(display_name text, age_years smallint) -> uuid
-- Kids have no auth.users row. Caller must be an active member.

create or replace function public.add_kid(p_display_name text, p_age_years smallint)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_id        uuid;
begin
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'Kid name is required' using errcode = 'P0001';
  end if;
  if p_age_years is null then
    raise exception 'Age required for kids' using errcode = 'P0001';
  end if;
  if p_age_years < 0 or p_age_years > 25 then
    raise exception 'Age must be between 0 and 25' using errcode = 'P0001';
  end if;

  -- Pick the caller's first active household. The (auth)/(app) layout
  -- guarantees there is exactly one for an active member.
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid()
    and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  insert into public.household_member
    (household_id, user_id, role, display_name, age_years)
  values
    (v_household, null, 'kid', btrim(p_display_name), p_age_years)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.add_kid(text, smallint) from public;
grant execute on function public.add_kid(text, smallint) to authenticated;
