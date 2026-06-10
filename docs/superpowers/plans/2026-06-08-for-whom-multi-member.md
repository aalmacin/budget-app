# For Whom — Multi-Member Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `for_member_id UUID` column with `for_member_ids UUID[]` across the DB schema, RPCs, validators, and UI so expenses can be assigned to multiple household members simultaneously.

**Architecture:** Three forward migrations handle the DB transition (add array column → drop old column + update trigger → update all RPCs). TypeScript changes flow from validators → ForWhomChips → form state → server actions → data display.

**Tech Stack:** PostgreSQL (Supabase), Next.js 15 App Router, Zod, Redux Toolkit, Tailwind CSS

---

## File Map

**Create:**
- `supabase/migrations/20260608000001_for_member_ids_backfill.sql`
- `supabase/migrations/20260608000002_drop_for_member_id.sql`
- `supabase/migrations/20260608000003_rpc_for_member_ids.sql`

**Modify:**
- `lib/validators/transaction.ts`
- `components/transactions/ForWhomChips.tsx`
- `components/transactions/EditTxnSheet.tsx`
- `components/quick-add/QuickAddTile.tsx`
- `app/(app)/add/AddExpenseForm.tsx`
- `app/(app)/add/page.tsx`
- `app/(app)/add/actions.ts`
- `app/(app)/transactions/TransactionsList.tsx`
- `app/(app)/recurring-transactions/[id]/add/page.tsx`
- `app/(app)/recurring-transactions/actions.ts`
- `app/(app)/quick-add/page.tsx`

---

## Task 1: Migration — Add for_member_ids and back-fill

**Files:**
- Create: `supabase/migrations/20260608000001_for_member_ids_backfill.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add for_member_ids UUID[] to transaction and saved_expense, back-filling
-- from for_member_id. The drop migration (20260608000002) follows next.

ALTER TABLE public.transaction
  ADD COLUMN for_member_ids UUID[];

ALTER TABLE public.saved_expense
  ADD COLUMN for_member_ids UUID[];

UPDATE public.transaction
   SET for_member_ids = ARRAY[for_member_id]
 WHERE for_member_id IS NOT NULL;

UPDATE public.saved_expense
   SET for_member_ids = ARRAY[for_member_id]
 WHERE for_member_id IS NOT NULL;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260608000001_for_member_ids_backfill.sql
git commit -m "migration: add for_member_ids array column and back-fill from for_member_id"
```

---

## Task 2: Migration — Drop for_member_id and update trigger

**Files:**
- Create: `supabase/migrations/20260608000002_drop_for_member_id.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Drop for_member_id from transaction and saved_expense.
-- Recreate enforce_member_household to validate array elements instead.

DROP TRIGGER IF EXISTS transaction_member_household ON public.transaction;
DROP FUNCTION IF EXISTS public.enforce_member_household();

ALTER TABLE public.transaction
  DROP COLUMN for_member_id;

ALTER TABLE public.saved_expense
  DROP COLUMN for_member_id;

CREATE FUNCTION public.enforce_member_household()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member_id UUID;
BEGIN
  IF NEW.for_member_ids IS NOT NULL THEN
    FOREACH v_member_id IN ARRAY NEW.for_member_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.household_member
        WHERE id = v_member_id AND household_id = NEW.household_id
      ) THEN
        RAISE EXCEPTION 'for_member_ids element % does not belong to this household', v_member_id
          USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  IF NEW.paid_by_member_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.household_member
      WHERE id = NEW.paid_by_member_id AND household_id = NEW.household_id
    ) THEN
      RAISE EXCEPTION 'paid_by_member_id does not belong to this household'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.enforce_member_household() OWNER TO budget_function_owner;

CREATE CONSTRAINT TRIGGER transaction_member_household
  AFTER INSERT OR UPDATE OF household_id, for_member_ids, paid_by_member_id
  ON public.transaction
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_household();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260608000002_drop_for_member_id.sql
git commit -m "migration: drop for_member_id column and update household member trigger to validate array"
```

---

## Task 3: Migration — Update all RPCs

