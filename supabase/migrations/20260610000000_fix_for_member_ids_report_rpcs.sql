-- 20260609000004 dropped transaction.for_member_id, and 20260609000005
-- updated the RPCs that referenced it — but missed four functions whose
-- latest definitions still query/insert the dropped column. Each call now
-- fails with 42703 ("column for_member_id does not exist"):
--
--   * monthly_expense_comparison  (reports → monthly shows "No data yet")
--   * per_person_breakdown        (reports → per-person)
--   * log_income_with_subscription
--   * log_subscription_income
--
-- Per-person amounts follow the for-whom-multi-member design: an expense is
-- split equally across its for_member_ids (amount_cents / cardinality);
-- NULL/empty array means the whole household ("general" spend).

-- ---------------------------------------------------------------------------
-- monthly_expense_comparison: derive the per-person breakdown from
-- for_member_ids with an equal split per listed member.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monthly_expense_comparison(
  p_today DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_result       JSONB;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(months.month_row ORDER BY months.month_start DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT
      m.month_start,
      jsonb_build_object(
        'year',                EXTRACT(YEAR  FROM m.month_start)::INT,
        'month',               EXTRACT(MONTH FROM m.month_start)::INT,
        'total_cents',         m.total_cents,
        'essential_cents',     m.essential_cents,
        'non_essential_cents', m.non_essential_cents,
        'categories', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',          c.id,
            'name',        c.name,
            'spent_cents', cat_totals.spent
          ) ORDER BY c.name), '[]'::JSONB)
          FROM (
            SELECT t2.category_id, SUM(t2.amount_cents) AS spent
            FROM public.transaction t2
            WHERE t2.household_id = v_household_id
              AND t2.type = 'expense'
              AND date_trunc('month', t2.occurred_on) = m.month_start
            GROUP BY t2.category_id
          ) cat_totals
          JOIN public.category c ON c.id = cat_totals.category_id
        ),
        'people', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id',          hm.id,
            'name',        hm.display_name,
            'spent_cents', person_totals.spent
          ) ORDER BY hm.display_name), '[]'::JSONB)
          FROM (
            SELECT shares.member_id, SUM(shares.share_cents) AS spent
            FROM (
              SELECT unnest(t3.for_member_ids) AS member_id,
                     (t3.amount_cents / cardinality(t3.for_member_ids))::BIGINT AS share_cents
              FROM public.transaction t3
              WHERE t3.household_id = v_household_id
                AND t3.type = 'expense'
                AND t3.for_member_ids IS NOT NULL
                AND cardinality(t3.for_member_ids) > 0
                AND date_trunc('month', t3.occurred_on) = m.month_start
            ) shares
            GROUP BY shares.member_id
          ) person_totals
          JOIN public.household_member hm ON hm.id = person_totals.member_id
        )
      ) AS month_row
    FROM (
      SELECT
        date_trunc('month', t.occurred_on) AS month_start,
        SUM(t.amount_cents)                                            AS total_cents,
        SUM((t.amount_cents * t.essential_pct / 100)::BIGINT)          AS essential_cents,
        SUM((t.amount_cents * (100 - t.essential_pct) / 100)::BIGINT)  AS non_essential_cents
      FROM public.transaction t
      WHERE t.household_id = v_household_id
        AND t.type = 'expense'
      GROUP BY date_trunc('month', t.occurred_on)
    ) m
  ) months;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.monthly_expense_comparison(DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.monthly_expense_comparison(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_expense_comparison(DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- per_person_breakdown: spent_cents is now the member's equal share of each
-- expense listing them; the "general" pool is for_member_ids NULL or empty.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.per_person_breakdown(
  p_year INT, p_month INT, p_include_general BOOLEAN
)
RETURNS TABLE (
  member_id              UUID,
  display_name           TEXT,
  role                   TEXT,
  spent_cents            BIGINT,
  share_of_general_cents BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_start DATE;
  v_end   DATE;
  v_general BIGINT;
  v_member_count INT;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  v_start := make_date(p_year, p_month, 1);
  v_end   := (v_start + INTERVAL '1 month')::DATE;

  SELECT count(*) INTO v_member_count
  FROM public.household_member
  WHERE household_id = v_household_id
    AND deleted_at IS NULL;

  IF p_include_general THEN
    SELECT coalesce(sum(amount_cents), 0) INTO v_general
    FROM public.transaction
    WHERE household_id = v_household_id
      AND type = 'expense'
      AND (for_member_ids IS NULL OR cardinality(for_member_ids) = 0)
      AND occurred_on >= v_start
      AND occurred_on <  v_end;
  ELSE
    v_general := 0;
  END IF;

  RETURN QUERY
  SELECT hm.id,
         hm.display_name,
         hm.role,
         coalesce(sum(t.amount_cents / cardinality(t.for_member_ids)), 0)::BIGINT AS spent_cents,
         CASE WHEN p_include_general AND v_member_count > 0
              THEN (v_general / v_member_count)::BIGINT
              ELSE 0::BIGINT
         END AS share_of_general_cents
  FROM public.household_member hm
  LEFT JOIN public.transaction t
         ON hm.id = ANY(t.for_member_ids)
        AND t.type = 'expense'
        AND t.occurred_on >= v_start
        AND t.occurred_on <  v_end
  WHERE hm.household_id = v_household_id
    AND hm.deleted_at IS NULL
  GROUP BY hm.id, hm.display_name, hm.role
  ORDER BY hm.created_at;
END;
$$;

ALTER FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.per_person_breakdown(INT, INT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_income_with_subscription: income transactions carry no for-member
-- attribution; insert NULL into for_member_ids instead of the dropped column.
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
    notes, paid_by_member_id, for_member_ids, essential_pct, split_rule,
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
-- log_subscription_income: same column rename in the transaction insert.
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
    notes, paid_by_member_id, for_member_ids, essential_pct, split_rule,
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
