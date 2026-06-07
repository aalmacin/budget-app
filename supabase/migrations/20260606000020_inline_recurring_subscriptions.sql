-- 2026-06-06: inline recurring on Add Expense / Add Income.
-- Extends public.subscription with type + income_source for income subs.
-- Adds atomic RPCs that insert the first transaction AND the subscription
-- row in one statement, plus an income variant of log_subscription_expense.

ALTER TABLE public.subscription
  ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'
    CHECK (type IN ('expense', 'income'));

ALTER TABLE public.subscription
  ADD COLUMN income_source TEXT NULL
    CHECK (income_source IS NULL OR income_source IN (
      'Salary', 'Contract', 'Self_employed', 'Benefit', 'Refund', 'Gift'
    ));

-- Type-aware sanity constraint. Income rows force neutral values for the
-- expense-only columns so existing RPCs that read them keep working.
ALTER TABLE public.subscription
  ADD CONSTRAINT subscription_type_consistency_check
  CHECK (
    (type = 'expense' AND income_source IS NULL)
    OR
    (type = 'income'
      AND income_source IS NOT NULL
      AND for_member_id IS NULL
      AND split_rule IS NULL
      AND essential_pct = 100)
  );

COMMENT ON COLUMN public.subscription.type IS
  'Discriminator for recurring expense vs recurring income.';
COMMENT ON COLUMN public.subscription.income_source IS
  'Required when type=income, NULL otherwise. Matches the income form select.';

-- ---------------------------------------------------------------------------
-- log_expense_with_subscription(p jsonb)
-- Atomic: insert one expense transaction + create the subscription it belongs
-- to. next_renewal_at = start_date + 1 cadence step.
-- Required keys: amount_cents, category_id, occurred_on, cadence, start_date
-- Optional: notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
--           interval_days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_expense_with_subscription(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_category     UUID   := nullif(p->>'category_id', '')::UUID;
  v_occurred_on  DATE   := nullif(p->>'occurred_on', '')::DATE;
  v_notes        TEXT   := coalesce(nullif(p->>'notes', ''), '');
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID   := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split_rule   TEXT   := nullif(p->>'split_rule', '');
  v_cadence      TEXT   := nullif(p->>'cadence', '');
  v_interval     INT    := nullif(p->>'interval_days', '')::INT;
  v_start_date   DATE   := nullif(p->>'start_date', '')::DATE;
  v_next         DATE;
  v_sub_id       UUID;
  v_tx_id        UUID;
  v_cat_visible  BOOLEAN;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0
     OR v_category IS NULL OR v_occurred_on IS NULL
     OR v_cadence IS NULL OR v_start_date IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;
  IF v_cadence = 'custom_days' THEN
    IF v_interval IS NULL OR v_interval <= 0 THEN
      RAISE EXCEPTION 'interval_days is required and must be > 0 for custom_days' USING ERRCODE = '22023';
    END IF;
  ELSIF v_interval IS NOT NULL THEN
    RAISE EXCEPTION 'interval_days only allowed when cadence=custom_days' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id IS NULL OR c.household_id = v_household_id)
    INTO v_cat_visible
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_visible IS NULL OR NOT v_cat_visible THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  v_next := CASE v_cadence
    WHEN 'weekly'      THEN v_start_date + INTERVAL '7 days'
    WHEN 'biweekly'    THEN v_start_date + INTERVAL '14 days'
    WHEN 'monthly'     THEN v_start_date + INTERVAL '1 month'
    WHEN 'quarterly'   THEN v_start_date + INTERVAL '3 months'
    WHEN 'yearly'      THEN v_start_date + INTERVAL '1 year'
    WHEN 'custom_days' THEN v_start_date + (v_interval || ' days')::INTERVAL
    ELSE NULL
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Unknown cadence: %', v_cadence USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.subscription (
    household_id, type, merchant, amount_cents, category_id, cadence,
    next_renewal_at, paid_by_member_id, for_member_id, essential_pct,
    split_rule, interval_days, income_source
  ) VALUES (
    v_household_id, 'expense', v_notes, v_amount, v_category, v_cadence,
    v_next, v_paid_by, v_for_member, v_essential,
    v_split_rule, v_interval, NULL
  )
  RETURNING id INTO v_sub_id;

  -- Use start_date as occurrence_date so this row is correctly grouped with
  -- the subscription's scheduled cycle (occurrence_date matches what
  -- list_due_subscriptions will treat as the next renewal anchor). The
  -- transaction's occurred_on is what the user typed (may differ for
  -- back-dated entries). Double-submit protection is the caller's
  -- responsibility — useActionState's pending flag disables the button on
  -- the only known caller.
  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id,
    notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'expense', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, v_for_member, v_essential, v_split_rule,
    v_sub_id, v_start_date
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

