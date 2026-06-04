-- T097 — Phase 7: SQL-level household isolation + lockdown assertions.
-- Runs on every `npm run db:reset`. Two properties verified:
--
--  1. Grant lockdown: direct DML (SELECT/INSERT/UPDATE/DELETE) from role
--     `authenticated` is rejected with 42501 on all 5 new household-scoped
--     tables (household, household_member, category, transaction, subscription).
--
--  2. Cross-household read isolation: with role=authenticated + a JWT claiming
--     to be a member of household A, the caller sees A's data and zero of B's.
--
-- Rollback pattern matches 20260522000003_rls_test.sql: nested
-- BEGIN ... EXCEPTION ... END with a sentinel RAISE so the implicit savepoint
-- discards every change inside the sub-block (synthetic auth.users rows,
-- household rows, member rows, transaction rows, role swap, jwt.claims).
--
-- Sequencing matters: seed everything as postgres FIRST, then switch role to
-- authenticated. We don't switch back because PL/pgSQL has no clean way to
-- re-escalate to a superuser mid-block, and the sub-block rollback restores
-- the original session role for us at the end.

DO $$
DECLARE
  user_a UUID := '00000000-0000-0000-0000-00000000001a';
  user_b UUID := '00000000-0000-0000-0000-00000000001b';
  -- user_c starts with NO household membership; used by Part 3 to exercise
  -- the create_household happy path (and the auth.users read it depends on).
  user_c UUID := '00000000-0000-0000-0000-00000000001c';
  household_a UUID;
  household_b UUID;
  household_c UUID;
  v_seed_cat UUID;
  visible_count INT;
  blocked BOOLEAN;
  i INT;
  v_table TEXT;
  v_qual TEXT;
  v_member_display TEXT;
