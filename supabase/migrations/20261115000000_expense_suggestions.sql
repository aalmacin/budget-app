-- 2026-11-15: Suggested expenses.
-- An AI agent (reading the household's email through the Supabase connector)
-- proposes expenses. A suggestion never touches public.transaction on its own:
-- it shows in the dashboard's "Suggested expenses" block and only becomes a
-- transaction when a household member reviews it in the normal add form and
-- saves. Dismissed suggestions are kept so the same email is never re-suggested.

CREATE TABLE public.expense_suggestion (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     UUID NOT NULL REFERENCES public.household(id) ON DELETE CASCADE,
  merchant         TEXT NOT NULL CHECK (length(btrim(merchant)) BETWEEN 1 AND 100),
  amount_cents     BIGINT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000),
  occurred_on      DATE NOT NULL,
  category_id      UUID REFERENCES public.category(id) ON DELETE SET NULL,
  subscription_id  UUID REFERENCES public.subscription(id) ON DELETE SET NULL,
  notes            TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 300),
  source           TEXT NOT NULL DEFAULT 'email' CHECK (source ~ '^[a-z_]{1,40}$'),
  source_ref       TEXT CHECK (length(source_ref) BETWEEN 1 AND 300),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'dismissed')),
  transaction_id   UUID REFERENCES public.transaction(id) ON DELETE SET NULL,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One suggestion per source item (e.g. Gmail message id), even after dismissal.
CREATE UNIQUE INDEX expense_suggestion_source_ref_uniq
  ON public.expense_suggestion (household_id, source, source_ref)
  WHERE source_ref IS NOT NULL;

CREATE INDEX expense_suggestion_household_pending
  ON public.expense_suggestion (household_id, occurred_on DESC)
  WHERE status = 'pending';

CREATE TRIGGER expense_suggestion_set_updated_at
  BEFORE UPDATE ON public.expense_suggestion
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

ALTER TABLE public.expense_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_suggestion FORCE ROW LEVEL SECURITY;

CREATE POLICY expense_suggestion_household_isolation ON public.expense_suggestion
  FOR ALL
  TO public
  USING (household_id IN (SELECT * FROM public.auth_user_household_ids()))
  WITH CHECK (household_id IN (SELECT * FROM public.auth_user_household_ids()));

REVOKE ALL ON public.expense_suggestion FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_suggestion TO budget_function_owner;

-- ===========================================================================
-- App-facing RPCs (signed-in household members).
-- ===========================================================================

