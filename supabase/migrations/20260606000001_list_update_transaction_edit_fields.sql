-- Edit-transaction parity with create forms.
--
-- 1. list_transactions: also return the foreign-key ids and income/split
--    fields so the edit sheet can hydrate every input the create forms
--    expose (category, for whom, paid-by split, income source).
-- 2. update_transaction: accept income_source in the patch object, since
--    editing an income row must be able to change the source enum.
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
  category_id             UUID,
  category_name           TEXT,
  notes                   TEXT,
  for_member_id           UUID,
  for_member_display_name TEXT,
  paid_by_member_id       UUID,
  paid_by_display_name    TEXT,
  split_rule              TEXT,
  income_source           TEXT,
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
    SELECT t.id, t.type, t.amount_cents,
           t.category_id, c.name AS category_name,
           t.notes,
           t.for_member_id, fm.display_name AS for_member_display_name,
           t.paid_by_member_id, pm.display_name AS paid_by_display_name,
           t.split_rule, t.income_source,
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
  SELECT f.id, f.type, f.amount_cents,
         f.category_id, f.category_name,
         f.notes,
         f.for_member_id, f.for_member_display_name,
         f.paid_by_member_id, f.paid_by_display_name,
         f.split_rule, f.income_source,
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

-- update_transaction: add income_source patch support so income edits can
-- change the source enum. Other keys unchanged.
CREATE OR REPLACE FUNCTION public.update_transaction(p_id UUID, p_patch JSONB)
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

  UPDATE public.transaction
     SET amount_cents      = coalesce((p_patch->>'amount_cents')::BIGINT,    amount_cents),
         notes             = coalesce(p_patch->>'notes',                     notes),
         essential_pct     = coalesce((p_patch->>'essential_pct')::SMALLINT, essential_pct),
         occurred_on       = coalesce(nullif(p_patch->>'occurred_on', '')::DATE, occurred_on),
         category_id       = coalesce(nullif(p_patch->>'category_id', '')::UUID, category_id),
         paid_by_member_id = CASE WHEN p_patch ? 'paid_by_member_id'
                                  THEN nullif(p_patch->>'paid_by_member_id', '')::UUID
                                  ELSE paid_by_member_id END,
         for_member_id     = CASE WHEN p_patch ? 'for_member_id'
                                  THEN nullif(p_patch->>'for_member_id', '')::UUID
                                  ELSE for_member_id END,
         split_rule        = CASE WHEN p_patch ? 'split_rule'
                                  THEN nullif(p_patch->>'split_rule', '')
                                  ELSE split_rule END,
         income_source     = CASE WHEN p_patch ? 'income_source'
                                  THEN nullif(p_patch->>'income_source', '')
                                  ELSE income_source END
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.update_transaction(UUID, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_transaction(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transaction(UUID, JSONB) TO authenticated;
