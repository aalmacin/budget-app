-- update_household(name text) -> void
-- v1 only allows renaming the household. The contracts doc still lists
-- province/tax_profile/gst_hst_registrant in the signature, but those columns
-- were dropped when US8 was removed (data-model.md §1, T041 wording).

create or replace function public.update_household(p_name text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
begin
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Household name is required' using errcode = 'P0001';
  end if;

  select household_id into v_household
  from public.household_member
  where user_id = auth.uid()
    and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  update public.household
     set name = btrim(p_name)
   where id = v_household;
end;
$$;

revoke all on function public.update_household(text) from public;
grant execute on function public.update_household(text) to authenticated;
