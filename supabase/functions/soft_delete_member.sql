-- soft_delete_member(member_id uuid) -> void
-- Idempotent. Refuses self-delete when the caller is the only active adult
-- (would orphan the household). RLS-enforced household isolation prevents
-- removing a member from another household.

create or replace function public.soft_delete_member(p_member_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_target          public.household_member%rowtype;
  v_other_adults    int;
begin
  select * into v_target
  from public.household_member
  where id = p_member_id;

  if not found then
    -- RLS-policy semantics: pretend the row doesn't exist when out-of-scope.
    raise exception 'Member not found' using errcode = '42501';
  end if;

  -- Already deleted: idempotent no-op.
  if v_target.deleted_at is not null then
    return;
  end if;

  -- Self-delete guard: only block if removing self would leave 0 active
  -- adults in the household.
  if v_target.user_id is not null and v_target.user_id = auth.uid() then
    select count(*) into v_other_adults
    from public.household_member
    where household_id = v_target.household_id
      and role = 'adult'
      and deleted_at is null
      and id <> v_target.id;

    if v_other_adults = 0 then
      raise exception 'Can''t remove yourself if you are the only active adult'
        using errcode = 'P0001';
    end if;
  end if;

  update public.household_member
     set deleted_at = now()
   where id = p_member_id;
end;
$$;

revoke all on function public.soft_delete_member(uuid) from public;
grant execute on function public.soft_delete_member(uuid) to authenticated;
