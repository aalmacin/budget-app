-- SQL-level isolation assertions for US2 (FR-010, FR-016, FR-017).
-- Runs automatically on `supabase db reset`. Any RAISE EXCEPTION (other than
-- the sentinel at the end) aborts the reset.
--
-- Rollback strategy: PL/pgSQL DO blocks cannot use SAVEPOINT / ROLLBACK TO
-- SAVEPOINT — those are SQL transaction-control statements and are rejected
-- by the plpgsql parser (the historical "syntax error at or near 'TO'"). We
-- instead wrap the test in a nested BEGIN ... EXCEPTION ... END sub-block
-- whose final statement RAISEs a sentinel exception. The sub-block's implicit
-- savepoint rolls back every change made inside it — synthetic auth.users
-- rows, test categories, test transactions, the role swap, and the
-- request.jwt.claims setting — so the migration leaves no residue across
-- db resets. The outer EXCEPTION clause distinguishes the sentinel from real
-- assertion failures by inspecting SQLERRM and re-raises anything else so a
-- genuine RLS regression still aborts the migration.

DO $$
DECLARE
  user_a UUID := '00000000-0000-0000-0000-00000000000a';
  user_b UUID := '00000000-0000-0000-0000-00000000000b';
  cat_a_id BIGINT;
  cat_b_id BIGINT;
  visible_count INT;
  cross_user_attempt_rows INT;
  cross_user_category_blocked BOOLEAN := FALSE;
BEGIN
  -- Inner sub-block: implicit savepoint that scopes the rollback.
  BEGIN
    -- Seed two synthetic users in auth.users so the FKs from budget.categories
    -- and budget.transactions resolve. Both rows roll back via the sentinel.
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) VALUES
      (user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rls-test-a@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false),
      (user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       'rls-test-b@example.invalid', '', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, false);

    ---------------------------------------------------------------------------
    -- Step 1: insert one category and one transaction as each user.
    --
    -- set_config(name, value, is_local := true) is the PL/pgSQL-safe
    -- equivalent of SET LOCAL for GUCs whose names contain a dot
    -- (`request.jwt.claims`). We also use it for `role` because
    -- `SET LOCAL role <ident>` is parsed as a GUC assignment whose value
    -- must be a recognised literal; the keyword form `SET LOCAL ROLE` works
    -- in plain SQL but mixing it here means juggling two patterns — one is
    -- simpler.
    ---------------------------------------------------------------------------
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',
      true
    );

    INSERT INTO budget.categories (name, kind) VALUES ('Groceries', 'expense')
      RETURNING id INTO cat_a_id;
    INSERT INTO budget.transactions (amount, occurred_on, note, category_id)
      VALUES (12.34, current_date, 'A''s groceries', cat_a_id);

    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}',
      true
    );

    INSERT INTO budget.categories (name, kind) VALUES ('Groceries', 'expense')
      RETURNING id INTO cat_b_id;
    INSERT INTO budget.transactions (amount, occurred_on, note, category_id)
      VALUES (56.78, current_date, 'B''s groceries', cat_b_id);

    ---------------------------------------------------------------------------
    -- Step 2: each user sees exactly their own rows.
    ---------------------------------------------------------------------------
    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}',
      true
    );
    SELECT count(*) INTO visible_count FROM budget.categories;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'RLS test failed: user A should see exactly 1 category, saw %', visible_count;
    END IF;
    SELECT count(*) INTO visible_count FROM budget.transactions;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'RLS test failed: user A should see exactly 1 transaction, saw %', visible_count;
    END IF;

    PERFORM set_config(
      'request.jwt.claims',
      '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}',
      true
    );
    SELECT count(*) INTO visible_count FROM budget.categories;
    IF visible_count <> 1 THEN
      RAISE EXCEPTION 'RLS test failed: user B should see exactly 1 category, saw %', visible_count;
    END IF;

    ---------------------------------------------------------------------------
    -- Step 3: user B cannot read/update/delete user A's rows by id.
    ---------------------------------------------------------------------------
    SELECT count(*) INTO cross_user_attempt_rows
      FROM budget.categories WHERE id = cat_a_id;
    IF cross_user_attempt_rows <> 0 THEN
      RAISE EXCEPTION 'RLS test failed: user B saw user A''s category (id=%)', cat_a_id;
    END IF;

    UPDATE budget.categories SET name = 'Hijacked' WHERE id = cat_a_id;
    GET DIAGNOSTICS cross_user_attempt_rows = ROW_COUNT;
    IF cross_user_attempt_rows <> 0 THEN
      RAISE EXCEPTION 'RLS test failed: user B updated user A''s category (% rows affected)',
        cross_user_attempt_rows;
    END IF;

    DELETE FROM budget.categories WHERE id = cat_a_id;
    GET DIAGNOSTICS cross_user_attempt_rows = ROW_COUNT;
    IF cross_user_attempt_rows <> 0 THEN
      RAISE EXCEPTION 'RLS test failed: user B deleted user A''s category (% rows affected)',
        cross_user_attempt_rows;
    END IF;

    ---------------------------------------------------------------------------
    -- Step 4: FR-017 — user B cannot reference user A's category in a
    -- transaction. RLS hides cat_a_id from user B, so the trigger sees NULL
    -- and raises foreign_key_violation. Either failure mode (RLS-induced NULL
    -- or trigger raise) satisfies the requirement.
    ---------------------------------------------------------------------------
    BEGIN
      INSERT INTO budget.transactions (amount, occurred_on, category_id)
        VALUES (99.00, current_date, cat_a_id);
    EXCEPTION
      WHEN foreign_key_violation OR insufficient_privilege THEN
        cross_user_category_blocked := TRUE;
    END;

    IF NOT cross_user_category_blocked THEN
      RAISE EXCEPTION 'RLS/trigger test failed: user B inserted a transaction referencing user A''s category';
    END IF;

    ---------------------------------------------------------------------------
    -- Step 5: FR-016 — same category name is allowed across users (already
    -- proved by step 1: both users have a "Groceries" category and both
    -- inserts succeeded without a unique-violation).
    ---------------------------------------------------------------------------

    -- Sentinel: triggers the implicit-savepoint rollback so all test data,
    -- the synthetic auth.users rows, the role swap, and the jwt.claims
    -- setting are discarded. The outer EXCEPTION clause swallows this
    -- specific message and re-raises anything else.
    RAISE EXCEPTION '__rls_test_complete__';
  EXCEPTION
    WHEN raise_exception THEN
      IF SQLERRM <> '__rls_test_complete__' THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'RLS test migration passed.';
END;
$$;
