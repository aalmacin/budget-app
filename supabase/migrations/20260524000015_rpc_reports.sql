-- T090–T093 — Phase 7 / US8: report RPCs.
-- Every function: SECURITY DEFINER, search_path = '', owner =
-- budget_function_owner, EXECUTE granted to authenticated.

CREATE OR REPLACE FUNCTION budget._range_bounds(p_range TEXT)
RETURNS TABLE (start_date DATE, end_date DATE)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT
    CASE p_range
      WHEN '30d' THEN current_date - INTERVAL '30 days'
      WHEN '90d' THEN current_date - INTERVAL '90 days'
      WHEN 'ytd' THEN date_trunc('year', current_date)::DATE
      ELSE current_date - INTERVAL '30 days'
    END::DATE,
    (current_date + INTERVAL '1 day')::DATE
$$;

ALTER FUNCTION budget._range_bounds(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget._range_bounds(TEXT) FROM PUBLIC;
-- Internal helper.

-- ---------------------------------------------------------------------------
-- cashflow_kpis(p_range) — returns the jsonb shape consumed by
-- reports/cashflow/page.tsx.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.cashflow_kpis(p_range TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_days  INT;
  v_income BIGINT;
  v_expense BIGINT;
  v_largest JSONB;
  v_top_cat JSONB;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  SELECT start_date, end_date INTO v_start, v_end FROM budget._range_bounds(p_range);
  v_days := greatest(1, (v_end - v_start));

  SELECT
    coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0),
    coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0)
  INTO v_income, v_expense
  FROM budget.transaction
  WHERE household_id = v_household_id
    AND occurred_on >= v_start
    AND occurred_on <  v_end;

  SELECT jsonb_build_object(
    'merchant',     coalesce(t.notes, ''),
    'amount_cents', t.amount_cents,
    'occurred_on',  t.occurred_on
  )
  INTO v_largest
  FROM budget.transaction t
  WHERE t.household_id = v_household_id
    AND t.type = 'expense'
    AND t.occurred_on >= v_start
    AND t.occurred_on <  v_end
  ORDER BY t.amount_cents DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'name',        c.name,
    'spent_cents', sum(t.amount_cents)
  )
  INTO v_top_cat
  FROM budget.transaction t
  JOIN budget.category c ON c.id = t.category_id
  WHERE t.household_id = v_household_id
    AND t.type = 'expense'
    AND t.occurred_on >= v_start
    AND t.occurred_on <  v_end
  GROUP BY c.name
  ORDER BY sum(t.amount_cents) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'income_cents',           v_income,
    'expense_cents',          v_expense,
    'net_cents',              v_income - v_expense,
    'avg_daily_spend_cents',  v_expense / v_days,
    'largest_expense',        v_largest,
    'top_category',           v_top_cat,
    'insights',               '[]'::JSONB
  );
END;
$$;

ALTER FUNCTION budget.cashflow_kpis(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.cashflow_kpis(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.cashflow_kpis(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- essentials_breakdown(p_year, p_month) — overall essential vs treats
-- spend for the month, plus the recurring (subscription) split by
-- essential_pct >= 50.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.essentials_breakdown(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_essential BIGINT;
  v_treats    BIGINT;
  v_essential_subs JSONB;
  v_treats_subs    JSONB;
  v_essential_total BIGINT;
  v_treats_total    BIGINT;
  v_treats_pct      INT;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  SELECT
    coalesce(sum(amount_cents * essential_pct / 100),         0),
    coalesce(sum(amount_cents * (100 - essential_pct) / 100), 0)
  INTO v_essential, v_treats
  FROM budget.transaction
  WHERE household_id = v_household_id
    AND type = 'expense'
    AND occurred_on >= v_start
    AND occurred_on <  v_end;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'subscription_id', id,
      'merchant',        merchant,
      'amount_cents',    amount_cents,
      'cadence',         cadence,
      'essential_pct',   essential_pct
    )), '[]'::JSONB),
    coalesce(sum(amount_cents), 0)
  INTO v_essential_subs, v_essential_total
  FROM budget.subscription
  WHERE household_id = v_household_id
    AND active
    AND essential_pct >= 50;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'subscription_id', id,
      'merchant',        merchant,
      'amount_cents',    amount_cents,
      'cadence',         cadence,
      'essential_pct',   essential_pct
    )), '[]'::JSONB),
    coalesce(sum(amount_cents), 0)
  INTO v_treats_subs, v_treats_total
  FROM budget.subscription
  WHERE household_id = v_household_id
    AND active
    AND essential_pct < 50;

  v_treats_pct := CASE WHEN (v_essential_total + v_treats_total) = 0 THEN 0
                       ELSE (100 * v_treats_total / (v_essential_total + v_treats_total))::INT END;

  RETURN jsonb_build_object(
    'overall', jsonb_build_object(
      'essential_cents', v_essential,
      'treats_cents',    v_treats
    ),
    'recurring', jsonb_build_object(
      'essential',             v_essential_subs,
      'treats',                v_treats_subs,
      'essential_total_cents', v_essential_total,
      'treats_total_cents',    v_treats_total,
      'treats_percent',        v_treats_pct
    )
  );
