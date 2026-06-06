-- 2026-06-05: distinct-merchant suggestions for the /add picker.
-- Reads `transaction.notes` (the merchant/notes free-text column) for the
-- current household and returns one row per distinct non-empty value, ordered
-- by most-recent use first so frequently entered merchants float to the top.

CREATE OR REPLACE FUNCTION public.list_merchants()
RETURNS TABLE (name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT DISTINCT ON (lower(trim(t.notes))) trim(t.notes)
    FROM public.transaction t
   WHERE t.household_id = v_household_id
     AND t.notes IS NOT NULL
     AND length(trim(t.notes)) > 0
   ORDER BY lower(trim(t.notes)), t.occurred_on DESC;
END;
$$;

ALTER FUNCTION public.list_merchants() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_merchants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_merchants() TO authenticated;
