-- add_adult_by_email(email citext) -> record(status text, member_id uuid)
--
-- Per contracts/household.md: looks up auth.users by email and attaches that
-- user to the caller's household as an adult. Idempotent (FR-004b).
--
-- Returned status:
--   - 'inserted'        new active adult row was created
--   - 'already_member'  caller's household already has this user as an
--                       active adult (no-op)
--   - 'self_member'     caller passed their own email (no-op)
--
-- Raises P0001 'No account exists for that email...' when the email doesn't
-- resolve in auth.users (FR-004). Raises P0001 'Households are limited to 2
-- adults' when the cap would be breached (FR-004b).

create or replace function public.add_adult_by_email(p_email citext)
returns table(status text, member_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid              uuid := auth.uid();
  v_household        uuid;
  v_target_user      uuid;
  v_target_email     text;
  v_existing         public.household_member%rowtype;
  v_active_adults    int;
  v_new_member       uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = 'P0001';
  end if;

  -- Caller must be an active adult of exactly one household.
  select hm.household_id into v_household
  from public.household_member hm
  where hm.user_id = v_uid
    and hm.role = 'adult'
    and hm.deleted_at is null
  limit 1;

  if v_household is null then
    -- 42501 is what RLS would emit; mirror it for consistency.
    raise exception 'No active membership' using errcode = '42501';
  end if;

  if p_email is null or btrim(p_email::text) = '' then
    raise exception 'Email is required' using errcode = 'P0001';
  end if;

  select u.id, u.email into v_target_user, v_target_email
  from auth.users u
  where lower(u.email) = lower(btrim(p_email::text))
  limit 1;

  if v_target_user is null then
    raise exception 'No account exists for that email — ask the admin to create one first'
      using errcode = 'P0001';
  end if;

  -- Self-add is a no-op.
  if v_target_user = v_uid then
    select hm.id into v_new_member
    from public.household_member hm
    where hm.user_id = v_uid
      and hm.household_id = v_household
    limit 1;
    return query select 'self_member'::text, v_new_member;
    return;
  end if;

  -- Already-a-member is a no-op (regardless of soft-delete state — if
  -- soft-deleted, the explicit user action is to undelete via a separate
  -- flow, not by re-adding by email).
  select * into v_existing
  from public.household_member
  where household_id = v_household
    and user_id = v_target_user
  limit 1;

  if found and v_existing.deleted_at is null then
    return query select 'already_member'::text, v_existing.id;
    return;
  end if;

  -- Cap check: only active adults count.
  select count(*) into v_active_adults
  from public.household_member
  where household_id = v_household
    and role = 'adult'
    and deleted_at is null;

  if v_active_adults >= 2 then
    raise exception 'Households are limited to 2 adults' using errcode = 'P0001';
  end if;

  -- If there's a soft-deleted row, undelete it; otherwise insert fresh.
  if found and v_existing.deleted_at is not null then
    update public.household_member
       set deleted_at = null,
           role = 'adult'
     where id = v_existing.id
    returning id into v_new_member;
  else
    insert into public.household_member
      (household_id, user_id, role, display_name)
    values
      (v_household, v_target_user, 'adult', coalesce(split_part(v_target_email, '@', 1), 'Member'))
    returning id into v_new_member;
  end if;

  return query select 'inserted'::text, v_new_member;
end;
$$;

revoke all on function public.add_adult_by_email(citext) from public;
grant execute on function public.add_adult_by_email(citext) to authenticated;
