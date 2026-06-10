-- Fix monthly_expense_comparison: people subquery referenced the dropped
-- for_member_id column (removed in 20260609000004). Replace with UNNEST
-- over for_member_ids UUID[] so per-person totals are computed correctly.

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

  SELECT COALESCE(jsonb_agg(months.month_row ORDER BY months.month_start DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      m.month_start,
      jsonb_build_object(
        'year',                EXTRACT(YEAR  FROM m.month_start)::INT,
        'month',               EXTRACT(MONTH FROM m.month_start)::INT,
        'total_cents',         m.total_cents,
        'essential_cents',     m.essential_cents,
        'non_essential_cents', m.non_essential_cents,
        'categories', (
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
              AND date_trunc('month', t2.occurred_on) = m.month_start
            GROUP BY t2.category_id
          ) cat_totals
          JOIN public.category c ON c.id = cat_totals.category_id
        ),
        'people', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',          hm.id,
            'name',        hm.display_name,
            'spent_cents', person_totals.spent
          ) ORDER BY hm.display_name), '[]'::JSONB)
          FROM (
            SELECT mid, SUM(t3.amount_cents) AS spent
            FROM public.transaction t3
            CROSS JOIN LATERAL unnest(t3.for_member_ids) AS mid
            WHERE t3.household_id = v_household_id
              AND t3.type = 'expense'
              AND t3.for_member_ids IS NOT NULL
              AND date_trunc('month', t3.occurred_on) = m.month_start
            GROUP BY mid
          ) person_totals
          JOIN public.household_member hm ON hm.id = person_totals.mid
        )
      ) AS month_row
    FROM (
      SELECT
        date_trunc('month', t.occurred_on)                             AS month_start,
        SUM(t.amount_cents)                                            AS total_cents,
        SUM((t.amount_cents * t.essential_pct / 100)::BIGINT)          AS essential_cents,
        SUM((t.amount_cents * (100 - t.essential_pct) / 100)::BIGINT)  AS non_essential_cents
      FROM public.transaction t
      WHERE t.household_id = v_household_id
        AND t.type = 'expense'
      GROUP BY date_trunc('month', t.occurred_on)
    ) m
  ) months;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.monthly_expense_comparison(DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.monthly_expense_comparison(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_expense_comparison(DATE) TO authenticated;