**Files:**
- Create: `supabase/migrations/20260608000003_rpc_for_member_ids.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Update all RPCs that reference for_member_id to use for_member_ids UUID[].
-- Functions with changed return types are DROPped first (CREATE OR REPLACE
-- cannot change OUT-parameter types).

-- ---------------------------------------------------------------------------
-- list_transactions: replace for_member_id UUID with for_member_ids UUID[].
-- for_member_display_name stays TEXT — now pre-computed from array join.
-- Filter: ANY() instead of equality.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_transactions(JSONB);

CREATE FUNCTION public.list_transactions(p_filters JSONB)
RETURNS TABLE (
  id                      UUID,
  type                    TEXT,
  amount_cents            BIGINT,
  category_id             UUID,
  category_name           TEXT,
  notes                   TEXT,
  for_member_ids          UUID[],
  for_member_display_name TEXT,
  paid_by_member_id       UUID,
  paid_by_display_name    TEXT,
  split_rule              TEXT,
  income_source           TEXT,
  occurred_on             DATE,
  essential_pct           SMALLINT,
  total_count             BIGINT
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
  v_category     UUID := nullif(p_filters->>'category_id', '')::UUID;
  v_from         DATE := nullif(p_filters->>'from', '')::DATE;
  v_to           DATE := nullif(p_filters->>'to', '')::DATE;
  v_limit        INT  := coalesce((p_filters->>'limit')::INT, 100);
  v_offset       INT  := coalesce((p_filters->>'offset')::INT, 0);
BEGIN
  IF v_household_id IS NULL THEN
    RETURN;
  END IF;
  IF v_limit  > 500 THEN v_limit  := 500; END IF;
  IF v_limit  < 1   THEN v_limit  := 1;   END IF;
  IF v_offset < 0   THEN v_offset := 0;   END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT t.id, t.type, t.amount_cents,
           t.category_id, c.name AS category_name,
           t.notes,
           t.for_member_ids,
           t.paid_by_member_id, pm.display_name AS paid_by_display_name,
           t.split_rule, t.income_source,
           t.occurred_on, t.essential_pct,
           t.created_at
    FROM public.transaction t
    LEFT JOIN public.category         c  ON c.id  = t.category_id
    LEFT JOIN public.household_member pm ON pm.id = t.paid_by_member_id
    WHERE t.household_id = v_household_id
      AND (v_search     IS NULL OR to_tsvector('simple', t.notes) @@ plainto_tsquery('simple', v_search))
      AND (v_essential  IS NULL
           OR (v_essential = 'essential' AND t.essential_pct >= 50)
           OR (v_essential = 'treats'    AND t.essential_pct <  50))
      AND (v_for_member IS NULL OR v_for_member = ANY(t.for_member_ids))
      AND (v_category   IS NULL OR t.category_id = v_category)
      AND (v_from       IS NULL OR t.occurred_on >= v_from)
      AND (v_to         IS NULL OR t.occurred_on <  v_to)
  )
  SELECT f.id, f.type, f.amount_cents,
         f.category_id, f.category_name,
         f.notes,
         f.for_member_ids,
         (SELECT string_agg(hm.display_name, ', ')
          FROM public.household_member hm
          WHERE hm.id = ANY(f.for_member_ids)) AS for_member_display_name,
         f.paid_by_member_id, f.paid_by_display_name,
         f.split_rule, f.income_source,
         f.occurred_on, f.essential_pct,
         count(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.occurred_on DESC, f.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

ALTER FUNCTION public.list_transactions(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_transactions(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_transactions(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- _insert_transaction: extract for_member_ids UUID[] from JSON array.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._insert_transaction(p_type TEXT, p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id   UUID     := public.get_current_household();
  v_id             UUID     := coalesce(nullif(p->>'id', '')::UUID, gen_random_uuid());
  v_amount         BIGINT   := (p->>'amount_cents')::BIGINT;
  v_occurred       DATE     := coalesce(nullif(p->>'occurred_on', '')::DATE, current_date);
  v_category       UUID     := (p->>'category_id')::UUID;
  v_notes          TEXT     := coalesce(p->>'notes', '');
  v_paid_by        UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member_ids UUID[]   := CASE
    WHEN jsonb_typeof(p->'for_member_ids') = 'array'
      AND jsonb_array_length(p->'for_member_ids') > 0
    THEN (SELECT array_agg(v::UUID) FROM jsonb_array_elements_text(p->'for_member_ids') v)
    ELSE NULL
  END;
  v_essential      SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split          TEXT     := nullif(p->>'split_rule', '');
  v_income_src     TEXT     := nullif(p->>'income_source', '');
  v_sub_id         UUID     := nullif(p->>'subscription_id', '')::UUID;
  v_occ_date       DATE     := nullif(p->>'occurrence_date', '')::DATE;
  v_cat_visible    BOOLEAN;
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
    paid_by_member_id, for_member_ids, essential_pct, split_rule, income_source,
    subscription_id, occurrence_date
  ) VALUES (
    v_id, v_household_id, p_type, v_amount, v_occurred, v_category, v_notes,
    v_paid_by, v_for_member_ids, v_essential, v_split, v_income_src,
    v_sub_id, v_occ_date
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN v_id;
END;
$$;

ALTER FUNCTION public._insert_transaction(TEXT, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public._insert_transaction(TEXT, JSONB) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- update_transaction: accept for_member_ids JSON array in patch.
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
         for_member_ids    = CASE WHEN p_patch ? 'for_member_ids'
                                  THEN CASE
                                    WHEN jsonb_typeof(p_patch->'for_member_ids') = 'array'
                                      AND jsonb_array_length(p_patch->'for_member_ids') > 0
                                    THEN (SELECT array_agg(v::UUID)
                                          FROM jsonb_array_elements_text(p_patch->'for_member_ids') v)
                                    ELSE NULL
                                  END
                                  ELSE for_member_ids END,
         split_rule        = CASE WHEN p_patch ? 'split_rule'
                                  THEN nullif(p_patch->>'split_rule', '')
                                  ELSE split_rule END,
         income_source     = CASE WHEN p_patch ? 'income_source'
                                  THEN nullif(p_patch->>'income_source', '')
                                  ELSE income_source END
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.update_transaction(UUID, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_transaction(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_transaction(UUID, JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- log_expense_with_subscription: use for_member_ids in transaction insert.
-- subscription.for_member_id stores the first element (subscription table is
-- not being migrated to arrays in this change).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_expense_with_subscription(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id   UUID     := public.get_current_household();
  v_amount         BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category       UUID     := nullif(p->>'category_id', '')::UUID;
  v_occurred_on    DATE     := nullif(p->>'occurred_on', '')::DATE;
  v_notes          TEXT     := coalesce(nullif(p->>'notes', ''), '');
  v_paid_by        UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member_ids UUID[]   := CASE
    WHEN jsonb_typeof(p->'for_member_ids') = 'array'
      AND jsonb_array_length(p->'for_member_ids') > 0
    THEN (SELECT array_agg(v::UUID) FROM jsonb_array_elements_text(p->'for_member_ids') v)
    ELSE NULL
  END;
  v_essential      SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split_rule     TEXT     := nullif(p->>'split_rule', '');
  v_cadence        TEXT     := nullif(p->>'cadence', '');
  v_interval       INT      := nullif(p->>'interval_days', '')::INT;
  v_start_date     DATE     := nullif(p->>'start_date', '')::DATE;
  v_next           DATE;
  v_sub_id         UUID;
  v_tx_id          UUID;
  v_cat_visible    BOOLEAN;
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
    v_next, v_paid_by, v_for_member_ids[1],
    v_essential, v_split_rule, v_interval, NULL
  )
  RETURNING id INTO v_sub_id;

  INSERT INTO public.transaction (
    id, household_id, type, amount_cents, occurred_on, category_id,
    notes, paid_by_member_id, for_member_ids, essential_pct, split_rule,
    subscription_id, occurrence_date
  ) VALUES (
    gen_random_uuid(), v_household_id, 'expense', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, v_for_member_ids, v_essential, v_split_rule,
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
-- log_subscription_expense: use for_member_ids in transaction insert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_subscription_expense(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id   UUID     := public.get_current_household();
  v_sub_id         UUID     := nullif(p->>'subscription_id', '')::UUID;
  v_amount         BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category       UUID     := nullif(p->>'category_id', '')::UUID;
  v_occurred_on    DATE     := nullif(p->>'occurred_on', '')::DATE;
  v_notes          TEXT     := coalesce(nullif(p->>'notes', ''), '');
  v_paid_by        UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member_ids UUID[]   := CASE
    WHEN jsonb_typeof(p->'for_member_ids') = 'array'
      AND jsonb_array_length(p->'for_member_ids') > 0
    THEN (SELECT array_agg(v::UUID) FROM jsonb_array_elements_text(p->'for_member_ids') v)
    ELSE NULL
  END;
  v_essential      SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split_rule     TEXT     := nullif(p->>'split_rule', '');
  v_sub            public.subscription;
  v_next           DATE;
  v_tx_id          UUID;
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
    gen_random_uuid(), v_household_id, 'expense', v_amount, v_occurred_on, v_category,
    v_notes, v_paid_by, v_for_member_ids, v_essential, v_split_rule,
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

ALTER FUNCTION public.log_subscription_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_subscription_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_expense(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- list_quick_add_options: return for_member_ids UUID[] instead of
-- for_member_id UUID. Subscription rows wrap their single UUID in an array.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_quick_add_options(INT);

CREATE FUNCTION public.list_quick_add_options(p_limit INT)
RETURNS TABLE (
  source         TEXT,
  ref_id         UUID,
  label          TEXT,
  category_id    UUID,
  category_name  TEXT,
  amount_cents   BIGINT,
  for_member_ids UUID[]
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
    SELECT t.id, t.category_id, t.amount_cents, t.for_member_ids,
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
      id, category_id, category_name, amount_cents, for_member_ids
    FROM recent_raw
  ),
  recent_capped AS (
    SELECT 'recent'::TEXT AS source, id AS ref_id, category_name AS label,
           category_id, category_name, amount_cents, for_member_ids
    FROM recent_dedup
    LIMIT v_limit
  ),
  subs AS (
    SELECT 'subscription'::TEXT AS source, s.id AS ref_id, s.merchant AS label,
           s.category_id, c.name AS category_name, s.amount_cents,
           CASE WHEN s.for_member_id IS NULL THEN NULL
                ELSE ARRAY[s.for_member_id] END AS for_member_ids
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
-- get_dashboard_summary: pre-join member display names from the array.
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
      'for_member_display_name', (
        SELECT string_agg(hm.display_name, ', ')
        FROM public.household_member hm
        WHERE hm.id = ANY(t.for_member_ids)
      ),
      'occurred_on', t.occurred_on
    ) AS row
    FROM public.transaction t
    JOIN public.category c ON c.id = t.category_id
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

-- ---------------------------------------------------------------------------
-- list_saved_expenses: return for_member_ids UUID[] instead of for_member_id.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_saved_expenses();

CREATE FUNCTION public.list_saved_expenses()
RETURNS TABLE (
  id                 UUID,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  category_name      TEXT,
  paid_by_member_id  UUID,
  for_member_ids     UUID[],
  essential_pct      SMALLINT,
  split_rule         TEXT,
  last_used_at       TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id, c.name,
         s.paid_by_member_id, s.for_member_ids, s.essential_pct, s.split_rule,
         s.last_used_at
  FROM public.saved_expense s
  JOIN public.category c ON c.id = s.category_id
  WHERE s.household_id = public.get_current_household()
  ORDER BY s.last_used_at DESC, s.created_at DESC
$$;

ALTER FUNCTION public.list_saved_expenses() OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.list_saved_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_saved_expenses() TO authenticated;

-- ---------------------------------------------------------------------------
-- get_saved_expense: return for_member_ids UUID[] instead of for_member_id.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_saved_expense(UUID);

CREATE FUNCTION public.get_saved_expense(p_id UUID)
RETURNS TABLE (
  id                 UUID,
  merchant           TEXT,
  amount_cents       BIGINT,
  category_id        UUID,
  paid_by_member_id  UUID,
  for_member_ids     UUID[],
  essential_pct      SMALLINT,
  split_rule         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.id, s.merchant, s.amount_cents, s.category_id,
         s.paid_by_member_id, s.for_member_ids, s.essential_pct, s.split_rule
  FROM public.saved_expense s
  WHERE s.id = p_id
    AND s.household_id = public.get_current_household()
$$;

ALTER FUNCTION public.get_saved_expense(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.get_saved_expense(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saved_expense(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- create_saved_expense: accept for_member_ids JSON array.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_saved_expense(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id   UUID     := public.get_current_household();
  v_merchant       TEXT     := nullif(p->>'merchant', '');
  v_amount         BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category       UUID     := nullif(p->>'category_id', '')::UUID;
  v_paid_by        UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member_ids UUID[]   := CASE
    WHEN jsonb_typeof(p->'for_member_ids') = 'array'
      AND jsonb_array_length(p->'for_member_ids') > 0
    THEN (SELECT array_agg(v::UUID) FROM jsonb_array_elements_text(p->'for_member_ids') v)
    ELSE NULL
  END;
  v_essential      SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split          TEXT     := nullif(p->>'split_rule', '');
  v_cat_owned      BOOLEAN;
  v_id             UUID;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_category IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id = v_household_id)
    INTO v_cat_owned
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_owned IS NULL OR NOT v_cat_owned THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.saved_expense (
    household_id, merchant, amount_cents, category_id,
    paid_by_member_id, for_member_ids, essential_pct, split_rule
  ) VALUES (
    v_household_id, v_merchant, v_amount, v_category,
    v_paid_by, v_for_member_ids, v_essential, v_split
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

ALTER FUNCTION public.create_saved_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.create_saved_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_saved_expense(JSONB) TO authenticated;

-- ---------------------------------------------------------------------------
-- update_saved_expense: accept for_member_ids JSON array.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_saved_expense(p_id UUID, p JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id   UUID     := public.get_current_household();
  v_merchant       TEXT     := nullif(p->>'merchant', '');
  v_amount         BIGINT   := (p->>'amount_cents')::BIGINT;
  v_category       UUID     := nullif(p->>'category_id', '')::UUID;
  v_paid_by        UUID     := nullif(p->>'paid_by_member_id', '')::UUID;
  v_for_member_ids UUID[]   := CASE
    WHEN jsonb_typeof(p->'for_member_ids') = 'array'
      AND jsonb_array_length(p->'for_member_ids') > 0
    THEN (SELECT array_agg(v::UUID) FROM jsonb_array_elements_text(p->'for_member_ids') v)
    ELSE NULL
  END;
  v_essential      SMALLINT := coalesce((p->>'essential_pct')::SMALLINT, 100);
  v_split          TEXT     := nullif(p->>'split_rule', '');
  v_cat_owned      BOOLEAN;
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF v_merchant IS NULL OR v_amount IS NULL OR v_amount <= 0 OR v_category IS NULL THEN
    RAISE EXCEPTION 'Missing or invalid required field' USING ERRCODE = '22023';
  END IF;

  SELECT (c.household_id = v_household_id)
    INTO v_cat_owned
    FROM public.category c
   WHERE c.id = v_category;
  IF v_cat_owned IS NULL OR NOT v_cat_owned THEN
    RAISE EXCEPTION 'category_id % not visible to household', v_category USING ERRCODE = '42501';
  END IF;

  UPDATE public.saved_expense
     SET merchant          = v_merchant,
         amount_cents      = v_amount,
         category_id       = v_category,
         paid_by_member_id = v_paid_by,
         for_member_ids    = v_for_member_ids,
         essential_pct     = v_essential,
         split_rule        = v_split
   WHERE id = p_id
     AND household_id = v_household_id;
END;
$$;

ALTER FUNCTION public.update_saved_expense(UUID, JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_saved_expense(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_saved_expense(UUID, JSONB) TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260608000003_rpc_for_member_ids.sql
git commit -m "migration: update all RPCs from for_member_id to for_member_ids array"
```

