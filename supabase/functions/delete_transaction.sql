-- delete_transaction(id uuid) -> void
-- Idempotent — deleting an already-gone row returns silently.

create or replace function public.delete_transaction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  delete from public.transaction
   where id = p_id and household_id = v_household;
end;
$$;

revoke all on function public.delete_transaction(uuid) from public;
grant execute on function public.delete_transaction(uuid) to authenticated;
