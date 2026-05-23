-- create_household(name text) -> uuid
-- Creates a household and adds the caller as the first adult member, all in
-- one transaction. SECURITY DEFINER so it can write both rows before the RLS
-- policies (which require existing membership) would allow them.

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid       uuid := auth.uid();
  v_household uuid;
  v_email     text;
  v_local     text;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.household_member
    where user_id = v_uid
      and deleted_at is null
  ) then
    raise exception 'You already belong to a household' using errcode = 'P0001';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Household name is required' using errcode = 'P0001';
  end if;

  insert into public.household (name, owner_user_id)
  values (btrim(p_name), v_uid)
  returning id into v_household;

  -- Default display_name = local-part of the user's email; user can edit.
  select email into v_email from auth.users where id = v_uid;
  v_local := coalesce(split_part(v_email, '@', 1), 'Member');

  insert into public.household_member
    (household_id, user_id, role, display_name)
  values
    (v_household, v_uid, 'adult', v_local);

  return v_household;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