---

## Task 4: Update validators

**Files:**
- Modify: `lib/validators/transaction.ts:14-52`

- [ ] **Step 1: Replace for_member_id with for_member_ids in logExpenseSchema and updateTransactionSchema**

In `lib/validators/transaction.ts`, replace:

```typescript
export const logExpenseSchema = z.object({
  id: uuidSchema.optional(),
  amount_cents: moneyCentsSchema,
  occurred_on: isoDate.optional(),
  category_id: uuidSchema,
  notes: z.string().max(200).optional().default(""),
  paid_by_member_id: uuidSchema.nullable().optional(),
  for_member_id: uuidSchema.nullable().optional(),
  essential_pct: percent0to100Schema.optional(),
  split_rule: splitRuleSchema.nullable().optional(),
  subscription_id: uuidSchema.nullable().optional(),
  occurrence_date: isoDate.nullable().optional(),
});
```

with:

```typescript
export const logExpenseSchema = z.object({
  id: uuidSchema.optional(),
  amount_cents: moneyCentsSchema,
  occurred_on: isoDate.optional(),
  category_id: uuidSchema,
  notes: z.string().max(200).optional().default(""),
  paid_by_member_id: uuidSchema.nullable().optional(),
  for_member_ids: z.array(uuidSchema).optional().default([]),
  essential_pct: percent0to100Schema.optional(),
  split_rule: splitRuleSchema.nullable().optional(),
  subscription_id: uuidSchema.nullable().optional(),
  occurrence_date: isoDate.nullable().optional(),
});
```