BEGIN
  BEGIN
    ---------------------------------------------------------------------------
    -- Seed: two synthetic auth users, two households, two transactions.
    ---------------------------------------------------------------------------
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES
      (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'household-rls-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
      (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'household-rls-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
      (user_c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'household-rls-c@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false);

    INSERT INTO public.household (name, owner_user_id) VALUES ('A', user_a)
      RETURNING id INTO household_a;
    INSERT INTO public.household (name, owner_user_id) VALUES ('B', user_b)
      RETURNING id INTO household_b;

    INSERT INTO public.household_member (household_id, user_id, role, display_name)
      VALUES (household_a, user_a, 'adult', 'A_adult');
    INSERT INTO public.household_member (household_id, user_id, role, display_name)
      VALUES (household_b, user_b, 'adult', 'B_adult');

    -- One transaction per household, both referencing the system-global
    -- "Income" seed (avoids the deferred member_household trigger).
    SELECT id INTO v_seed_cat
      FROM public.category WHERE household_id IS NULL AND name = 'Income';
    INSERT INTO public.transaction (
      id, household_id, type, amount_cents, occurred_on, category_id
    ) VALUES
      (gen_random_uuid(), household_a, 'income', 100, current_date, v_seed_cat),
      (gen_random_uuid(), household_b, 'income', 200, current_date, v_seed_cat);

    ---------------------------------------------------------------------------
    -- Part 1: lockdown — role=authenticated cannot touch any of the 5 tables.
    ---------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);

    FOR i IN 1..5 LOOP
      v_table := (ARRAY['household', 'household_member', 'category', 'transaction', 'subscription'])[i];
      v_qual  := 'public.' || v_table;

      -- SELECT
      blocked := FALSE;
      BEGIN
        EXECUTE format('SELECT 1 FROM %s LIMIT 1', v_qual);
      EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE;
      END;
      IF NOT blocked THEN
        RAISE EXCEPTION 'Lockdown test failed: authenticated could SELECT %', v_qual;
      END IF;

      -- DELETE (where 1=0 → no rows to touch even if grant passed)
      blocked := FALSE;
      BEGIN
        EXECUTE format('DELETE FROM %s WHERE 1=0', v_qual);
      EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE;
      END;
      IF NOT blocked THEN
        RAISE EXCEPTION 'Lockdown test failed: authenticated could DELETE %', v_qual;
      END IF;

      -- UPDATE
      blocked := FALSE;
      BEGIN
        EXECUTE format('UPDATE %s SET updated_at = now() WHERE 1=0', v_qual);
      EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE;
      END;
      IF NOT blocked THEN
        RAISE EXCEPTION 'Lockdown test failed: authenticated could UPDATE %', v_qual;
      END IF;
    END LOOP;

    -- INSERT — table-specific column lists. Each expected to raise 42501.
    FOR i IN 1..5 LOOP
      v_table := (ARRAY['household', 'household_member', 'category', 'transaction', 'subscription'])[i];
      blocked := FALSE;
      BEGIN
        CASE v_table
          WHEN 'household' THEN
            INSERT INTO public.household (name, owner_user_id) VALUES ('X', user_a);
          WHEN 'household_member' THEN
            INSERT INTO public.household_member (household_id, role, display_name)
              VALUES (household_a, 'adult', 'X');
          WHEN 'category' THEN
            INSERT INTO public.category (household_id, name) VALUES (household_a, 'X');
          WHEN 'transaction' THEN
            INSERT INTO public.transaction (id, household_id, type, amount_cents, occurred_on, category_id)
              VALUES (gen_random_uuid(), household_a, 'expense', 1, current_date, v_seed_cat);
          WHEN 'subscription' THEN
            INSERT INTO public.subscription (household_id, merchant, amount_cents, category_id, cadence, next_renewal_at)
              VALUES (household_a, 'X', 1, v_seed_cat, 'monthly', current_date);
        END CASE;
      EXCEPTION WHEN insufficient_privilege THEN blocked := TRUE;
      END;
      IF NOT blocked THEN
        RAISE EXCEPTION 'Lockdown test failed: authenticated could INSERT into public.%', v_table;
      END IF;
    END LOOP;

    ---------------------------------------------------------------------------
    -- Part 2: cross-household read isolation, routed through the SECURITY
    -- DEFINER RPCs that `authenticated` is granted to call (direct table SELECT
    -- is intentionally revoked by the lockdown verified in Part 1).
    ---------------------------------------------------------------------------
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000001a","role":"authenticated"}',
      true
    );

    -- User A: get_current_household() returns A's id, list_transactions sees 1.
    IF public.get_current_household() <> household_a THEN
      RAISE EXCEPTION 'Cross-household test failed: A''s get_current_household() did not return household_a';
    END IF;
    SELECT count(*) INTO visible_count FROM public.list_transactions('{}'::jsonb);
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Cross-household test failed: A saw % transactions, expected 1', visible_count;
    END IF;

    -- User B: same shape, scoped to household_b.
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000001b","role":"authenticated"}',
      true
    );
    IF public.get_current_household() <> household_b THEN
      RAISE EXCEPTION 'Cross-household test failed: B''s get_current_household() did not return household_b';
    END IF;
    SELECT count(*) INTO visible_count FROM public.list_transactions('{}'::jsonb);
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'Cross-household test failed: B saw % transactions, expected 1 (their own)', visible_count;
    END IF;

    ---------------------------------------------------------------------------
    -- Part 3: create_household happy path — exercises the auth.users read
    -- helper end-to-end. Without public.current_user_display_name() granted
    -- to budget_function_owner, this section raises `permission denied for
    -- table users` and fails db:reset — guarding against the C1 regression
    -- reported via /onboarding/create-household on 2026-05-24.
    ---------------------------------------------------------------------------
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000001c","role":"authenticated"}',
      true
    );

    household_c := public.create_household('C');
    IF household_c IS NULL THEN
      RAISE EXCEPTION 'create_household test failed: returned NULL household id';
    END IF;

    -- Verification routed through list_household_members() RPC because
    -- direct table SELECT is blocked by the lockdown verified in Part 1.
    SELECT m.display_name INTO v_member_display
    FROM public.list_household_members() m
    WHERE m.user_id = user_c AND m.role = 'adult';
    IF v_member_display IS NULL THEN
      RAISE EXCEPTION 'create_household test failed: no adult member row for user_c';
    END IF;
    -- Expected: email local-part 'household-rls-c' (raw_user_meta_data is empty).
    IF v_member_display <> 'household-rls-c' THEN
      RAISE EXCEPTION 'create_household test failed: display_name was % (expected household-rls-c)', v_member_display;
    END IF;

    -- Sentinel rollback.
    RAISE EXCEPTION '__household_rls_test_complete__';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> '__household_rls_test_complete__' THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'Household RLS test migration passed.';
END;
$$;
