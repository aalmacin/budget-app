-- register_subscription(payload jsonb) -> uuid

create or replace function public.register_subscription(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_id        uuid;
  v_essential smallint;
  v_category_default smallint;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then
    raise exception 'No active membership' using errcode = '42501';
  end if;

  if (p->>'amount_cents')::bigint is null or (p->>'amount_cents')::bigint <= 0 then
    raise exception 'Amount must be positive' using errcode = 'P0001';
  end if;
  if (p->>'cadence') not in ('weekly','biweekly','monthly','quarterly','yearly') then
    raise exception 'Cadence not supported' using errcode = 'P0001';
  end if;

  select default_essential_pct into v_category_default
  from public.category where id = (p->>'category_id')::uuid;
  v_essential := coalesce((p->>'essential_pct')::smallint, v_category_default, 100);

  insert into public.subscription
    (household_id, merchant, amount_cents, category_id, cadence,
     next_renewal_at, paid_by_member_id, for_member_id, essential_pct, split_rule)
  values
    (v_household,
     coalesce(p->>'merchant', ''),
     (p->>'amount_cents')::bigint,
     (p->>'category_id')::uuid,
     p->>'cadence',
     coalesce((p->>'next_renewal_at')::date, current_date),
     nullif(p->>'paid_by_member_id','')::uuid,
     nullif(p->>'for_member_id','')::uuid,
     v_essential,
     nullif(p->>'split_rule',''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.register_subscription(jsonb) from public;
grant execute on function public.register_subscription(jsonb) to authenticated;