And replace:

```typescript
export const updateTransactionSchema = z.object({
  id: uuidSchema,
  patch: z.object({
    amount_cents: moneyCentsSchema.optional(),
    occurred_on: isoDate.optional(),
    category_id: uuidSchema.optional(),
    notes: z.string().max(200).optional(),
    paid_by_member_id: uuidSchema.nullable().optional(),
    for_member_id: uuidSchema.nullable().optional(),
    essential_pct: percent0to100Schema.optional(),
    split_rule: splitRuleSchema.nullable().optional(),
  }),
});
```

with:

```typescript
export const updateTransactionSchema = z.object({
  id: uuidSchema,
  patch: z.object({
    amount_cents: moneyCentsSchema.optional(),
    occurred_on: isoDate.optional(),
    category_id: uuidSchema.optional(),
    notes: z.string().max(200).optional(),
    paid_by_member_id: uuidSchema.nullable().optional(),
    for_member_ids: z.array(uuidSchema).optional(),
    essential_pct: percent0to100Schema.optional(),
    split_rule: splitRuleSchema.nullable().optional(),
  }),
});
```

- [ ] **Step 2: Verify types compile**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-02 && npx tsc --noEmit 2>&1 | head -30
```

Expected: errors will exist until remaining TypeScript files are updated.

- [ ] **Step 3: Commit**

```bash
git add lib/validators/transaction.ts
git commit -m "feat: update logExpenseSchema and updateTransactionSchema to use for_member_ids array"
```

---

## Task 5: Update ForWhomChips

**Files:**
- Modify: `components/transactions/ForWhomChips.tsx`

- [ ] **Step 1: Rewrite ForWhomChips for multi-select**

Replace the entire file content:

```tsx
"use client";

