-- T064 — Phase 7 / US4: public.create_household RPC.
--
-- Atomically creates a household and inserts the caller as its first adult
-- member. Returns the new household id (the client redirects on success;
-- see app/(auth)/onboarding/create-household/actions.ts).
--
-- Two reads against auth.users are needed:
--   - the display_name derivation, delegated to
--     public.current_user_display_name(); and
--   - the two table INSERTs themselves, delegated to
--     public.bootstrap_household() because at the moment of those inserts
--     the caller has zero memberships, so the household/household_member
--     RLS WITH CHECK ("household_id ∈ caller's memberships") fails for
--     the budget_function_owner role this RPC runs as. The bootstrap
--     helper is postgres-owned and therefore bypasses RLS for that one
--     two-row operation. See migration 20260524000017_auth_user_helpers.sql.

CREATE OR REPLACE FUNCTION public.create_household(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_display_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Household name is required' USING ERRCODE = '22023';
  END IF;

  v_display_name := public.current_user_display_name();

  RETURN public.bootstrap_household(v_user_id, p_name, v_display_name);
END;
$$;

ALTER FUNCTION public.create_household(TEXT) OWNER TO budget_function_owner;

REVOKE ALL ON FUNCTION public.create_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_household(TEXT) TO authenticated;