-- list_expense_suggestions() — pending suggestions for the dashboard block.
CREATE OR REPLACE FUNCTION public.list_expense_suggestions()
RETURNS TABLE (
  id                     UUID,
  merchant               TEXT,
  amount_cents           BIGINT,
  occurred_on            DATE,
  category_id            UUID,
  category_name          TEXT,
  subscription_id        UUID,
  subscription_merchant  TEXT,
  notes                  TEXT,
  source                 TEXT,
  created_at             TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.occurred_on,
         s.category_id, c.name,
         sub.id, sub.merchant,
         s.notes, s.source, s.created_at
  FROM public.expense_suggestion s
  LEFT JOIN public.category c ON c.id = s.category_id
  LEFT JOIN public.subscription sub
         ON sub.id = s.subscription_id AND sub.active AND sub.type = 'expense'
  WHERE s.household_id = public.get_current_household()
    AND s.status = 'pending'
  ORDER BY s.occurred_on DESC, s.created_at DESC
  LIMIT 50
$$;
ALTER FUNCTION public.list_expense_suggestions() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_expense_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_expense_suggestions() TO authenticated;

-- get_expense_suggestion(p_id) — one pending suggestion, for form prefill.
CREATE OR REPLACE FUNCTION public.get_expense_suggestion(p_id UUID)
RETURNS TABLE (
  id                     UUID,
  merchant               TEXT,
  amount_cents           BIGINT,
  occurred_on            DATE,
  category_id            UUID,
  category_name          TEXT,
  default_essential_pct  SMALLINT,
  subscription_id        UUID,
  notes                  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.occurred_on,
         s.category_id, c.name, c.default_essential_pct,
         sub.id, s.notes
  FROM public.expense_suggestion s
  LEFT JOIN public.category c ON c.id = s.category_id
  LEFT JOIN public.subscription sub
         ON sub.id = s.subscription_id AND sub.active AND sub.type = 'expense'
  WHERE s.id = p_id
    AND s.household_id = public.get_current_household()
    AND s.status = 'pending'
$$;
ALTER FUNCTION public.get_expense_suggestion(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_expense_suggestion(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_expense_suggestion(UUID) TO authenticated;

-- dismiss_expense_suggestion(p_id) — hide it; the row stays so the agent's
-- source_ref dedupe keeps it from coming back.
CREATE OR REPLACE FUNCTION public.dismiss_expense_suggestion(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.expense_suggestion
     SET status = 'dismissed', resolved_at = now()
   WHERE id = p_id
     AND household_id = v_household_id
     AND status = 'pending';
END;
$$;
ALTER FUNCTION public.dismiss_expense_suggestion(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.dismiss_expense_suggestion(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dismiss_expense_suggestion(UUID) TO authenticated;

-- accept_expense_suggestion(p_id, p_transaction_id) — called right after the
-- reviewed expense is saved. Idempotent; the transaction must be the caller's.
CREATE OR REPLACE FUNCTION public.accept_expense_suggestion(p_id UUID, p_transaction_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transaction t
     WHERE t.id = p_transaction_id
       AND t.household_id = v_household_id
       AND t.type = 'expense'
  ) THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id USING ERRCODE = '22023';
  END IF;

  UPDATE public.expense_suggestion
     SET status = 'accepted',
         transaction_id = p_transaction_id,
         resolved_at = now()
   WHERE id = p_id
     AND household_id = v_household_id
     AND status = 'pending';
END;
$$;
ALTER FUNCTION public.accept_expense_suggestion(UUID, UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.accept_expense_suggestion(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_expense_suggestion(UUID, UUID) TO authenticated;

-- ===========================================================================
-- Agent-facing functions (Supabase connector only).
--
-- RLS bypass justification (constitution Principle III): the agent has no
-- Supabase Auth session, so auth.uid()-based policies cannot scope it. These
-- functions are SECURITY INVOKER and EXECUTE is revoked from anon and
-- authenticated, so they only run for the connector's postgres role (which
-- already bypasses RLS). Each one is pinned to the explicit p_household_id and
-- touches nothing but expense_suggestion for writes. Same pattern as the
-- postgres-owned public.bootstrap_household helper.
-- ===========================================================================

-- agent_budget_context(p_household_id, p_recent_days) — everything the agent
-- needs to build good suggestions and avoid duplicates, in one call.
CREATE OR REPLACE FUNCTION public.agent_budget_context(
  p_household_id UUID,
  p_recent_days  INT DEFAULT 45
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_days INT := least(greatest(coalesce(p_recent_days, 45), 1), 120);
  v_household public.household;
BEGIN
  SELECT * INTO v_household FROM public.household WHERE id = p_household_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Household % not found', p_household_id USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object(
    'household', jsonb_build_object(
      'id', v_household.id,
      'name', v_household.name,
      'currency', v_household.currency,
      'timezone', v_household.timezone,
      'today', (now() AT TIME ZONE v_household.timezone)::DATE
    ),
    'expense_categories', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'default_essential_pct', c.default_essential_pct
             ) ORDER BY c.name)
      FROM public.category c
      WHERE c.household_id = p_household_id AND c.kind = 'expense'
    ), '[]'::JSONB),
    'recurring_expenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id,
               'merchant', s.merchant,
               'amount_cents', s.amount_cents,
               'cadence', s.cadence,
               'next_renewal_at', s.next_renewal_at,
               'category_id', s.category_id
             ) ORDER BY s.merchant)
      FROM public.subscription s
      WHERE s.household_id = p_household_id AND s.active AND s.type = 'expense'
    ), '[]'::JSONB),
    'recent_expenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'occurred_on', t.occurred_on,
               'amount_cents', t.amount_cents,
               'merchant', t.notes,
               'category_id', t.category_id,
               'subscription_id', t.subscription_id
             ) ORDER BY t.occurred_on DESC, t.created_at DESC)
      FROM public.transaction t
      WHERE t.household_id = p_household_id
        AND t.type = 'expense'
        AND t.occurred_on >= current_date - v_days
    ), '[]'::JSONB),
    'suggestions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', s.id,
               'status', s.status,
               'merchant', s.merchant,
               'amount_cents', s.amount_cents,
               'occurred_on', s.occurred_on,
               'source', s.source,
               'source_ref', s.source_ref
             ) ORDER BY s.created_at DESC)
      FROM public.expense_suggestion s
      WHERE s.household_id = p_household_id
        AND s.created_at >= now() - make_interval(days => v_days)
    ), '[]'::JSONB)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.agent_budget_context(UUID, INT) FROM PUBLIC, anon, authenticated;

