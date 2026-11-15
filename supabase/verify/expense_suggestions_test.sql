-- Behaviour test for 20261115000000_expense_suggestions.sql.
-- Run against a LOCAL database only (psql -v ON_ERROR_STOP=1 -f ...).
-- Everything happens inside one transaction that is rolled back.

BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('a0000000-0000-0000-0000-00000000000a', 'a@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'b@test.local');

INSERT INTO public.household (id, name, currency, owner_user_id) VALUES
  ('a1000000-0000-0000-0000-000000000000', 'House A', 'CAD', 'a0000000-0000-0000-0000-00000000000a'),
  ('b1000000-0000-0000-0000-000000000000', 'House B', 'CAD', 'b0000000-0000-0000-0000-00000000000b');

INSERT INTO public.household_member (household_id, user_id, role, display_name) VALUES
  ('a1000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-00000000000a', 'adult', 'Adult A'),
  ('b1000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-00000000000b', 'adult', 'Adult B');

INSERT INTO public.category (id, household_id, name, kind, default_essential_pct) VALUES
  ('a2000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000', 'Groceries', 'expense', 100),
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000000', 'Salary', 'income', 100),
  ('b2000000-0000-0000-0000-000000000000', 'b1000000-0000-0000-0000-000000000000', 'Groceries', 'expense', 100);

INSERT INTO public.subscription (id, household_id, merchant, amount_cents, category_id, cadence, next_renewal_at, type)
VALUES ('a3000000-0000-0000-0000-000000000000', 'a1000000-0000-0000-0000-000000000000',
        'Etsy', 1435, 'a2000000-0000-0000-0000-000000000000', 'monthly', current_date - 5, 'expense');

DO $$
DECLARE
  r JSONB;
  ok BOOLEAN;
  ctx JSONB;
BEGIN
  -- Agent (connector role) creates a suggestion.
  r := public.suggest_expense('a1000000-0000-0000-0000-000000000000',
       jsonb_build_object('merchant', 'Costco', 'amount_cents', 8421,
                          'occurred_on', current_date - 1,
                          'category_id', 'a2000000-0000-0000-0000-000000000000',
                          'source_ref', 'gmail:msg-1', 'notes', 'Receipt email'));
  ASSERT r->>'status' = 'created', 'first suggestion should be created';

  -- Same email again is a duplicate, not a second row.
  r := public.suggest_expense('a1000000-0000-0000-0000-000000000000',
       jsonb_build_object('merchant', 'Costco', 'amount_cents', 8421,
                          'occurred_on', current_date - 1, 'source_ref', 'gmail:msg-1'));
  ASSERT r->>'status' = 'duplicate', 'same source_ref should be a duplicate';

  -- Linked to a recurring expense: category defaults from the subscription.
  r := public.suggest_expense('a1000000-0000-0000-0000-000000000000',
       jsonb_build_object('merchant', 'Etsy', 'amount_cents', 1435,
                          'occurred_on', current_date - 5,
                          'subscription_id', 'a3000000-0000-0000-0000-000000000000',
                          'source_ref', 'gmail:msg-2'));
  ASSERT (SELECT category_id FROM public.expense_suggestion WHERE id = (r->>'id')::UUID)
         = 'a2000000-0000-0000-0000-000000000000', 'category should default from subscription';

  -- Validation: another household's category, an income category, bad amount, bad date.
  BEGIN
    PERFORM public.suggest_expense('a1000000-0000-0000-0000-000000000000',
      jsonb_build_object('merchant', 'X', 'amount_cents', 100, 'occurred_on', current_date,
                         'category_id', 'b2000000-0000-0000-0000-000000000000'));
    ok := false;
  EXCEPTION WHEN sqlstate '22023' THEN ok := true;
  END;
  ASSERT ok, 'foreign category must be rejected';

  BEGIN
    PERFORM public.suggest_expense('a1000000-0000-0000-0000-000000000000',
      jsonb_build_object('merchant', 'X', 'amount_cents', 100, 'occurred_on', current_date,
                         'category_id', 'a2000000-0000-0000-0000-000000000001'));
    ok := false;
  EXCEPTION WHEN sqlstate '22023' THEN ok := true;
  END;
  ASSERT ok, 'income category must be rejected';

  BEGIN
    PERFORM public.suggest_expense('a1000000-0000-0000-0000-000000000000',
      jsonb_build_object('merchant', 'X', 'amount_cents', '14.35', 'occurred_on', current_date));
    ok := false;
  EXCEPTION WHEN sqlstate '22023' THEN ok := true;
  END;
  ASSERT ok, 'fractional amount_cents must be rejected';

  BEGIN
    PERFORM public.suggest_expense('a1000000-0000-0000-0000-000000000000',
      jsonb_build_object('merchant', 'X', 'amount_cents', 100, 'occurred_on', current_date + 30));
    ok := false;
  EXCEPTION WHEN sqlstate '22023' THEN ok := true;
  END;
  ASSERT ok, 'far-future date must be rejected';

  ctx := public.agent_budget_context('a1000000-0000-0000-0000-000000000000', 30);
  ASSERT jsonb_array_length(ctx->'expense_categories') = 1, 'context: only expense categories of A';
  ASSERT jsonb_array_length(ctx->'recurring_expenses') = 1, 'context: Etsy recurring';
  ASSERT jsonb_array_length(ctx->'suggestions') = 2, 'context: two suggestions';

  -- House B gets one too (for isolation checks below).
  PERFORM public.suggest_expense('b1000000-0000-0000-0000-000000000000',
    jsonb_build_object('merchant', 'B shop', 'amount_cents', 500, 'occurred_on', current_date,
                       'source_ref', 'gmail:msg-1'));
END $$;

-- ---------------------------------------------------------------------------
-- Signed-in member of House A.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

DO $$
DECLARE
  v_sug UUID;
  v_tx  UUID;
  v_tx2 UUID;
  ok BOOLEAN;
BEGIN
  ASSERT (SELECT count(*) FROM public.list_expense_suggestions()) = 2, 'A sees only its 2 suggestions';

  SELECT id INTO v_sug FROM public.list_expense_suggestions() WHERE merchant = 'Costco';
  ASSERT (SELECT count(*) FROM public.get_expense_suggestion(v_sug)) = 1, 'A can load its suggestion';

  -- Saving under the suggestion's id is idempotent.
  v_tx  := public.log_expense(jsonb_build_object('id', v_sug, 'amount_cents', 8421,
            'category_id', 'a2000000-0000-0000-0000-000000000000', 'notes', 'Costco',
            'occurred_on', current_date - 1));
  v_tx2 := public.log_expense(jsonb_build_object('id', v_sug, 'amount_cents', 8421,
            'category_id', 'a2000000-0000-0000-0000-000000000000', 'notes', 'Costco',
            'occurred_on', current_date - 1));
  ASSERT v_tx = v_sug AND v_tx2 = v_sug, 'transaction id should equal suggestion id';
  PERFORM set_config('test.a_tx', v_tx::TEXT, true);

  PERFORM public.accept_expense_suggestion(v_sug, v_tx);
  ASSERT (SELECT count(*) FROM public.list_expense_suggestions()) = 1, 'accepted suggestion leaves the list';

  SELECT id INTO v_sug FROM public.list_expense_suggestions() WHERE merchant = 'Etsy';
  PERFORM public.dismiss_expense_suggestion(v_sug);
  ASSERT (SELECT count(*) FROM public.list_expense_suggestions()) = 0, 'dismissed suggestion leaves the list';

  -- Direct table access and agent functions are off-limits to app users.
  BEGIN
    PERFORM 1 FROM public.expense_suggestion;
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  ASSERT ok, 'authenticated must not read the table directly';

  BEGIN
    PERFORM public.suggest_expense('a1000000-0000-0000-0000-000000000000',
      jsonb_build_object('merchant', 'X', 'amount_cents', 1, 'occurred_on', current_date));
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  ASSERT ok, 'authenticated must not call suggest_expense';

  BEGIN
    PERFORM public.agent_budget_context('b1000000-0000-0000-0000-000000000000', 30);
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  ASSERT ok, 'authenticated must not call agent_budget_context';
END $$;

-- ---------------------------------------------------------------------------
-- Signed-in member of House B cannot touch A's rows.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

DO $$
DECLARE
  ok BOOLEAN;
BEGIN
  ASSERT (SELECT count(*) FROM public.list_expense_suggestions()) = 1, 'B sees only its own suggestion';

  BEGIN
    PERFORM public.accept_expense_suggestion(
      (SELECT id FROM public.list_expense_suggestions() LIMIT 1),
      current_setting('test.a_tx')::UUID);
    ok := false;
  EXCEPTION WHEN sqlstate '22023' THEN ok := true;
  END;
  ASSERT ok, 'accepting with a transaction B does not own must fail';
END $$;

-- Anonymous callers get nothing.
SET LOCAL ROLE anon;
DO $$
DECLARE ok BOOLEAN;
BEGIN
  BEGIN
    PERFORM public.list_expense_suggestions();
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  ASSERT ok, 'anon must not list suggestions';
END $$;

RESET ROLE;
SELECT 'expense_suggestions_test: all assertions passed' AS result;
ROLLBACK;
