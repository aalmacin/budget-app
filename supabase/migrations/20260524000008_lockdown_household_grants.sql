-- T063 — Phase 7: revoke direct DML grants on every household-scoped table
-- and grant them to budget_function_owner instead. Mirrors T045 from Phase 6.
--
-- After this migration, client code cannot reach these tables except via
-- supabase.rpc(...) → a SECURITY DEFINER function owned by
-- budget_function_owner. Direct supabase.from(...).select/insert/update/delete
-- raises 42501 insufficient_privilege. The FORCE ROW LEVEL SECURITY +
-- TO public policy combo (set up per table) keeps RLS in the loop even
-- though the RPC runs as budget_function_owner.

REVOKE ALL ON public.household          FROM authenticated, anon;
REVOKE ALL ON public.household_member   FROM authenticated, anon;
REVOKE ALL ON public.category           FROM authenticated, anon;
REVOKE ALL ON public.transaction        FROM authenticated, anon;
REVOKE ALL ON public.subscription       FROM authenticated, anon;

-- budget_function_owner needs full DML on every household-scoped table so
-- SECURITY DEFINER RPCs can actually mutate. It does NOT get bypassrls —
-- the FORCE RLS + TO public policy filters the RPC's reads/writes by the
-- caller's auth.uid() through public.auth_user_household_ids().
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household          TO budget_function_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_member   TO budget_function_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category           TO budget_function_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction        TO budget_function_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription       TO budget_function_owner;
