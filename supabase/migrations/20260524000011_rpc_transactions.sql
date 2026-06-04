-- T071–T077 — Phase 7 / US6: transaction CRUD + dashboard + quick-add.
-- Every function: SECURITY DEFINER, search_path = '', owner =
-- budget_function_owner, EXECUTE granted to authenticated.

-- ---------------------------------------------------------------------------
-- list_transactions(p_filters jsonb)
--
-- Filters keys (all optional):
--   search          — text matched against notes (tsvector / plainto_tsquery)
--   essential       — 'essential' | 'treats'  (essential_pct >= 50 vs < 50)
--   for_member_id   — UUID
--   from / to       — ISO date strings, inclusive lower / exclusive upper
--   limit           — default 100, capped at 1000
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_transactions(p_filters JSONB)
RETURNS TABLE (
  id                      UUID,
  type                    TEXT,
  amount_cents            BIGINT,
  category_name           TEXT,
  notes                   TEXT,
  for_member_display_name TEXT,
  paid_by_display_name    TEXT,
  occurred_on             DATE,
  essential_pct           SMALLINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_search       TEXT := nullif(p_filters->>'search', '');
  v_essential    TEXT := p_filters->>'essential';
  v_for_member   UUID := nullif(p_filters->>'for_member_id', '')::UUID;
  v_from         DATE := nullif(p_filters->>'from', '')::DATE;
  v_to           DATE := nullif(p_filters->>'to', '')::DATE;
  v_limit        INT  := coalesce((p_filters->>'limit')::INT, 100);
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  IF v_limit > 1000 THEN v_limit := 1000; END IF;

  RETURN QUERY
  SELECT t.id, t.type, t.amount_cents, c.name AS category_name, t.notes,
         fm.display_name AS for_member_display_name,
         pm.display_name AS paid_by_display_name,
         t.occurred_on, t.essential_pct
  FROM public.transaction t
  LEFT JOIN public.category        c  ON c.id  = t.category_id
  LEFT JOIN public.household_member fm ON fm.id = t.for_member_id
  LEFT JOIN public.household_member pm ON pm.id = t.paid_by_member_id
  WHERE t.household_id = v_household_id
    AND (v_search     IS NULL OR to_tsvector('simple', t.notes) @@ plainto_tsquery('simple', v_search))
    AND (v_essential  IS NULL
         OR (v_essential = 'essential' AND t.essential_pct >= 50)
         OR (v_essential = 'treats'    AND t.essential_pct <  50))
    AND (v_for_member IS NULL OR t.for_member_id = v_for_member)
    AND (v_from       IS NULL OR t.occurred_on  >= v_from)
    AND (v_to         IS NULL OR t.occurred_on  <  v_to)
  ORDER BY t.occurred_on DESC, t.created_at DESC
  LIMIT v_limit;
END;
$$;

ALTER FUNCTION public.list_transactions(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_transactions(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_transactions(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- _insert_transaction(p_type, p) — shared body for log_expense / log_income.
-- Trusts caller (the wrappers below) to pre-validate the type.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._insert_transaction(p_type TEXT, p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_id           UUID := coalesce(nullif(p->>'id', '')::UUID, gen_random_uuid());
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_occurred     DATE   := coalesce(nullif(p->>'occurred_on', '')::DATE, current_date);
  v_category     UUID   := (p->>'category_id')::UUID;
  v_notes        TEXT   := coalesce(p->>'notes', '');
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID   := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split        TEXT   := nullif(p->>'split_rule', '');
  v_income_src   TEXT   := nullif(p->>'income_source', '');
  v_sub_id       UUID   := nullif(p->>'subscription_id', '')::UUID;
  v_occ_date     DATE   := nullif(p->>'occurrence_date', '')::DATE;
  v_cat_visible  BOOLEAN;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'amount_cents must be > 0' USING ERRCODE = '22023';
  END IF;
  IF v_category IS NULL THEN
    RAISE EXCEPTION 'category_id is required' USING ERRCODE = '22023';
  END IF;

  -- Category must be system-global OR belong to this household.
  SELECT (c.household_id IS NULL OR c.household_id = v_household_id)
    INTO v_cat_visible
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_visible IS NULL THEN
    RAISE EXCEPTION 'category_id % does not exist', v_category USING ERRCODE = '23503';
  END IF;
  IF NOT v_cat_visible THEN
    RAISE EXCEPTION 'category_id % belongs to another household', v_category USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id, notes,
    paid_by_member_id, for_member_id, essential_pct, split_rule, income_source,
    subscription_id, occurrence_date
  ) VALUES (
    v_id, v_household_id, p_type, v_amount, v_occurred, v_category, v_notes,
    v_paid_by, v_for_member, v_essential, v_split, v_income_src,
    v_sub_id, v_occ_date
  )
  ON CONFLICT (id) DO NOTHING;  -- offline-replay idempotency (FR-031)

  RETURN v_id;
END;
$$;

ALTER FUNCTION public._insert_transaction(TEXT, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public._insert_transaction(TEXT, JSONB) FROM PUBLIC;
-- Not granted to authenticated — internal helper only.

-- ---------------------------------------------------------------------------
-- log_expense(p jsonb) — wraps _insert_transaction('expense', ...).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_expense(p JSONB)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public._insert_transaction('expense', p)
$$;

ALTER FUNCTION public.log_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_expense(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_income(p jsonb) — wraps _insert_transaction('income', ...).
-- Requires income_source per logIncomeSchema in lib/validators/transaction.ts.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_income(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF nullif(p->>'income_source', '') IS NULL THEN
    RAISE EXCEPTION 'income_source is required' USING ERRCODE = '22023';
  END IF;
  RETURN public._insert_transaction('income', p);
END;
$$;

ALTER FUNCTION public.log_income(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_income(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_income(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_transaction(p_id, p_patch jsonb)
-- Allowed patch keys: amount_cents, notes, essential_pct, occurred_on,
-- category_id, paid_by_member_id, for_member_id, split_rule.
-- Unknown keys are ignored (lib/validators/transaction.ts validates at the
-- client side; server is defensive but lenient).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_transaction(p_id UUID, p_patch JSONB)
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

  UPDATE public.transaction
     SET amount_cents      = coalesce((p_patch->>'amount_cents')::BIGINT,    amount_cents),
         notes             = coalesce(p_patch->>'notes',                     notes),
         essential_pct     = coalesce((p_patch->>'essential_pct')::SMALLINT, essential_pct),
         occurred_on       = coalesce(nullif(p_patch->>'occurred_on', '')::DATE, occurred_on),
         category_id       = coalesce(nullif(p_patch->>'category_id', '')::UUID, category_id),
         paid_by_member_id = CASE WHEN p_patch ? 'paid_by_member_id'
                                  THEN nullif(p_patch->>'paid_by_member_id', '')::UUID
                                  ELSE paid_by_member_id END,
         for_member_id     = CASE WHEN p_patch ? 'for_member_id'
                                  THEN nullif(p_patch->>'for_member_id', '')::UUID
                                  ELSE for_member_id END,
         split_rule        = CASE WHEN p_patch ? 'split_rule'
                                  THEN nullif(p_patch->>'split_rule', '')
                                  ELSE split_rule END
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.update_transaction(UUID, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_transaction(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transaction(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- delete_transaction(p_id) — RLS already isolates by household; the WHERE
-- clause repeats the household guard so a wrong id silently no-ops instead
-- of leaking existence via FK errors.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_transaction(p_id UUID)
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

  DELETE FROM public.transaction
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.delete_transaction(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.delete_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_transaction(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_quick_add_options(p_limit) — top N recently-used expense templates
-- across two sources:
--   source = 'recent'        — distinct (category, amount) pairs from the
--                              caller's last 50 expense transactions
--   source = 'subscription'  — active subscriptions due within the next 14 days
-- The QuickAddTile component (app/(app)/quick-add/QuickAddTabs.tsx) consumes
-- a unified row shape.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_quick_add_options(p_limit INT)
RETURNS TABLE (
  source         TEXT,
  ref_id         UUID,
  label          TEXT,
  category_id    UUID,
  category_name  TEXT,
  amount_cents   BIGINT,
  for_member_id  UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_limit        INT  := least(coalesce(p_limit, 12), 50);
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH recent_raw AS (
    SELECT t.id, t.category_id, t.amount_cents, t.for_member_id,
           c.name AS category_name, t.occurred_on
    FROM public.transaction t
    JOIN public.category c ON c.id = t.category_id
    WHERE t.household_id = v_household_id
      AND t.type = 'expense'
      AND t.subscription_id IS NULL
    ORDER BY t.occurred_on DESC, t.created_at DESC
    LIMIT 50
  ),
  recent_dedup AS (
    SELECT DISTINCT ON (category_id, amount_cents)
      id, category_id, category_name, amount_cents, for_member_id
    FROM recent_raw
  ),
  recent_capped AS (
    SELECT 'recent'::TEXT AS source, id AS ref_id, category_name AS label,
           category_id, category_name, amount_cents, for_member_id
    FROM recent_dedup
    LIMIT v_limit
  ),
  subs AS (
    SELECT 'subscription'::TEXT AS source, s.id AS ref_id, s.merchant AS label,
           s.category_id, c.name AS category_name, s.amount_cents, s.for_member_id
    FROM public.subscription s
    JOIN public.category c ON c.id = s.category_id
    WHERE s.household_id = v_household_id
      AND s.active
      AND s.next_renewal_at <= current_date + INTERVAL '14 days'
    ORDER BY s.next_renewal_at
    LIMIT v_limit
  )
  SELECT * FROM recent_capped
  UNION ALL
  SELECT * FROM subs;
END;
$$;

ALTER FUNCTION public.list_quick_add_options(INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_quick_add_options(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_quick_add_options(INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_dashboard_summary(p_year, p_month) — returns the jsonb shape consumed
-- by app/(app)/dashboard/page.tsx (balance_cents, left_to_spend_this_month_cents,
-- essential_spent_cents, treats_spent_cents, income_month_cents,
-- month_expense_cents, recent[]).
--
-- balance_cents = lifetime income − lifetime expense (cents).
-- left_to_spend_this_month_cents = (sum of category monthly_budget_cents
--   visible to caller) − month_expense_cents. NULL budgets contribute 0.
-- recent = last 10 transactions joined with category + for-member display.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_year INT, p_month INT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_month_start  DATE;
  v_month_end    DATE;
  v_lifetime_income  BIGINT;
  v_lifetime_expense BIGINT;
  v_month_income     BIGINT;
  v_month_expense    BIGINT;
  v_essential        BIGINT;
  v_treats           BIGINT;
  v_budget_total     BIGINT;
  v_recent           JSONB;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + INTERVAL '1 month')::DATE;

  SELECT
    coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0),
    coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0)
  INTO v_lifetime_income, v_lifetime_expense
  FROM public.transaction
  WHERE household_id = v_household_id;

  SELECT
    coalesce(sum(amount_cents) FILTER (WHERE type = 'income'),  0),
    coalesce(sum(amount_cents) FILTER (WHERE type = 'expense'), 0),
    coalesce(sum(amount_cents * essential_pct / 100)         FILTER (WHERE type = 'expense'), 0),
    coalesce(sum(amount_cents * (100 - essential_pct) / 100) FILTER (WHERE type = 'expense'), 0)
  INTO v_month_income, v_month_expense, v_essential, v_treats
  FROM public.transaction
  WHERE household_id = v_household_id
    AND occurred_on >= v_month_start
    AND occurred_on <  v_month_end;

  SELECT coalesce(sum(monthly_budget_cents), 0)
  INTO v_budget_total
  FROM public.category
  WHERE (household_id = v_household_id OR household_id IS NULL)
    AND monthly_budget_cents IS NOT NULL;

  SELECT coalesce(jsonb_agg(row), '[]'::JSONB)
  INTO v_recent
  FROM (
    SELECT jsonb_build_object(
      'id', t.id,
      'type', t.type,
      'amount_cents', t.amount_cents,
      'category_name', c.name,
      'notes', t.notes,
      'for_member_display_name', fm.display_name,
      'occurred_on', t.occurred_on
    ) AS row
    FROM public.transaction t
    JOIN public.category c        ON c.id  = t.category_id
    LEFT JOIN public.household_member fm ON fm.id = t.for_member_id
    WHERE t.household_id = v_household_id
    ORDER BY t.occurred_on DESC, t.created_at DESC
    LIMIT 10
  ) sub;

  RETURN jsonb_build_object(
    'balance_cents',                   v_lifetime_income - v_lifetime_expense,
    'left_to_spend_this_month_cents',  v_budget_total - v_month_expense,
    'essential_spent_cents',           v_essential,
    'treats_spent_cents',              v_treats,
    'income_month_cents',              v_month_income,
    'month_expense_cents',             v_month_expense,
    'recent',                          v_recent
  );
END;
$$;

ALTER FUNCTION public.get_dashboard_summary(INT, INT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_dashboard_summary(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(INT, INT) TO authenticated;
