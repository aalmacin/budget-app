-- log_income_with_subscription and log_subscription_income both referenced
-- for_member_id on the transaction table, which was dropped in
-- 20260609000004_drop_for_member_id. Income transactions don't use member
-- assignment, so the column is removed from both INSERTs.

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
    notes, paid_by_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'income', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, 100, NULL,
    v_sub_id, v_start_date
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

ALTER FUNCTION public.log_income_with_subscription(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_income_with_subscription(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_income_with_subscription(JSONB) TO authenticated;

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
    notes, paid_by_member_id, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'income', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, 100, NULL,
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
