-- T064 — Phase 7 / US4: budget.create_household RPC.
--
-- Atomically creates a household and inserts the caller as its first adult
-- member. Returns the new household id (the client redirects on success;
-- see app/(auth)/onboarding/create-household/actions.ts).
--
-- The display_name derivation prefers the auth user's full_name metadata
-- over the email local-part; both are safe (the user provided them at
-- account creation). Falls back to 'Adult' if neither is present.

CREATE OR REPLACE FUNCTION budget.create_household(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_household_id UUID;
  v_display_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Household name is required' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(
    nullif(au.raw_user_meta_data->>'full_name', ''),
    split_part(au.email, '@', 1),
    'Adult'
  )
  INTO v_display_name
  FROM auth.users au
  WHERE au.id = v_user_id;

  INSERT INTO budget.household (name, owner_user_id)
  VALUES (trim(p_name), v_user_id)
  RETURNING id INTO v_household_id;

  INSERT INTO budget.household_member (
    household_id, user_id, role, display_name
  ) VALUES (
    v_household_id, v_user_id, 'adult', coalesce(v_display_name, 'Adult')
  );

  RETURN v_household_id;
END;
$$;

ALTER FUNCTION budget.create_household(TEXT) OWNER TO budget_function_owner;

REVOKE ALL ON FUNCTION budget.create_household(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.create_household(TEXT) TO authenticated;
