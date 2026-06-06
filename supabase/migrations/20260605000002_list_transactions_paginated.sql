-- list_transactions: add offset + total_count so the /transactions page can
-- paginate. The RPC returns both the page rows and a window function over the
-- filtered set so the UI can render "Page X of Y" without a second round-trip.
--
-- Filters unchanged from the previous shape (20260524000011). The shape change
-- is: TABLE now includes total_count BIGINT; p_filters now accepts `offset`.
-- Default page size stays 100 — clients should always pass an explicit limit
-- so payloads are predictable.
--
-- DROP first because CREATE OR REPLACE refuses to change the OUT-parameter
-- row type (42P13). The whole migration runs in a transaction, so a partial
-- failure leaves the original function intact.
DROP FUNCTION IF EXISTS public.list_transactions(JSONB);

CREATE FUNCTION public.list_transactions(p_filters JSONB)
RETURNS TABLE (
  id                      UUID,
  type                    TEXT,
  amount_cents            BIGINT,
  category_name           TEXT,
  notes                   TEXT,
  for_member_display_name TEXT,
  paid_by_display_name    TEXT,
  occurred_on             DATE,
  essential_pct           SMALLINT,
  total_count             BIGINT
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
    SELECT t.id, t.type, t.amount_cents, c.name AS category_name, t.notes,
           fm.display_name AS for_member_display_name,
           pm.display_name AS paid_by_display_name,
           t.occurred_on, t.essential_pct,
           t.created_at
    FROM public.transaction t
    LEFT JOIN public.category        c  ON c.id  = t.category_id
    LEFT JOIN public.household_member fm ON fm.id = t.for_member_id
    LEFT JOIN public.household_member pm ON pm.id = t.paid_by_member_id
    WHERE t.household_id = v_household_id
      AND (v_search     IS NULL OR to_tsvector('simple', t.notes) @@ plainto_tsquery('simple', v_search))
      AND (v_essential  IS NULL
           OR (v_essential = 'essential' AND t.essential_pct >= 50)
           OR (v_essential = 'treats'    AND t.essential_pct <  50))
      AND (v_for_member IS NULL OR t.for_member_id = v_for_member)
      AND (v_from       IS NULL OR t.occurred_on  >= v_from)
      AND (v_to         IS NULL OR t.occurred_on  <  v_to)
  )
  SELECT f.id, f.type, f.amount_cents, f.category_name, f.notes,
         f.for_member_display_name, f.paid_by_display_name,
         f.occurred_on, f.essential_pct,
         count(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.occurred_on DESC, f.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

ALTER FUNCTION public.list_transactions(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_transactions(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_transactions(JSONB) TO authenticated;