ALTER FUNCTION public.log_expense_with_subscription(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_expense_with_subscription(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_expense_with_subscription(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_income_with_subscription(p jsonb)
-- Atomic: insert one income transaction + create the income subscription.
-- Required keys: amount_cents, category_id, occurred_on, cadence, start_date,
--                paid_by_member_id, income_source
-- Optional: notes, interval_days
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_income_with_subscription(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_category     UUID   := nullif(p->>'category_id', '')::UUID;
  v_occurred_on  DATE   := nullif(p->>'occurred_on', '')::DATE;
  v_notes        TEXT   := coalesce(nullif(p->>'notes', ''), '');
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_income_src   TEXT   := nullif(p->>'income_source', '');
  v_cadence      TEXT   := nullif(p->>'cadence', '');
  v_interval     INT    := nullif(p->>'interval_days', '')::INT;
  v_start_date   DATE   := nullif(p->>'start_date', '')::DATE;
  v_next         DATE;
  v_sub_id       UUID;
  v_tx_id        UUID;
  v_cat_visible  BOOLEAN;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0
     OR v_category IS NULL OR v_occurred_on IS NULL
     OR v_cadence IS NULL OR v_start_date IS NULL
     OR v_paid_by IS NULL OR v_income_src IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;
  IF v_income_src NOT IN ('Salary','Contract','Self_employed','Benefit','Refund','Gift') THEN
    RAISE EXCEPTION 'Invalid income_source: %', v_income_src USING ERRCODE = '22023';
  END IF;
  IF v_cadence = 'custom_days' THEN
    IF v_interval IS NULL OR v_interval <= 0 THEN
      RAISE EXCEPTION 'interval_days is required and must be > 0 for custom_days' USING ERRCODE = '22023';
    END IF;
  ELSIF v_interval IS NOT NULL THEN
    RAISE EXCEPTION 'interval_days only allowed when cadence=custom_days' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id IS NULL OR c.household_id = v_household_id)
    INTO v_cat_visible
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_visible IS NULL OR NOT v_cat_visible THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  v_next := CASE v_cadence
    WHEN 'weekly'      THEN v_start_date + INTERVAL '7 days'
    WHEN 'biweekly'    THEN v_start_date + INTERVAL '14 days'
    WHEN 'monthly'     THEN v_start_date + INTERVAL '1 month'
    WHEN 'quarterly'   THEN v_start_date + INTERVAL '3 months'
    WHEN 'yearly'      THEN v_start_date + INTERVAL '1 year'
    WHEN 'custom_days' THEN v_start_date + (v_interval || ' days')::INTERVAL
    ELSE NULL
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Unknown cadence: %', v_cadence USING ERRCODE = 'P0001';
  END IF;

  -- Income subs use the notes string as a "merchant"-ish label (e.g. the
  -- payer name). We keep schema-level merchant required, so default to notes.
  INSERT INTO public.subscription (
    household_id, type, merchant, amount_cents, category_id, cadence,
    next_renewal_at, paid_by_member_id, for_member_id, essential_pct,
    split_rule, interval_days, income_source
  ) VALUES (
    v_household_id, 'income', coalesce(nullif(v_notes, ''), v_income_src),
    v_amount, v_category, v_cadence,
    v_next, v_paid_by, NULL, 100, NULL, v_interval, v_income_src
  )
  RETURNING id INTO v_sub_id;

  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id,
    notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'income', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, NULL, 100, NULL,
    v_sub_id, v_start_date
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

ALTER FUNCTION public.log_income_with_subscription(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_income_with_subscription(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_income_with_subscription(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_subscription_income(p jsonb) — income counterpart to
-- log_subscription_expense. Inserts one income transaction tied to the
-- subscription's CURRENT next_renewal_at, then advances renewal by one step.
-- Required keys: subscription_id, amount_cents, category_id, occurred_on,
--                paid_by_member_id
-- Optional:      notes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subscription_income(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_sub_id       UUID := nullif(p->>'subscription_id', '')::UUID;
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_category     UUID   := nullif(p->>'category_id', '')::UUID;
  v_occurred_on  DATE   := nullif(p->>'occurred_on', '')::DATE;
  v_notes        TEXT   := coalesce(nullif(p->>'notes', ''), '');
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_sub          public.subscription;
  v_next         DATE;
  v_tx_id        UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_sub_id IS NULL OR v_amount IS NULL OR v_amount <= 0
     OR v_category IS NULL OR v_occurred_on IS NULL OR v_paid_by IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscription
   WHERE id = v_sub_id AND household_id = v_household_id AND active AND type = 'income';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Income subscription % not found or inactive', v_sub_id USING ERRCODE = '22023';
  END IF;

  v_next := CASE v_sub.cadence
    WHEN 'weekly'      THEN v_sub.next_renewal_at + INTERVAL '7 days'
    WHEN 'biweekly'    THEN v_sub.next_renewal_at + INTERVAL '14 days'
    WHEN 'monthly'     THEN v_sub.next_renewal_at + INTERVAL '1 month'
    WHEN 'quarterly'   THEN v_sub.next_renewal_at + INTERVAL '3 months'
    WHEN 'yearly'      THEN v_sub.next_renewal_at + INTERVAL '1 year'
    WHEN 'custom_days' THEN v_sub.next_renewal_at + (v_sub.interval_days || ' days')::INTERVAL
    ELSE NULL
  END;
  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Unknown cadence: %', v_sub.cadence USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id,
    notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'income', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, NULL, 100, NULL,
    v_sub_id, v_sub.next_renewal_at
  )
  ON CONFLICT (subscription_id, occurrence_date)
    WHERE subscription_id IS NOT NULL AND occurrence_date IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    SELECT id INTO v_tx_id
      FROM public.transaction
     WHERE subscription_id = v_sub_id
       AND occurrence_date = v_sub.next_renewal_at;
    RETURN v_tx_id;
  END IF;

  UPDATE public.subscription SET next_renewal_at = v_next WHERE id = v_sub_id;

  RETURN v_tx_id;
END;
$$;

ALTER FUNCTION public.log_subscription_income(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_subscription_income(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_income(JSONB) TO authenticated;

-- list_due_subscriptions now also returns type + income_source.
CREATE OR REPLACE FUNCTION public.list_due_subscriptions()
RETURNS TABLE (
  id                 UUID,
  type               TEXT,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  category_name      TEXT,
  cadence            TEXT,
  interval_days      INT,
  next_renewal_at    DATE,
  paid_by_member_id  UUID,
  for_member_id      UUID,
  essential_pct      SMALLINT,
  split_rule         TEXT,
  income_source      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.type, s.merchant, s.amount_cents, s.category_id, c.name,
         s.cadence, s.interval_days, s.next_renewal_at,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule,
         s.income_source
  FROM public.subscription s
  JOIN public.category c ON c.id = s.category_id
  WHERE s.household_id = public.get_current_household()
    AND s.active
    AND s.next_renewal_at <= current_date
  ORDER BY s.next_renewal_at ASC, s.merchant ASC
$$;

ALTER FUNCTION public.list_due_subscriptions() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_due_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_due_subscriptions() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_upcoming_subscriptions()
RETURNS TABLE (
  id                 UUID,
  type               TEXT,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  category_name      TEXT,
  cadence            TEXT,
  interval_days      INT,
  next_renewal_at    DATE,
  paid_by_member_id  UUID,
  for_member_id      UUID,
  essential_pct      SMALLINT,
  split_rule         TEXT,
  income_source      TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.type, s.merchant, s.amount_cents, s.category_id, c.name,
         s.cadence, s.interval_days, s.next_renewal_at,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule,
         s.income_source
  FROM public.subscription s
  JOIN public.category c ON c.id = s.category_id
  WHERE s.household_id = public.get_current_household()
    AND s.active
    AND s.next_renewal_at > current_date
    AND s.next_renewal_at <= current_date + (
      CASE s.cadence
        WHEN 'weekly'      THEN 1
        WHEN 'biweekly'    THEN 3
        WHEN 'monthly'     THEN 7
        WHEN 'quarterly'   THEN 14
        WHEN 'yearly'      THEN 30
        WHEN 'custom_days' THEN LEAST(CEIL(s.interval_days::numeric / 4)::INT, 30)
      END
    )
  ORDER BY s.next_renewal_at ASC, s.merchant ASC
$$;

ALTER FUNCTION public.list_upcoming_subscriptions() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_upcoming_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_upcoming_subscriptions() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_subscription_prefill(p_id UUID)
RETURNS TABLE (
  id                 UUID,
  type               TEXT,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  category_name      TEXT,
  cadence            TEXT,
  interval_days      INT,
  next_renewal_at    DATE,
  paid_by_member_id  UUID,
  for_member_id      UUID,
  essential_pct      SMALLINT,
  split_rule         TEXT,
  income_source      TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT s.id, s.type, s.merchant, s.amount_cents, s.category_id, c.name,
           s.cadence, s.interval_days, s.next_renewal_at,
           s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule,
           s.income_source
    FROM public.subscription s
    JOIN public.category c ON c.id = s.category_id
    WHERE s.id = p_id
      AND s.household_id = v_household_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription % not found in household', p_id USING ERRCODE = '22023';
  END IF;
END;
$$;

ALTER FUNCTION public.get_subscription_prefill(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_subscription_prefill(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subscription_prefill(UUID) TO authenticated;
