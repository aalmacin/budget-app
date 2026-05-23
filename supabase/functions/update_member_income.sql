-- update_member_income(member_id uuid, monthly_income_cents bigint) -> void
-- Adults only; rejects kids and soft-deleted members. Caller must share the
-- household via RLS.

create or replace function public.update_member_income(
  p_member_id            uuid,
  p_monthly_income_cents bigint
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_target public.household_member%rowtype;
begin
  if p_monthly_income_cents is null or p_monthly_income_cents < 0 then
    raise exception 'monthly_income_cents must be >= 0' using errcode = 'P0001';
  end if;

  select * into v_target
  from public.household_member
  where id = p_member_id;

  if not found then
    raise exception 'Member not found' using errcode = '42501';
  end if;

  if v_target.role <> 'adult' then
    raise exception 'Only adults have income' using errcode = 'P0001';
  end if;

  if v_target.deleted_at is not null then
    raise exception 'Can''t update income on a removed member' using errcode = 'P0001';
  end if;

  update public.household_member
     set monthly_income_cents = p_monthly_income_cents
   where id = p_member_id;
end;
$$;

revoke all on function public.update_member_income(uuid, bigint) from public;
grant execute on function public.update_member_income(uuid, bigint) to authenticated;
