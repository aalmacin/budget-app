-- T060 — Phase 7: public.auth_user_household_ids() helper +
-- household/household_member RLS policies (deferred until the helper exists).
--
-- The helper queries public.household_member, which must exist first; the
-- household and household_member policies reference the helper, so they
-- must come after it. Hence this migration sits between household_member
-- (20260524000002) and category (20260524000005).
--
-- Marked STABLE so the planner can memoize per statement. SECURITY INVOKER
-- so it sees the caller's auth.uid() rather than the function owner's role.

CREATE OR REPLACE FUNCTION public.auth_user_household_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM public.household_member hm
  WHERE hm.user_id = auth.uid()
    AND hm.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION public.auth_user_household_ids() IS
  'Returns the household_ids the current auth user actively belongs to. Used by RLS policies.';

-- The create_household chicken-and-egg (caller has zero memberships at the
-- moment the household + first member rows are created) is handled OUTSIDE
-- this policy by a postgres-owned bootstrap helper that bypasses RLS for
-- the two inserts (see public.bootstrap_household in
-- 20260524000017_auth_user_helpers.sql). An OR-carve-out in WITH CHECK was
-- attempted and reverted: combining the helper subquery with an
-- `OR owner_user_id = auth.uid()` branch in a single WITH CHECK expression
-- caused the WITH CHECK to evaluate as NULL on this Postgres version
-- (STABLE-function caching interaction with the SECURITY DEFINER subquery),
-- which the planner treats as policy violation. The bootstrap-helper
-- approach keeps this policy clean and behaves identically.
CREATE POLICY household_household_isolation ON public.household
  FOR ALL
  TO public
  USING (id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (id IN (SELECT * FROM public.auth_user_household_ids()));

CREATE POLICY household_member_household_isolation ON public.household_member
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM public.auth_user_household_ids()));
