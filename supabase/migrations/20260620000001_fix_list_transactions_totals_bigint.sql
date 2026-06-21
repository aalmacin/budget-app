-- Fix runtime type mismatch in list_transactions introduced by the filtered
-- totals columns. sum(amount_cents) over a BIGINT column returns NUMERIC, but
-- total_income_cents / total_expense_cents are declared BIGINT — so every call
-- failed with "Returned type numeric does not match expected type bigint",
-- making the RPC return null and the transactions page render empty.
-- Cast the window sums back to BIGINT (cents always fit in BIGINT).

DROP FUNCTION IF EXISTS public.list_transactions(JSONB);

CREATE FUNCTION public.list_transactions(p_filters JSONB)
RETURNS TABLE (
  id                      UUID,
  type                    TEXT,
  amount_cents            BIGINT,
  category_id             UUID,
  category_name           TEXT,
  notes                   TEXT,
  for_member_ids          UUID[],
  for_member_display_name TEXT,
  paid_by_member_id       UUID,
  paid_by_display_name    TEXT,
  split_rule              TEXT,
  income_source           TEXT,
  occurred_on             DATE,
  essential_pct           SMALLINT,
  total_count             BIGINT,
  total_income_cents      BIGINT,
  total_expense_cents     BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_search       TEXT := nullif(p_filters->>'search', '');
  v_essential    TEXT := p_filters->>'essential';
  v_for_member   UUID := nullif(p_filters->>'for_member_id', '')::UUID;
  v_category     UUID := nullif(p_filters->>'category_id', '')::UUID;
  v_from         DATE := nullif(p_filters->>'from', '')::DATE;
  v_to           DATE := nullif(p_filters->>'to', '')::DATE;
  v_limit        INT  := coalesce((p_filters->>'limit')::INT, 100);
  v_offset       INT  := coalesce((p_filters->>'offset')::INT, 0);
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  IF v_limit  > 500 THEN v_limit  := 500; END IF;
  IF v_limit  < 1   THEN v_limit  := 1;   END IF;
  IF v_offset < 0   THEN v_offset := 0;   END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT t.id, t.type, t.amount_cents,
           t.category_id, c.name AS category_name,
           t.notes,
           t.for_member_ids,
           t.paid_by_member_id, pm.display_name AS paid_by_display_name,
           t.split_rule, t.income_source,
           t.occurred_on, t.essential_pct,
           t.created_at
    FROM public.transaction t
    LEFT JOIN public.category         c  ON c.id  = t.category_id
    LEFT JOIN public.household_member pm ON pm.id = t.paid_by_member_id
    WHERE t.household_id = v_household_id
      AND (v_search     IS NULL OR to_tsvector('simple', t.notes) @@ plainto_tsquery('simple', v_search))
      AND (v_essential  IS NULL
           OR (v_essential = 'essential' AND t.essential_pct >= 50)
           OR (v_essential = 'treats'    AND t.essential_pct <  50))
      AND (v_for_member IS NULL OR v_for_member = ANY(t.for_member_ids))
      AND (v_category   IS NULL OR t.category_id = v_category)
      AND (v_from       IS NULL OR t.occurred_on >= v_from)
      AND (v_to         IS NULL OR t.occurred_on <  v_to)
  )
  SELECT f.id, f.type, f.amount_cents,
         f.category_id, f.category_name,
         f.notes,
         f.for_member_ids,
         (SELECT string_agg(hm.display_name, ', ')
          FROM public.household_member hm
          WHERE hm.id = ANY(f.for_member_ids)) AS for_member_display_name,
         f.paid_by_member_id, f.paid_by_display_name,
         f.split_rule, f.income_source,
         f.occurred_on, f.essential_pct,
         count(*) OVER () AS total_count,
         coalesce(sum(f.amount_cents) FILTER (WHERE f.type = 'income')  OVER (), 0)::BIGINT AS total_income_cents,
         coalesce(sum(f.amount_cents) FILTER (WHERE f.type = 'expense') OVER (), 0)::BIGINT AS total_expense_cents
  FROM filtered f
  ORDER BY f.occurred_on DESC, f.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

ALTER FUNCTION public.list_transactions(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_transactions(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_transactions(JSONB) TO authenticated;