import { Chip } from "@/components/ui/Chip";

export type ForWhomOption = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
};

type Props = {
  members: ForWhomOption[];
  /** Selected member ids. Empty array = "whole household". */
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, renders hidden inputs named `for_member_ids[]` for native form posts. */
  asFormField?: boolean;
};

export function ForWhomChips({ members, value, onChange, asFormField }: Props) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <>
      <div className="flex flex-wrap gap-2 py-1">
        <Chip selected={value.length === 0} onClick={() => onChange([])}>
          Household
        </Chip>
        {members.map((m) => (
          <Chip
            key={m.id}
            selected={value.includes(m.id)}
            onClick={() => toggle(m.id)}
          >
            {m.display_name}
          </Chip>
        ))}
      </div>
      {asFormField &&
        value.map((id) => (
          <input key={id} type="hidden" name="for_member_ids[]" value={id} />
        ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/transactions/ForWhomChips.tsx
git commit -m "feat: update ForWhomChips to multi-select with for_member_ids[] hidden inputs"
```

---

## Task 6: Update EditTxnSheet

**Files:**
- Modify: `components/transactions/EditTxnSheet.tsx:16-29,34,95,125,141`

- [ ] **Step 1: Update EditableTxn type, SavePatch type, and forMember state**

In `components/transactions/EditTxnSheet.tsx`:

Replace the `EditableTxn` type:
```typescript
export type EditableTxn = {
  id: string;
  type: "expense" | "income";
  amount_cents: bigint;
  notes: string;
  essential_pct: number;
  occurred_on: string;
  category_id: string | null;
  category_name: string;
  for_member_ids: string[];
  paid_by_member_id: string | null;
  split_rule: string | null;
  income_source: string | null;
};
```

Replace the `SavePatch` type:
```typescript
type SavePatch = Record<string, string | number | null | string[]>;
```

Replace the `forMember` state initializer (line 95):
```typescript
const [forMember, setForMember] = useState<string[]>(txn.for_member_ids);
```

Replace the patch assignment inside the `else` block (line 141):
```typescript
patch.for_member_ids = forMember;
```

- [ ] **Step 2: Commit**

```bash
git add components/transactions/EditTxnSheet.tsx
git commit -m "feat: update EditTxnSheet to use for_member_ids string array"
```

---

## Task 7: Update QuickAddTile and AddExpenseForm types

**Files:**
- Modify: `components/quick-add/QuickAddTile.tsx:14`
- Modify: `app/(app)/add/AddExpenseForm.tsx:29,82-84`

- [ ] **Step 1: Update QuickAddTileData**

In `components/quick-add/QuickAddTile.tsx`, replace:
```typescript
  for_member_id: string | null;
```
with:
```typescript
  for_member_ids: string[];
```

- [ ] **Step 2: Update ExpensePrefill and forMember state in AddExpenseForm**

In `app/(app)/add/AddExpenseForm.tsx`:

Replace in the `ExpensePrefill` type (line 29):
```typescript
  for_member_ids: string[];
```
(was `for_member_id: string | null`)

Replace the `forMember` state (lines 82-84):
```typescript
  const [forMember, setForMember] = useState<string[]>(
    prefill?.for_member_ids ?? [],
  );
```

- [ ] **Step 3: Commit**

```bash
git add components/quick-add/QuickAddTile.tsx app/(app)/add/AddExpenseForm.tsx
git commit -m "feat: update QuickAddTileData and ExpensePrefill to use for_member_ids array"
```

---

## Task 8: Update add/page.tsx and add/actions.ts

**Files:**
- Modify: `app/(app)/add/page.tsx:22-85`
- Modify: `app/(app)/add/actions.ts:65-131`

- [ ] **Step 1: Update add/page.tsx template prefill**

In `app/(app)/add/page.tsx`, replace `RawTemplate.for_member_id`:
```typescript
type RawTemplate = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  paid_by_member_id: string | null;
  for_member_ids: string[] | null;
  essential_pct: number;
  split_rule: "adult_a" | "adult_b" | "50_50" | "by_income" | null;
};
```

Replace the prefill assignment (line 82):
```typescript
        for_member_ids: tplData.for_member_ids ?? [],
```
(was `for_member_id: tplData.for_member_id`)

- [ ] **Step 2: Update add/actions.ts to extract for_member_ids from FormData**

In `app/(app)/add/actions.ts`, replace the `parsed` call (starting line 65):

```typescript
  const forMemberIds = formData.getAll("for_member_ids[]") as string[];

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_ids: forMemberIds.filter(Boolean),
  });
