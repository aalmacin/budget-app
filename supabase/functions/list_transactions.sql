-- transaction_view + list_transactions(filters jsonb)
-- The view joins transaction with category + member display names. The RPC
-- accepts a partial filter object so the same surface serves the transactions
-- list, the dashboard recent-activity strip, and the per-person panel.

create or replace view public.transaction_view as
  select
    t.id,
    t.household_id,
    t.type,
    t.amount_cents,
    t.occurred_on,
    t.category_id,
    c.name                 as category_name,
    t.notes,
    t.paid_by_member_id,
    pm.display_name        as paid_by_display_name,
    t.for_member_id,
    fm.display_name        as for_member_display_name,
    t.essential_pct,
    t.split_rule,
    t.income_source,
    t.subscription_id,
    t.occurrence_date,
    t.created_at,
    t.updated_at
  from public.transaction t
  join public.category c on c.id = t.category_id
  left join public.household_member pm on pm.id = t.paid_by_member_id
  left join public.household_member fm on fm.id = t.for_member_id;

-- View inherits RLS from the underlying transaction table via security_invoker.
alter view public.transaction_view set (security_invoker = true);

create or replace function public.list_transactions(p_filters jsonb default '{}'::jsonb)
returns setof public.transaction_view
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_from        date    := nullif(p_filters->>'from', '')::date;
  v_to          date    := nullif(p_filters->>'to', '')::date;
  v_category    uuid    := nullif(p_filters->>'category_id', '')::uuid;
  v_for_member  uuid    := nullif(p_filters->>'for_member_id', '')::uuid;
  v_essential   text    := nullif(p_filters->>'essential', '');
  v_search      text    := nullif(p_filters->>'search', '');
  v_limit       int     := coalesce((p_filters->>'limit')::int, 100);
  v_offset      int     := coalesce((p_filters->>'offset')::int, 0);
begin
  return query
    select * from public.transaction_view tv
    where (v_from is null or tv.occurred_on >= v_from)
      and (v_to   is null or tv.occurred_on <= v_to)
      and (v_category    is null or tv.category_id   = v_category)
      and (v_for_member  is null or tv.for_member_id = v_for_member)
      and (
        v_essential is null
        or v_essential = 'all'
        or (v_essential = 'essential' and tv.essential_pct > 0)
        or (v_essential = 'treats'    and tv.essential_pct < 100)
      )
      and (
        v_search is null
        or to_tsvector('simple', tv.notes) @@ plainto_tsquery('simple', v_search)
      )
    order by tv.occurred_on desc, tv.created_at desc
    limit v_limit offset v_offset;
end;
$$;

revoke all on function public.list_transactions(jsonb) from public;
grant execute on function public.list_transactions(jsonb) to authenticated;
