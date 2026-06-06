CREATE OR REPLACE FUNCTION public.update_member_display_name(
  p_member_id   UUID,
  p_display_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_display_name)) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters' USING ERRCODE = '22023';
  END IF;

  UPDATE public.household_member
     SET display_name = trim(p_display_name)
   WHERE id = p_member_id
     AND household_id = v_household_id
     AND deleted_at IS NULL;
END;
$$;

ALTER FUNCTION public.update_member_display_name(UUID, TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_member_display_name(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_display_name(UUID, TEXT) TO authenticated;

-- DROP required because the return type adds a new column (income_cents);
-- CREATE OR REPLACE cannot change an existing function's return type.
DROP FUNCTION IF EXISTS public.compute_income_split(uuid);

CREATE OR REPLACE FUNCTION public.compute_income_split(p_household_id uuid)
RETURNS TABLE(adult_id uuid, ratio numeric(10,8), display_order int, income_cents bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH adults AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY created_at, id) AS display_order
    FROM public.household_member
    WHERE household_id = p_household_id
      AND role = 'adult'
      AND deleted_at IS NULL
  ),
  income AS (
    SELECT paid_by_member_id AS adult_id,
           COALESCE(SUM(amount_cents), 0) AS income_cents
    FROM public.transaction
    WHERE household_id = p_household_id
      AND type = 'income'
      AND occurred_on >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY paid_by_member_id
  ),
  adults_with_income AS (
    SELECT a.id, a.display_order,
           COALESCE(i.income_cents, 0)::bigint AS income_cents
    FROM adults a
    LEFT JOIN income i ON i.adult_id = a.id
  ),
  total AS (SELECT SUM(income_cents) AS t FROM adults_with_income)
  SELECT
    a.id AS adult_id,
    CASE
      WHEN (SELECT t FROM total) = 0
        THEN (1.0 / NULLIF((SELECT COUNT(*) FROM adults_with_income), 0))::numeric(10,8)
      ELSE (a.income_cents::numeric / (SELECT t FROM total))::numeric(10,8)
    END AS ratio,
    a.display_order::int,
    a.income_cents
  FROM adults_with_income a;
$$;

ALTER FUNCTION public.compute_income_split(uuid) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.compute_income_split(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_income_split(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.apply_split_rule(p_transaction_id uuid)
RETURNS TABLE(adult_id uuid, owed_cents bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount    bigint;
  v_household uuid;
  v_rule      text;
  v_payer     uuid;
BEGIN
  SELECT amount_cents, household_id, split_rule, paid_by_member_id
    INTO v_amount, v_household, v_rule, v_payer
    FROM public.transaction WHERE id = p_transaction_id;

  IF v_amount IS NULL THEN
    RETURN;
  END IF;

  IF v_rule IS NULL THEN
    RETURN QUERY
      SELECT COALESCE(v_payer, (
        SELECT cis.adult_id FROM public.compute_income_split(v_household) cis
        ORDER BY cis.display_order LIMIT 1
      )), v_amount;
    RETURN;
  END IF;

  IF v_rule IN ('adult_a','adult_b','50_50') THEN
    RETURN QUERY
      WITH adults AS (
        SELECT cis.adult_id, cis.display_order
        FROM public.compute_income_split(v_household) cis
      ),
      ranked AS (
        SELECT a.adult_id, a.display_order,
               CASE
                 WHEN v_rule = 'adult_a' AND a.display_order = 1 THEN v_amount
                 WHEN v_rule = 'adult_b' AND a.display_order = 2 THEN v_amount
                 WHEN v_rule = '50_50' THEN (v_amount / 2)
                 ELSE 0
               END AS base
        FROM adults a
      ),
      with_residual AS (
        SELECT r.adult_id, r.display_order, r.base,
               CASE
                 WHEN v_rule = '50_50'
                      AND r.display_order = 1
                      AND (v_amount % 2) = 1
                 THEN r.base + 1
                 ELSE r.base
               END AS owed
        FROM ranked r
      )
      SELECT wr.adult_id, wr.owed::bigint
      FROM with_residual wr
      ORDER BY wr.display_order;
    RETURN;
  END IF;

  RETURN QUERY
    WITH split AS (
      SELECT cis.adult_id, cis.ratio, cis.display_order, cis.income_cents AS income
      FROM public.compute_income_split(v_household) cis
    ),
    floored AS (
      SELECT s.adult_id, s.ratio, s.display_order, s.income,
             FLOOR(v_amount * s.ratio)::bigint AS base
      FROM split s
    ),
    totals AS (SELECT SUM(f.base) AS base_sum FROM floored f),
    ranked AS (
      SELECT f.adult_id, f.base, f.income, f.display_order,
             ROW_NUMBER() OVER (ORDER BY f.income DESC, f.display_order ASC) AS winner_rank
      FROM floored f
    )
    SELECT r.adult_id,
           CASE WHEN r.winner_rank = 1
                THEN r.base + (v_amount - (SELECT base_sum FROM totals))
                ELSE r.base END AS owed_cents
    FROM ranked r
    ORDER BY r.display_order;
END;
$$;

ALTER FUNCTION public.apply_split_rule(uuid) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.apply_split_rule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_split_rule(uuid) TO authenticated;
