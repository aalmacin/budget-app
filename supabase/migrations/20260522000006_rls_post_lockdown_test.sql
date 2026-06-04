-- Post-lockdown verification — runs after 20260522000005_lockdown_budget_grants.sql.
--
-- Verifies that `authenticated` cannot directly read or write
-- `public.categories` / `public.transactions` — proves the grant lockdown is
-- in force and closes the `pg_graphql_authenticated_table_exposed` lint for
-- both tables.
--
-- What this migration does NOT validate, and why:
-- The SECURITY DEFINER + FORCE ROW LEVEL SECURITY + `TO public` policy
-- combination is what future Category/Transaction RPCs will rely on for
-- per-user row filtering. We deliberately do NOT exercise that pattern here
-- because every function defined in this migration would be owned by
-- `postgres` (the migration role, a superuser), and PostgreSQL superusers
-- ALWAYS bypass RLS — regardless of FORCE RLS. A SECURITY DEFINER function
-- owned by `postgres` therefore returns unfiltered rows, which is not
-- representative of the production RPC path. Validating the RPC pattern
-- requires a non-superuser function-owner role with explicit table grants;
-- that pattern is introduced (and tested) by the first CRUD feature.
-- See research.md R10 for the full rationale.
--
-- Rollback pattern matches 20260522000003_rls_test.sql: nested
-- BEGIN ... EXCEPTION ... END with a sentinel RAISE EXCEPTION so the
-- implicit savepoint discards the role swap and any state the sub-block
-- touched (typically nothing — every operation here is expected to be
-- rejected by the permission check before it can write).

DO $$
DECLARE
  direct_select_blocked BOOLEAN;
  direct_insert_blocked BOOLEAN;
  direct_update_blocked BOOLEAN;
  direct_delete_blocked BOOLEAN;
BEGIN
  BEGIN
    PERFORM set_config('role', 'authenticated', true);

    ---------------------------------------------------------------------------
    -- public.categories — all four DML verbs must be rejected with 42501.
    ---------------------------------------------------------------------------
    direct_select_blocked := FALSE;
    direct_insert_blocked := FALSE;
    direct_update_blocked := FALSE;
    direct_delete_blocked := FALSE;

    BEGIN
      PERFORM 1 FROM public.categories;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_select_blocked := TRUE;
    END;
    IF NOT direct_select_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could SELECT public.categories (expected permission denied)';
    END IF;

    BEGIN
      INSERT INTO public.categories (name, kind) VALUES ('ShouldFail', 'expense');
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_insert_blocked := TRUE;
    END;
    IF NOT direct_insert_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could INSERT into public.categories (expected permission denied)';
    END IF;

    BEGIN
      UPDATE public.categories SET name = 'Hijacked' WHERE id = -1;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_update_blocked := TRUE;
    END;
    IF NOT direct_update_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could UPDATE public.categories (expected permission denied)';
    END IF;

    BEGIN
      DELETE FROM public.categories WHERE id = -1;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_delete_blocked := TRUE;
    END;
    IF NOT direct_delete_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could DELETE from public.categories (expected permission denied)';
    END IF;

    ---------------------------------------------------------------------------
    -- public.transactions — same four-verb check.
    ---------------------------------------------------------------------------
    direct_select_blocked := FALSE;
    direct_insert_blocked := FALSE;
    direct_update_blocked := FALSE;
    direct_delete_blocked := FALSE;

    BEGIN
      PERFORM 1 FROM public.transactions;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_select_blocked := TRUE;
    END;
    IF NOT direct_select_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could SELECT public.transactions (expected permission denied)';
    END IF;

    BEGIN
      INSERT INTO public.transactions (amount, occurred_on, category_id)
        VALUES (1.00, current_date, -1);
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_insert_blocked := TRUE;
    END;
    IF NOT direct_insert_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could INSERT into public.transactions (expected permission denied)';
    END IF;

    BEGIN
      UPDATE public.transactions SET amount = 0 WHERE id = -1;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_update_blocked := TRUE;
    END;
    IF NOT direct_update_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could UPDATE public.transactions (expected permission denied)';
    END IF;

    BEGIN
      DELETE FROM public.transactions WHERE id = -1;
    EXCEPTION
      WHEN insufficient_privilege THEN
        direct_delete_blocked := TRUE;
    END;
    IF NOT direct_delete_blocked THEN
      RAISE EXCEPTION 'Lockdown test failed: authenticated could DELETE from public.transactions (expected permission denied)';
    END IF;

    -- Sentinel: triggers the implicit-savepoint rollback so the role swap
    -- and any incidental sub-block state is discarded.
    RAISE EXCEPTION '__rls_post_lockdown_test_complete__';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> '__rls_post_lockdown_test_complete__' THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'RLS post-lockdown test migration passed.';
END;
$$;