END;
$$;

ALTER FUNCTION budget.essentials_breakdown(INT, INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.essentials_breakdown(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.essentials_breakdown(INT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- spend_over_time(p_range) — bucketed spend + income series.
-- 30d → daily buckets, 90d → weekly, ytd → monthly.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.spend_over_time(p_range TEXT)
RETURNS TABLE (
  bucket_start DATE,
  spent_cents  BIGINT,
  income_cents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_bucket TEXT;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM budget._range_bounds(p_range);
  v_bucket := CASE p_range
    WHEN '90d' THEN 'week'
    WHEN 'ytd' THEN 'month'
    ELSE 'day'
  END;

  RETURN QUERY
  SELECT date_trunc(v_bucket, occurred_on)::DATE AS bucket_start,
         coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0)::BIGINT,
         coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0)::BIGINT
  FROM budget.transaction
  WHERE household_id = v_household_id
    AND occurred_on >= v_start
    AND occurred_on <  v_end
  GROUP BY date_trunc(v_bucket, occurred_on)
  ORDER BY bucket_start;
END;
$$;

ALTER FUNCTION budget.spend_over_time(TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.spend_over_time(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.spend_over_time(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- per_person_breakdown(p_year, p_month, p_include_general) — spend per
-- household member. p_include_general adds an equal share of for_member_id-
-- NULL expenses to every active member.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.per_person_breakdown(
  p_year INT, p_month INT, p_include_general BOOLEAN
)
RETURNS TABLE (
  member_id              UUID,
  display_name           TEXT,
  role                   TEXT,
  spent_cents            BIGINT,
  share_of_general_cents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_general BIGINT;
  v_member_count INT;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  SELECT count(*) INTO v_member_count
  FROM budget.household_member
  WHERE household_id = v_household_id
    AND deleted_at IS NULL;

  IF p_include_general THEN
    SELECT coalesce(sum(amount_cents), 0) INTO v_general
    FROM budget.transaction
    WHERE household_id = v_household_id
      AND type = 'expense'
      AND for_member_id IS NULL
      AND occurred_on >= v_start
      AND occurred_on <  v_end;
  ELSE
    v_general := 0;
  END IF;

  RETURN QUERY
  SELECT hm.id,
         hm.display_name,
         hm.role,
         coalesce(sum(t.amount_cents), 0)::BIGINT AS spent_cents,
         CASE WHEN p_include_general AND v_member_count > 0
              THEN (v_general / v_member_count)::BIGINT
              ELSE 0::BIGINT
         END AS share_of_general_cents
  FROM budget.household_member hm
  LEFT JOIN budget.transaction t
         ON t.for_member_id = hm.id
        AND t.type = 'expense'
        AND t.occurred_on >= v_start
        AND t.occurred_on <  v_end
  WHERE hm.household_id = v_household_id
    AND hm.deleted_at IS NULL
  GROUP BY hm.id, hm.display_name, hm.role
  ORDER BY hm.created_at;
END;
$$;

ALTER FUNCTION budget.per_person_breakdown(INT, INT, BOOLEAN) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.per_person_breakdown(INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.per_person_breakdown(INT, INT, BOOLEAN) TO authenticated;
