-- update_transaction(id uuid, patch jsonb) -> void
-- Applies a partial patch (any subset of mutable fields) under RLS. Each
-- field is updated only when its key is present in the patch.

create or replace function public.update_transaction(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_existing  public.transaction%rowtype;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;

  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  select * into v_existing from public.transaction where id = p_id;
  if not found or v_existing.household_id <> v_household then
    raise exception 'Transaction not found' using errcode = '42501';
  end if;

  update public.transaction set
    amount_cents      = coalesce((p_patch->>'amount_cents')::bigint,    amount_cents),
    occurred_on       = coalesce((p_patch->>'occurred_on')::date,       occurred_on),
    category_id       = coalesce((p_patch->>'category_id')::uuid,       category_id),
    notes             = coalesce(p_patch->>'notes',                     notes),
    paid_by_member_id = case when p_patch ? 'paid_by_member_id'
                              then nullif(p_patch->>'paid_by_member_id','')::uuid
                              else paid_by_member_id end,
    for_member_id     = case when p_patch ? 'for_member_id'
                              then nullif(p_patch->>'for_member_id','')::uuid
                              else for_member_id end,
    essential_pct     = coalesce((p_patch->>'essential_pct')::smallint, essential_pct),
    split_rule        = case when p_patch ? 'split_rule'
                              then nullif(p_patch->>'split_rule','')
                              else split_rule end
  where id = p_id;

  -- Re-validate amount and essential_pct after the update.
  select * into v_existing from public.transaction where id = p_id;
  if v_existing.amount_cents <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;
  if v_existing.essential_pct < 0 or v_existing.essential_pct > 100 then
    raise exception 'essential_pct must be between 0 and 100' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.update_transaction(uuid, jsonb) from public;
grant execute on function public.update_transaction(uuid, jsonb) to authenticated;
