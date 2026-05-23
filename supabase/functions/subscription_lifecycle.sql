-- update_subscription / pause_subscription / resume_subscription
-- Bundled in one file for readability; each runs under the caller's RLS.

create or replace function public.update_subscription(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_amount bigint;
begin
  if p_patch ? 'amount_cents' then
    v_amount := (p_patch->>'amount_cents')::bigint;
    if v_amount is null or v_amount <= 0 then
      raise exception 'Amount must be positive' using errcode = 'P0001';
    end if;
  end if;
  if p_patch ? 'cadence'
     and (p_patch->>'cadence') not in ('weekly','biweekly','monthly','quarterly','yearly') then
    raise exception 'Cadence not supported' using errcode = 'P0001';
  end if;

  update public.subscription set
    merchant          = coalesce(p_patch->>'merchant',                          merchant),
    amount_cents      = coalesce((p_patch->>'amount_cents')::bigint,            amount_cents),
    category_id       = coalesce((p_patch->>'category_id')::uuid,               category_id),
    cadence           = coalesce(p_patch->>'cadence',                           cadence),
    next_renewal_at   = coalesce((p_patch->>'next_renewal_at')::date,           next_renewal_at),
    paid_by_member_id = case when p_patch ? 'paid_by_member_id'
                              then nullif(p_patch->>'paid_by_member_id','')::uuid
                              else paid_by_member_id end,
    for_member_id     = case when p_patch ? 'for_member_id'
                              then nullif(p_patch->>'for_member_id','')::uuid
                              else for_member_id end,
    essential_pct     = coalesce((p_patch->>'essential_pct')::smallint,         essential_pct),
    split_rule        = case when p_patch ? 'split_rule'
                              then nullif(p_patch->>'split_rule','')
                              else split_rule end
  where id = p_id;
end;
$$;

create or replace function public.pause_subscription(p_id uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.subscription set active = false where id = p_id;
$$;

create or replace function public.resume_subscription(p_id uuid)
returns void
language sql
security invoker
set search_path = public, pg_temp
as $$
  update public.subscription set active = true where id = p_id;
$$;

revoke all on function public.update_subscription(uuid, jsonb) from public;
revoke all on function public.pause_subscription(uuid) from public;
revoke all on function public.resume_subscription(uuid) from public;
grant execute on function public.update_subscription(uuid, jsonb) to authenticated;
grant execute on function public.pause_subscription(uuid) to authenticated;
grant execute on function public.resume_subscription(uuid) to authenticated;
