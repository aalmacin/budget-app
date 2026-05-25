-- T083–T088 — Phase 7 / US7: subscription RPCs.
-- Every function: SECURITY DEFINER, search_path = '', owner =
-- budget_function_owner, EXECUTE granted to authenticated.

CREATE OR REPLACE FUNCTION budget.list_subscriptions()
RETURNS TABLE (
  id              UUID,
  merchant        TEXT,
  amount_cents    BIGINT,
  cadence         TEXT,
  next_renewal_at DATE,
  active          BOOLEAN,
  category_id     UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.cadence,
         s.next_renewal_at, s.active, s.category_id
  FROM budget.subscription s
  WHERE s.household_id = budget.get_current_household()
  ORDER BY s.next_renewal_at
$$;

ALTER FUNCTION budget.list_subscriptions() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.list_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.list_subscriptions() TO authenticated;

-- ---------------------------------------------------------------------------
-- register_subscription(p jsonb)
-- Required keys: merchant, amount_cents, category_id, cadence, next_renewal_at
-- Optional: paid_by_member_id, for_member_id, essential_pct
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.register_subscription(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
  v_merchant     TEXT   := nullif(p->>'merchant', '');
  v_amount       BIGINT := (p->>'amount_cents')::BIGINT;
  v_category     UUID   := nullif(p->>'category_id', '')::UUID;
  v_cadence      TEXT   := nullif(p->>'cadence', '');
  v_renewal      DATE   := nullif(p->>'next_renewal_at', '')::DATE;
  v_paid_by      UUID   := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member   UUID   := nullif(p->>'for_member_id', '')::UUID;
  v_essential    SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
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

  SELECT (c.household_id IS NULL OR c.household_id = v_household_id)
    INTO v_cat_visible
    FROM budget.category c
   WHERE c.id = v_category;
  IF v_cat_visible IS NULL OR NOT v_cat_visible THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  INSERT INTO budget.subscription (
    household_id, merchant, amount_cents, category_id, cadence,
    next_renewal_at, paid_by_member_id, for_member_id, essential_pct
  ) VALUES (
    v_household_id, v_merchant, v_amount, v_category, v_cadence,
    v_renewal, v_paid_by, v_for_member, v_essential
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION budget.register_subscription(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.register_subscription(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.register_subscription(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION budget.pause_subscription(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  UPDATE budget.subscription
     SET active = false
   WHERE id = p_id AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION budget.pause_subscription(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.pause_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.pause_subscription(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION budget.resume_subscription(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  UPDATE budget.subscription
     SET active = true
   WHERE id = p_id AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION budget.resume_subscription(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.resume_subscription(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.resume_subscription(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_overlapping_subscriptions() — active subscriptions grouped by
-- category, monthly-normalised total, only categories with count > 1.
-- Consumed by app/(app)/subscriptions/page.tsx.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.list_overlapping_subscriptions()
RETURNS TABLE (
  category_name        TEXT,
  count                INT,
  monthly_total_cents  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := budget.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH norm AS (
    SELECT s.category_id,
           s.amount_cents *
             CASE s.cadence
               WHEN 'weekly'    THEN 52.0 / 12.0
               WHEN 'biweekly'  THEN 26.0 / 12.0
               WHEN 'monthly'   THEN 1.0
               WHEN 'quarterly' THEN 1.0 / 3.0
               WHEN 'yearly'    THEN 1.0 / 12.0
             END AS monthly_cents
    FROM budget.subscription s
    WHERE s.household_id = v_household_id
      AND s.active
  )
  SELECT c.name,
         count(*)::INT,
         sum(n.monthly_cents)::BIGINT
  FROM norm n
  JOIN budget.category c ON c.id = n.category_id
  GROUP BY c.name
  HAVING count(*) > 1
  ORDER BY c.name;
END;
$$;

ALTER FUNCTION budget.list_overlapping_subscriptions() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.list_overlapping_subscriptions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.list_overlapping_subscriptions() TO authenticated;

-- ---------------------------------------------------------------------------
-- materialize_due_subscriptions(p_bypass_rls) — for each active subscription
-- with next_renewal_at <= today, insert a transaction (id derived
-- deterministically from subscription_id + occurrence_date so re-runs are
-- idempotent against the unique index) and advance next_renewal_at by one
-- cadence step.
--
-- p_bypass_rls=true is only valid from the cron path (it skips RLS so the
-- function can process every household in one pass). Authenticated callers
-- can also invoke this for *their* household with p_bypass_rls=false.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION budget.materialize_due_subscriptions(p_bypass_rls BOOLEAN DEFAULT false)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID;
  v_count        INT := 0;
  r              RECORD;
  v_next         DATE;
BEGIN
  IF p_bypass_rls THEN
    -- Cron-only branch. row_security off skips RLS so we see every household.
    SET LOCAL row_security = off;
    v_household_id := NULL;
  ELSE
    v_household_id := budget.get_current_household();
    IF v_household_id IS NULL THEN
      RETURN 0;
    END IF;
  END IF;

  FOR r IN
    SELECT s.*
    FROM budget.subscription s
    WHERE s.active
      AND s.next_renewal_at <= current_date
      AND (v_household_id IS NULL OR s.household_id = v_household_id)
  LOOP
    -- The partial unique index on (subscription_id, occurrence_date) is what
    -- makes replay idempotent — a duplicate run no-ops on the conflict.
    INSERT INTO budget.transaction (
      id, household_id, type, amount_cents, occurred_on, category_id,
      notes, paid_by_member_id, for_member_id, essential_pct, split_rule,
      subscription_id, occurrence_date
    ) VALUES (
      gen_random_uuid(), r.household_id, 'expense', r.amount_cents,
      r.next_renewal_at, r.category_id, r.merchant, r.paid_by_member_id,
      r.for_member_id, r.essential_pct, r.split_rule, r.id, r.next_renewal_at
    )
    ON CONFLICT (subscription_id, occurrence_date)
      WHERE subscription_id IS NOT NULL AND occurrence_date IS NOT NULL
      DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;

    v_next := CASE r.cadence
      WHEN 'weekly'    THEN r.next_renewal_at + INTERVAL '7 days'
      WHEN 'biweekly'  THEN r.next_renewal_at + INTERVAL '14 days'
      WHEN 'monthly'   THEN r.next_renewal_at + INTERVAL '1 month'
      WHEN 'quarterly' THEN r.next_renewal_at + INTERVAL '3 months'
      WHEN 'yearly'    THEN r.next_renewal_at + INTERVAL '1 year'
    END;

    UPDATE budget.subscription
       SET next_renewal_at = v_next
     WHERE id = r.id;
  END LOOP;

  RETURN v_count;
END;
$$;

ALTER FUNCTION budget.materialize_due_subscriptions(BOOLEAN) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION budget.materialize_due_subscriptions(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION budget.materialize_due_subscriptions(BOOLEAN) TO authenticated;
