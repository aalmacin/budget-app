-- list_history_months() — returns distinct (year, month) pairs that have
-- at least one expense transaction for the current household. Much cheaper
-- than monthly_expense_comparison() which fetches full category+people
-- breakdowns; the history index page only needs the month list.

CREATE OR REPLACE FUNCTION public.list_history_months()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  RETURN (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'year',  EXTRACT(YEAR  FROM month_start)::INT,
          'month', EXTRACT(MONTH FROM month_start)::INT
        )
        ORDER BY month_start DESC
      ),
      '[]'::JSONB
    )
    FROM (
      SELECT DISTINCT date_trunc('month', occurred_on) AS month_start
      FROM public.transaction
      WHERE household_id = v_household_id
        AND type = 'expense'
    ) months
  );
END;
$$;

ALTER FUNCTION public.list_history_months() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_history_months() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_history_months() TO authenticated;
