-- monthly_expense_comparison() — returns all expense months for the current
-- household, newest first, with per-category and per-member breakdowns.
-- Follows SECURITY DEFINER / search_path = '' / budget_function_owner pattern.

CREATE OR REPLACE FUNCTION public.monthly_expense_comparison(
  p_today DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_result       JSONB;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(month_row ORDER BY month_row->>'year' DESC, month_row->>'month' DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'year',                  EXTRACT(YEAR  FROM date_trunc('month', occurred_on))::INT,
      'month',                 EXTRACT(MONTH FROM date_trunc('month', occurred_on))::INT,
      'total_cents',           SUM(amount_cents),
      'essential_cents',       SUM((amount_cents * essential_pct / 100)::BIGINT),
      'non_essential_cents',   SUM((amount_cents * (100 - essential_pct) / 100)::BIGINT),
      'categories',            (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',          c.id,
          'name',        c.name,
          'spent_cents', cat_totals.spent
        ) ORDER BY c.name), '[]'::JSONB)
        FROM (
          SELECT t2.category_id, SUM(t2.amount_cents) AS spent
          FROM public.transaction t2
          WHERE t2.household_id = v_household_id
            AND t2.type = 'expense'
            AND date_trunc('month', t2.occurred_on) = date_trunc('month', t.occurred_on)
          GROUP BY t2.category_id
        ) cat_totals
        JOIN public.category c ON c.id = cat_totals.category_id
      ),
      'people',                (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',          hm.id,
          'name',        hm.display_name,
          'spent_cents', person_totals.spent
        ) ORDER BY hm.display_name), '[]'::JSONB)
        FROM (
          SELECT t3.for_member_id, SUM(t3.amount_cents) AS spent
          FROM public.transaction t3
          WHERE t3.household_id = v_household_id
            AND t3.type = 'expense'
            AND t3.for_member_id IS NOT NULL
            AND date_trunc('month', t3.occurred_on) = date_trunc('month', t.occurred_on)
          GROUP BY t3.for_member_id
        ) person_totals
        JOIN public.household_member hm ON hm.id = person_totals.for_member_id
      )
    ) AS month_row
    FROM public.transaction t
    WHERE t.household_id = v_household_id
      AND t.type = 'expense'
    GROUP BY date_trunc('month', t.occurred_on)
  ) months;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.monthly_expense_comparison(DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.monthly_expense_comparison(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_expense_comparison(DATE) TO authenticated;