```

Replace the template payload (lines 125-133):
```typescript
    const templatePayload = {
      merchant,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      paid_by_member_id: parsed.data.paid_by_member_id ?? null,
      for_member_ids: parsed.data.for_member_ids ?? [],
      essential_pct: parsed.data.essential_pct ?? 100,
      split_rule: parsed.data.split_rule ?? null,
    };
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/add/page.tsx" "app/(app)/add/actions.ts"
git commit -m "feat: update add page and action to read for_member_ids[] from FormData"
```

---

## Task 9: Update TransactionsList

**Files:**
- Modify: `app/(app)/transactions/TransactionsList.tsx:11-37,51-68,176-188`

- [ ] **Step 1: Update RawTxn, RowWithPaid, toRows, and setEditing**

In `app/(app)/transactions/TransactionsList.tsx`:

Replace `RawTxn` type (lines 11-27):
```typescript
type RawTxn = {
  id: string;
  type: "expense" | "income";
  amount_cents: number | string;
  category_id: string | null;
  category_name: string;
  notes: string;
  for_member_ids: string[] | null;
  for_member_display_name: string | null;
  paid_by_member_id: string | null;
  paid_by_display_name: string | null;
  split_rule: string | null;
  income_source: string | null;
  occurred_on: string;
  essential_pct: number;
  total_count: number | string;
};
```

Replace `RowWithPaid` type (lines 29-37):
```typescript
type RowWithPaid = ActivityRowData & {
  essential_pct: number;
  paid_by_display_name: string | null;
  category_id: string | null;
  for_member_ids: string[];
  paid_by_member_id: string | null;
  split_rule: string | null;
  income_source: string | null;
};
```

Replace `toRows` mapping (lines 51-68):
```typescript
function toRows(data: RawTxn[]): RowWithPaid[] {
  return data.map((r) => ({
    id: r.id,
    type: r.type,
    amount_cents: BigInt(typeof r.amount_cents === "string" ? r.amount_cents : r.amount_cents),
    category_name: r.category_name,
    notes: r.notes,
    for_member_display_name: r.for_member_display_name,
    occurred_on: r.occurred_on,
    essential_pct: r.essential_pct,
    paid_by_display_name: r.paid_by_display_name,
    category_id: r.category_id,
    for_member_ids: r.for_member_ids ?? [],
    paid_by_member_id: r.paid_by_member_id,
    split_rule: r.split_rule,
    income_source: r.income_source,
  }));
}
```

Replace `setEditing` call (lines 176-188):
```typescript
                    setEditing({
                      id: r.id,
                      type: r.type,
                      amount_cents: r.amount_cents,
                      notes: r.notes,
                      essential_pct: r.essential_pct,
                      occurred_on: r.occurred_on,
                      category_id: r.category_id,
                      category_name: r.category_name,
                      for_member_ids: r.for_member_ids,
                      paid_by_member_id: r.paid_by_member_id,
                      split_rule: r.split_rule,
                      income_source: r.income_source,
                    })
