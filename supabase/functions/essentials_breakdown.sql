-- essentials_breakdown(year, month) -> jsonb
-- Returns overall essential/treats donut figures + recurring subscriptions
-- split into essential and treats lists.

set local check_function_bodies = off;

create or replace function public.essentials_breakdown(p_year smallint, p_month smallint)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_household uuid;
  v_start     date;
  v_end       date;
  v_overall_e bigint;
  v_overall_t bigint;
  v_ess_lines jsonb;
  v_tre_lines jsonb;
  v_ess_total bigint;
  v_tre_total bigint;
begin
  select household_id into v_household
  from public.household_member
  where user_id = auth.uid() and deleted_at is null
  limit 1;
  if v_household is null then return '{}'::jsonb; end if;

  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + interval '1 month')::date;

  select
    coalesce(sum(amount_cents * essential_pct / 100), 0)::bigint,
    coalesce(sum(amount_cents * (100 - essential_pct) / 100), 0)::bigint
  into v_overall_e, v_overall_t
  from public.transaction
  where household_id = v_household
    and type = 'expense'
    and occurred_on >= v_start and occurred_on < v_end;

  -- Recurring lists: split active subscriptions by their essential_pct.
  select
    coalesce(jsonb_agg(to_jsonb(r))
      filter (where r.essential_pct >= 50), '[]'::jsonb),
    coalesce(jsonb_agg(to_jsonb(r))
      filter (where r.essential_pct <  50), '[]'::jsonb),
    coalesce(sum(case when essential_pct >= 50 then amount_cents else 0 end),0)::bigint,
    coalesce(sum(case when essential_pct <  50 then amount_cents else 0 end),0)::bigint
  into v_ess_lines, v_tre_lines, v_ess_total, v_tre_total
  from (
    select s.id as subscription_id, s.merchant, s.amount_cents, s.cadence, s.essential_pct
    from public.subscription s
    where s.household_id = v_household and s.active = true
  ) r;

  return jsonb_build_object(
    'overall', jsonb_build_object(
      'essential_cents', v_overall_e,
      'treats_cents',    v_overall_t
    ),
    'recurring', jsonb_build_object(
      'essential',             v_ess_lines,
      'treats',                v_tre_lines,
      'essential_total_cents', v_ess_total,
      'treats_total_cents',    v_tre_total,
      'treats_percent',
        case when (v_ess_total + v_tre_total) = 0 then 0
             else round(100.0 * v_tre_total / (v_ess_total + v_tre_total))
        end
    )
  );
end;
$$;

revoke all on function public.essentials_breakdown(smallint, smallint) from public;
grant execute on function public.essentials_breakdown(smallint, smallint) to authenticated;

set local check_function_bodies = on;
