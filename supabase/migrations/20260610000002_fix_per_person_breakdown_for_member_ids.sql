-- Fix per_person_breakdown: two references to the dropped for_member_id
-- column (removed in 20260609000004):
--   1. for_member_id IS NULL  → for_member_ids IS NULL  (general expenses)
--   2. t.for_member_id = hm.id → hm.id = ANY(t.for_member_ids)  (member join)

CREATE OR REPLACE FUNCTION public.per_person_breakdown(
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
  v_household_id UUID := public.get_current_household();
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
  FROM public.household_member
  WHERE household_id = v_household_id
    AND deleted_at IS NULL;

  IF p_include_general THEN
    SELECT coalesce(sum(amount_cents), 0) INTO v_general
    FROM public.transaction
    WHERE household_id = v_household_id
      AND type = 'expense'
      AND for_member_ids IS NULL
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
  FROM public.household_member hm
  LEFT JOIN public.transaction t
         ON hm.id = ANY(t.for_member_ids)
        AND t.type = 'expense'
        AND t.occurred_on >= v_start
        AND t.occurred_on <  v_end
  WHERE hm.household_id = v_household_id
    AND hm.deleted_at IS NULL
  GROUP BY hm.id, hm.display_name, hm.role
  ORDER BY hm.created_at;
END;
$$;

ALTER FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) TO authenticated;
