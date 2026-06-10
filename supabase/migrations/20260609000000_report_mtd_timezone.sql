-- Add 'mtd' range and p_today parameter to report RPCs.
-- p_today lets the caller pass the current date in a specific timezone
-- (e.g., America/Edmonton) so range boundaries are computed correctly.

DROP FUNCTION IF EXISTS public.spend_over_time(TEXT);
DROP FUNCTION IF EXISTS public.cashflow_kpis(TEXT);
DROP FUNCTION IF EXISTS public._range_bounds(TEXT);

CREATE OR REPLACE FUNCTION public._range_bounds(p_range TEXT, p_today DATE DEFAULT NULL)
RETURNS TABLE (start_date DATE, end_date DATE)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT
    CASE p_range
      WHEN '30d' THEN COALESCE(p_today, current_date) - INTERVAL '30 days'
      WHEN '90d' THEN COALESCE(p_today, current_date) - INTERVAL '90 days'
      WHEN 'ytd' THEN date_trunc('year',  COALESCE(p_today, current_date))::DATE
      WHEN 'mtd' THEN date_trunc('month', COALESCE(p_today, current_date))::DATE
      ELSE COALESCE(p_today, current_date) - INTERVAL '30 days'
    END::DATE,
    (COALESCE(p_today, current_date) + INTERVAL '1 day')::DATE
$$;

ALTER FUNCTION public._range_bounds(TEXT, DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public._range_bounds(TEXT, DATE) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.cashflow_kpis(p_range TEXT, p_today DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
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

  SELECT start_date, end_date INTO v_start, v_end FROM public._range_bounds(p_range, p_today);
  v_days := greatest(1, (v_end - v_start));

  SELECT
    coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0),
    coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0)
  INTO v_income, v_expense
  FROM public.transaction
  WHERE household_id = v_household_id
    AND occurred_on >= v_start
    AND occurred_on <  v_end;

  SELECT jsonb_build_object(
    'merchant',     coalesce(t.notes, ''),
    'amount_cents', t.amount_cents,
    'occurred_on',  t.occurred_on
  )
  INTO v_largest
  FROM public.transaction t
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
  FROM public.transaction t
  JOIN public.category c ON c.id = t.category_id
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

ALTER FUNCTION public.cashflow_kpis(TEXT, DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.cashflow_kpis(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cashflow_kpis(TEXT, DATE) TO authenticated;

CREATE OR REPLACE FUNCTION public.spend_over_time(p_range TEXT, p_today DATE DEFAULT NULL)
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
  v_household_id UUID := public.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_bucket TEXT;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  SELECT start_date, end_date INTO v_start, v_end FROM public._range_bounds(p_range, p_today);
  v_bucket := CASE p_range
    WHEN '90d' THEN 'week'
    WHEN 'ytd' THEN 'month'
    ELSE 'day'
  END;

  RETURN QUERY
  SELECT date_trunc(v_bucket, occurred_on)::DATE AS bucket_start,
         coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0)::BIGINT,
         coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0)::BIGINT
  FROM public.transaction
  WHERE household_id = v_household_id
    AND occurred_on >= v_start
    AND occurred_on <  v_end
  GROUP BY date_trunc(v_bucket, occurred_on)
  ORDER BY bucket_start;
END;
$$;

ALTER FUNCTION public.spend_over_time(TEXT, DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.spend_over_time(TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_over_time(TEXT, DATE) TO authenticated;
