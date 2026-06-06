-- 2026-06-05: find-or-create RPC for categories.
-- `public.category` is locked down (migration 20260524000008 revokes DML from
-- `authenticated`), so the /add picker can't INSERT directly. Clients call
-- this SECURITY DEFINER function instead. Idempotent: the same
-- (household, kind, name) triple always returns the same id.

CREATE OR REPLACE FUNCTION public.ensure_category(p_name TEXT, p_kind TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_name         TEXT := trim(coalesce(p_name, ''));
  v_id           UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_name) = 0 THEN
    RAISE EXCEPTION 'Category name is required' USING ERRCODE = '22023';
  END IF;
  IF length(v_name) > 100 THEN
    RAISE EXCEPTION 'Category name must be 100 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('expense', 'income') THEN
    RAISE EXCEPTION 'p_kind must be expense or income' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_id
    FROM public.category
   WHERE household_id = v_household_id
     AND kind = p_kind
     AND name = v_name
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.category (household_id, name, kind)
    VALUES (v_household_id, v_name, p_kind)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public.ensure_category(TEXT, TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.ensure_category(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_category(TEXT, TEXT) TO authenticated;