-- suggest_expense(p_household_id, p jsonb) — the only write the agent makes.
-- Required keys: merchant, amount_cents, occurred_on
-- Optional: category_id, subscription_id, notes, source, source_ref
-- Returns {"status": "created" | "duplicate", "id": <suggestion id>}.
CREATE OR REPLACE FUNCTION public.suggest_expense(p_household_id UUID, p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_merchant    TEXT   := btrim(coalesce(p->>'merchant', ''));
  v_amount      BIGINT;
  v_occurred    DATE;
  v_category    UUID   := nullif(p->>'category_id', '')::UUID;
  v_sub_id      UUID   := nullif(p->>'subscription_id', '')::UUID;
  v_notes       TEXT   := btrim(coalesce(p->>'notes', ''));
  v_source      TEXT   := coalesce(nullif(btrim(p->>'source'), ''), 'email');
  v_source_ref  TEXT   := nullif(btrim(p->>'source_ref'), '');
  v_sub_cat     UUID;
  v_pending     INT;
  v_id          UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.household WHERE id = p_household_id) THEN
    RAISE EXCEPTION 'Household % not found', p_household_id USING ERRCODE = '22023';
  END IF;

  IF v_merchant = '' OR length(v_merchant) > 100 THEN
    RAISE EXCEPTION 'merchant is required (1-100 chars)' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_amount := (p->>'amount_cents')::BIGINT;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'amount_cents must be a whole number of cents' USING ERRCODE = '22023';
  END;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000000 THEN
    RAISE EXCEPTION 'amount_cents must be between 1 and 100000000' USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_occurred := (p->>'occurred_on')::DATE;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'occurred_on must be YYYY-MM-DD' USING ERRCODE = '22023';
  END;
  IF v_occurred IS NULL
     OR v_occurred > current_date + 7
     OR v_occurred < current_date - 400 THEN
    RAISE EXCEPTION 'occurred_on is required and must be within the last ~13 months'
      USING ERRCODE = '22023';
  END IF;

  IF v_sub_id IS NOT NULL THEN
    SELECT s.category_id INTO v_sub_cat
      FROM public.subscription s
     WHERE s.id = v_sub_id
       AND s.household_id = p_household_id
       AND s.active
       AND s.type = 'expense';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'subscription_id % is not an active recurring expense of this household', v_sub_id
        USING ERRCODE = '22023';
    END IF;
    v_category := coalesce(v_category, v_sub_cat);
  END IF;

  IF v_category IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.category c
     WHERE c.id = v_category
       AND c.household_id = p_household_id
       AND c.kind = 'expense'
  ) THEN
    RAISE EXCEPTION 'category_id % is not an expense category of this household', v_category
      USING ERRCODE = '22023';
  END IF;

  IF length(v_notes) > 300 THEN
    v_notes := left(v_notes, 300);
  END IF;

  IF v_source !~ '^[a-z_]{1,40}$' THEN
    RAISE EXCEPTION 'source must be lowercase letters/underscores (e.g. email)' USING ERRCODE = '22023';
  END IF;

  IF v_source_ref IS NOT NULL THEN
    SELECT s.id INTO v_id
      FROM public.expense_suggestion s
     WHERE s.household_id = p_household_id
       AND s.source = v_source
       AND s.source_ref = v_source_ref;
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'duplicate', 'id', v_id);
    END IF;
  END IF;

  -- Backstop against a runaway agent flooding the dashboard.
  SELECT count(*) INTO v_pending
    FROM public.expense_suggestion
   WHERE household_id = p_household_id AND status = 'pending';
  IF v_pending >= 100 THEN
    RAISE EXCEPTION 'Too many pending suggestions (100); ask the household to review them first'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.expense_suggestion (
    household_id, merchant, amount_cents, occurred_on, category_id,
    subscription_id, notes, source, source_ref
  ) VALUES (
    p_household_id, v_merchant, v_amount, v_occurred, v_category,
    v_sub_id, v_notes, v_source, v_source_ref
  )
  ON CONFLICT (household_id, source, source_ref) WHERE source_ref IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT s.id INTO v_id
      FROM public.expense_suggestion s
     WHERE s.household_id = p_household_id
       AND s.source = v_source
       AND s.source_ref = v_source_ref;
    RETURN jsonb_build_object('status', 'duplicate', 'id', v_id);
  END IF;

  RETURN jsonb_build_object('status', 'created', 'id', v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.suggest_expense(UUID, JSONB) FROM PUBLIC, anon, authenticated;
