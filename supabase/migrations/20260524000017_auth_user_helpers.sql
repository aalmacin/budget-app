-- T055a — Phase 7 follow-up: narrow auth.users read helpers.
-- File runs BEFORE 20260524000018_household_rls_test.sql, which exercises
-- create_household end-to-end and therefore needs these helpers to exist.
--
-- Why this exists: `public.create_household` (T064) and `public.add_adult_by_email`
-- (T065) need to read `auth.users` to derive a display_name and resolve an
-- account by email. Both RPCs are owned by `budget_function_owner`, which
-- inherits from `authenticated`. The `authenticated` role does NOT have SELECT
-- on `auth.users` in Supabase (it only gets EXECUTE on a handful of auth.*
-- helpers like auth.uid()), so the RPCs failed at runtime with
-- `permission denied for table users` (reported via /onboarding/create-household
-- on 2026-05-24).
--
-- Resolution per Constitution Principle II: rather than handing
-- `budget_function_owner` broad SELECT on auth.users (which would leak PII for
-- every account in the project to every Phase 7 RPC), expose only the two
-- column-scoped reads the call sites actually need via SECURITY DEFINER
-- helpers owned by `postgres`. The helpers run as their owner (postgres has
-- SELECT on auth.users by default) but EXECUTE is granted only to the
-- function-owner role.

CREATE OR REPLACE FUNCTION public.current_user_display_name()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT coalesce(
    nullif(au.raw_user_meta_data->>'full_name', ''),
    split_part(au.email, '@', 1),
    'Adult'
  )
  FROM auth.users au
  WHERE au.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_display_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_display_name() TO budget_function_owner;


CREATE OR REPLACE FUNCTION public.resolve_user_by_email(p_email TEXT)
RETURNS TABLE(user_id UUID, display_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    au.id,
    coalesce(
      nullif(au.raw_user_meta_data->>'full_name', ''),
      split_part(au.email, '@', 1),
      'Adult'
    )
  FROM auth.users au
  WHERE lower(au.email) = lower(trim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_user_by_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_by_email(TEXT) TO budget_function_owner;


-- bootstrap_household solves the create_household chicken-and-egg: at the
-- moment the household row is inserted, the caller has zero memberships, so
-- the household RLS WITH CHECK (household_id ∈ caller's memberships) fails.
-- An OR-carve-out in WITH CHECK was attempted and reverted (a STABLE-function
-- caching interaction with the SECURITY DEFINER helper subquery made the
-- combined WITH CHECK evaluate as NULL, which the planner treats as policy
-- violation). budget_function_owner cannot use `SET LOCAL row_security = off`
-- (the role lacks BYPASSRLS), so the bootstrap is delegated to this
-- postgres-owned helper that bypasses RLS by being owned by a superuser.
-- The function is narrowly scoped to the create-household operation:
--   (a) verifies p_user_id matches the caller's auth.uid() so a malicious
--       budget_function_owner caller can't bootstrap a household for someone
--       else;
--   (b) inserts the household with owner_user_id = p_user_id;
--   (c) inserts the first adult member row.
-- EXECUTE is granted only to budget_function_owner (the function-owner role
-- of every Phase 7 RPC); end users invoke create_household, not this helper.

CREATE OR REPLACE FUNCTION public.bootstrap_household(
  p_user_id      UUID,
  p_name         TEXT,
  p_display_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'bootstrap_household: p_user_id must match auth.uid()'
      USING ERRCODE = '28000';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'bootstrap_household: name is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.household (name, owner_user_id)
  VALUES (trim(p_name), p_user_id)
  RETURNING id INTO v_household_id;

  INSERT INTO public.household_member (
    household_id, user_id, role, display_name
  ) VALUES (
    v_household_id, p_user_id, 'adult', coalesce(p_display_name, 'Adult')
  );

  RETURN v_household_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_household(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_household(UUID, TEXT, TEXT) TO budget_function_owner;
