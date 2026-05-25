-- Fix: budget.auth_user_household_ids() must be SECURITY DEFINER to avoid
-- infinite recursion through the household_member RLS policy.
--
-- The helper queries budget.household_member. The RLS policy on
-- budget.household_member is `household_id IN (SELECT * FROM
-- budget.auth_user_household_ids())`. As SECURITY INVOKER under any non-
-- superuser role, the helper's SELECT triggers the policy, which calls
-- the helper, which triggers the policy, ... infinite recursion.
--
-- SECURITY DEFINER (owner = postgres, the migration role, a superuser)
-- bypasses RLS on the inner SELECT and breaks the cycle. auth.uid() still
-- resolves to the caller's id (it reads request.jwt.claims from session
-- state, not the function's effective role).
--
-- The helper only ever returns the caller's own household_ids — there's no
-- additional filtering RLS could add that we'd want, so the bypass is safe.

CREATE OR REPLACE FUNCTION budget.auth_user_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM budget.household_member hm
  WHERE hm.user_id = auth.uid()
    AND hm.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION budget.auth_user_household_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.auth_user_household_ids() TO authenticated, anon;

COMMENT ON FUNCTION budget.auth_user_household_ids() IS
  'Returns the household_ids the current auth user actively belongs to. SECURITY DEFINER to bypass RLS on household_member and break the policy/helper recursion cycle.';