```

Also update `handleSave` signature (line 127):
```typescript
  const handleSave = async (
    id: string,
    patch: Record<string, string | number | null | string[]>,
  ) => {
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/transactions/TransactionsList.tsx"
git commit -m "feat: update TransactionsList to use for_member_ids array"
```

---

## Task 10: Update recurring-transactions add page and actions

**Files:**
- Modify: `app/(app)/recurring-transactions/[id]/add/page.tsx:24-148`
- Modify: `app/(app)/recurring-transactions/actions.ts:51-73`

- [ ] **Step 1: Update recurring-transactions add page**

In `app/(app)/recurring-transactions/[id]/add/page.tsx`:

The `PrefillRow` type keeps `for_member_id: string | null` because it comes from `get_subscription_prefill` which reads the unchanged `subscription` table. Map it to `for_member_ids` when building `ExpensePrefill`:

Replace the expense prefill assignment (lines 135-148):
```typescript
  const prefill: ExpensePrefill = {
    merchant: row.merchant,
    amount_cents: BigInt(
      typeof row.amount_cents === "string"
        ? row.amount_cents
        : Math.trunc(row.amount_cents),
    ),
    category_id: row.category_id,
    category_name: row.category_name,
    paid_by_member_id: row.paid_by_member_id,
    for_member_ids: row.for_member_id ? [row.for_member_id] : [],
    essential_pct: row.essential_pct,
    split_rule: row.split_rule,
  };
```

- [ ] **Step 2: Update logRecurringTransactionExpenseAction**

In `app/(app)/recurring-transactions/actions.ts`, replace lines 51-73:

```typescript
  const forMemberIds = formData.getAll("for_member_ids[]") as string[];

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_ids: forMemberIds.filter(Boolean),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.rpc("log_subscription_expense", {
    p: {
      subscription_id: recurringTransactionId,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      occurred_on: parsed.data.occurred_on,
      notes: parsed.data.notes,
      paid_by_member_id: parsed.data.paid_by_member_id ?? null,
      for_member_ids: parsed.data.for_member_ids ?? [],
      essential_pct: parsed.data.essential_pct ?? 100,
      split_rule: parsed.data.split_rule ?? null,
    },
  });
```

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/recurring-transactions/[id]/add/page.tsx" "app/(app)/recurring-transactions/actions.ts"
git commit -m "feat: update recurring expense logging to use for_member_ids array"
```

---

## Task 11: Update quick-add page

**Files:**
- Modify: `app/(app)/quick-add/page.tsx:23-60`

- [ ] **Step 1: Update RawSub and subscription mapping**

In `app/(app)/quick-add/page.tsx`, `RawSub` is defined as `Omit<QuickAddTileData, "amount_cents"> & { amount_cents: number | string }`. Since `QuickAddTileData.for_member_ids` is now `string[]`, `RawSub` automatically inherits it. The mapping needs to normalize `null` from the DB:

Replace the subscriptions mapping (lines 49-60):
```typescript
  const subscriptions: QuickAddTileData[] = subsRes.error
    ? []
    : ((subsRes.data ?? []) as RawSub[])
        .filter((r) => r.source === "subscription")
        .map((r) => ({
          ...r,
          for_member_ids: r.for_member_ids ?? [],
          amount_cents: BigInt(
            typeof r.amount_cents === "string"
              ? r.amount_cents
              : Math.trunc(r.amount_cents),
          ),
        }));
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/quick-add/page.tsx"
git commit -m "feat: update quick-add page to normalize for_member_ids from RPC response"
```

---

## Task 12: Type-check and final commit

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compiler**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-02 && npx tsc --noEmit 2>&1
```

Expected: No errors. If errors appear, fix them before proceeding.

- [ ] **Step 2: Run build**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-02 && npm run build 2>&1 | tail -20
```

Expected: Build completes successfully.

- [ ] **Step 3: Commit if clean**

```bash
git status
```

If any files remain modified after the earlier task commits, stage and commit them:

```bash
git add -p
git commit -m "chore: fix remaining type errors from for_member_ids migration"
```
