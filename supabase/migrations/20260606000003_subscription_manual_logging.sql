-- 2026-06-06: subscription manual-logging rework.
-- Adds custom_days cadence + interval_days column, unschedules the hourly
-- auto-materialize cron, ships RPCs for due/upcoming/skip/log_expense, and
-- updates register_subscription to accept interval_days.
-- materialize_due_subscriptions itself is left in place (dormant) so existing
-- partial-unique-index references in public.transaction continue to make
-- sense for historical rows.

ALTER TABLE public.subscription
  ADD COLUMN interval_days INT NULL;

ALTER TABLE public.subscription
  DROP CONSTRAINT IF EXISTS subscription_cadence_check;

ALTER TABLE public.subscription
  ADD CONSTRAINT subscription_cadence_check
  CHECK (cadence IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom_days'));

-- interval_days is required iff cadence = 'custom_days'. Positive when set.
ALTER TABLE public.subscription
  ADD CONSTRAINT subscription_interval_days_check
  CHECK (
    (cadence = 'custom_days' AND interval_days IS NOT NULL AND interval_days > 0)
    OR
    (cadence <> 'custom_days' AND interval_days IS NULL)
  );

COMMENT ON COLUMN public.subscription.interval_days IS
  'Interval in days for custom_days cadence. NULL for all other cadences. '
  'Constraint subscription_interval_days_check enforces the iff relationship.';

-- Stop auto-materializing. Materialize RPC is left in place but unused.
DO $$ BEGIN
  PERFORM cron.unschedule('subscriptions-hourly');
EXCEPTION WHEN OTHERS THEN
  -- Already unscheduled or never present — fine.
  NULL;
END $$;

COMMENT ON FUNCTION public.materialize_due_subscriptions(BOOLEAN) IS
  'Deprecated 2026-06-06: subscriptions are no longer auto-materialized. '
  'Kept for historical traceability of subscription_id/occurrence_date on '
  'past transactions; do not call from new code.';

-- register_subscription(p jsonb) — accepts optional interval_days when cadence='custom_days'.
CREATE OR REPLACE FUNCTION public.register_subscription(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_merchant     TEXT   := nullif(p->>'merchant', '');
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_category     UUID   := nullif(p->>'category_id', '')::UUID;
  v_cadence      TEXT   := nullif(p->>'cadence', '');
  v_renewal      DATE   := nullif(p->>'next_renewal_at', '')::DATE;
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID   := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_interval     INT    := nullif(p->>'interval_days', '')::INT;
  v_cat_visible  BOOLEAN;
  v_id           UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant IS NULL OR v_amount IS NULL OR v_amount <= 0
     OR v_category IS NULL OR v_cadence IS NULL OR v_renewal IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;
  IF v_cadence = 'custom_days' THEN
    IF v_interval IS NULL OR v_interval <= 0 THEN
      RAISE EXCEPTION 'interval_days is required and must be > 0 for custom_days cadence' USING ERRCODE = '22023';
    END IF;
  ELSIF v_interval IS NOT NULL THEN
    RAISE EXCEPTION 'interval_days is only allowed when cadence=custom_days' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id IS NULL OR c.household_id = v_household_id)
    INTO v_cat_visible
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_visible IS NULL OR NOT v_cat_visible THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.subscription (
    household_id, merchant, amount_cents, category_id, cadence,
    next_renewal_at, paid_by_member_id, for_member_id, essential_pct, interval_days
  ) VALUES (
    v_household_id, v_merchant, v_amount, v_category, v_cadence,
    v_renewal, v_paid_by, v_for_member, v_essential, v_interval
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION public.register_subscription(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.register_subscription(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_subscription(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_due_subscriptions() — active subs with next_renewal_at <= today.
-- Returns every field needed for both display and prefilling the expense form.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_due_subscriptions()
RETURNS TABLE (
  id                 UUID,
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
  split_rule         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id, c.name,
         s.cadence, s.interval_days, s.next_renewal_at,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule
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

-- ---------------------------------------------------------------------------
-- list_upcoming_subscriptions() — active subs whose next_renewal_at is in
-- the future and within a cadence-relative window. Excludes due.
--   weekly      → 1 day before
--   biweekly    → 3 days before
--   monthly     → 7 days before
--   quarterly   → 14 days before
--   yearly      → 30 days before
--   custom_days → least(ceil(interval_days/4), 30) days before
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_upcoming_subscriptions()
RETURNS TABLE (
  id                 UUID,
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
  split_rule         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id, c.name,
         s.cadence, s.interval_days, s.next_renewal_at,
         s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule
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

-- ---------------------------------------------------------------------------
-- get_subscription_prefill(p_id) — single-sub variant for the
-- /subscriptions/[id]/add prefill route. Returns one row or raises 22023.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_subscription_prefill(p_id UUID)
RETURNS TABLE (
  id                 UUID,
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
  split_rule         TEXT
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
    SELECT s.id, s.merchant, s.amount_cents, s.category_id, c.name,
           s.cadence, s.interval_days, s.next_renewal_at,
           s.paid_by_member_id, s.for_member_id, s.essential_pct, s.split_rule
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

-- ---------------------------------------------------------------------------
-- skip_subscription_occurrence(p_id) — advance next_renewal_at by one
-- cadence step. No transaction created. Idempotent for inactive/missing rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.skip_subscription_occurrence(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_sub          public.subscription;
  v_next         DATE;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscription
   WHERE id = p_id AND household_id = v_household_id AND active;
  IF NOT FOUND THEN
    RETURN;  -- inactive or not visible — silent no-op
  END IF;

  v_next := CASE v_sub.cadence
    WHEN 'weekly'      THEN v_sub.next_renewal_at + INTERVAL '7 days'
    WHEN 'biweekly'    THEN v_sub.next_renewal_at + INTERVAL '14 days'
    WHEN 'monthly'     THEN v_sub.next_renewal_at + INTERVAL '1 month'
    WHEN 'quarterly'   THEN v_sub.next_renewal_at + INTERVAL '3 months'
    WHEN 'yearly'      THEN v_sub.next_renewal_at + INTERVAL '1 year'
    WHEN 'custom_days' THEN v_sub.next_renewal_at + (v_sub.interval_days || ' days')::INTERVAL
    ELSE NULL  -- unreachable: cadence is CHECK-constrained, but kept explicit
  END;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Unknown cadence: %', v_sub.cadence USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.subscription SET next_renewal_at = v_next WHERE id = p_id;
END;
$$;

ALTER FUNCTION public.skip_subscription_occurrence(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.skip_subscription_occurrence(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skip_subscription_occurrence(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_subscription_expense(p jsonb) — atomic: insert transaction + advance
-- the subscription's next_renewal_at by one cadence step from the ORIGINAL
-- next_renewal_at (not from p.occurred_on).
--
-- Required keys: subscription_id, amount_cents, category_id, occurred_on
-- Optional:      notes, paid_by_member_id, for_member_id, essential_pct,
--                split_rule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subscription_expense(p JSONB)
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
  v_for_member   UUID   := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split_rule   TEXT   := nullif(p->>'split_rule', '');
  v_sub          public.subscription;
  v_next         DATE;
  v_tx_id        UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_sub_id IS NULL OR v_amount IS NULL OR v_amount <= 0
     OR v_category IS NULL OR v_occurred_on IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sub
    FROM public.subscription
   WHERE id = v_sub_id AND household_id = v_household_id AND active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription % not found or inactive', v_sub_id USING ERRCODE = '22023';
  END IF;

  v_next := CASE v_sub.cadence
    WHEN 'weekly'      THEN v_sub.next_renewal_at + INTERVAL '7 days'
    WHEN 'biweekly'    THEN v_sub.next_renewal_at + INTERVAL '14 days'
    WHEN 'monthly'     THEN v_sub.next_renewal_at + INTERVAL '1 month'
    WHEN 'quarterly'   THEN v_sub.next_renewal_at + INTERVAL '3 months'
    WHEN 'yearly'      THEN v_sub.next_renewal_at + INTERVAL '1 year'
    WHEN 'custom_days' THEN v_sub.next_renewal_at + (v_sub.interval_days || ' days')::INTERVAL
    ELSE NULL  -- unreachable: cadence is CHECK-constrained, but kept explicit
  END;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Unknown cadence: %', v_sub.cadence USING ERRCODE = 'P0001';
  END IF;

  -- occurrence_date is the SCHEDULED renewal date (not occurred_on) so the
  -- (subscription_id, occurrence_date) partial unique index still gives
  -- idempotency if this RPC is called twice for the same period.
  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id,
    notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'expense', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, v_for_member, v_essential, v_split_rule,
    v_sub_id, v_sub.next_renewal_at
  )
  ON CONFLICT (subscription_id, occurrence_date)
    WHERE subscription_id IS NOT NULL AND occurrence_date IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    -- The occurrence was already logged; return the existing transaction id
    -- and DO NOT advance next_renewal_at again (it was advanced on the first call).
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

ALTER FUNCTION public.log_subscription_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_subscription_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_expense(JSONB) TO authenticated;
