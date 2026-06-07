# Inline Recurring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the standalone subscription create form with a "Recurring" checkbox on `/add` and `/add-income`. Add income subscriptions to the schema. Generalize `/subscriptions/[id]/add` to handle both expense and income.

**Architecture:** One forward DB migration adds `type` + `income_source` to `subscription` and ships three new RPCs (`log_expense_with_subscription`, `log_income_with_subscription`, `log_subscription_income`) plus three updated ones (returning the new fields). Both Add forms gain a shared `<RecurringFields>` component that posts cadence/interval/start_date via FormData; their server actions branch on `recurring` to call the atomic combined RPCs. The subscriptions page drops the inline create form and renders income rows with an "In" pill. `/subscriptions/[id]/add` branches on `row.type` to render either form.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres (security-definer RPCs), Tailwind v4, Vitest (unit), Playwright (E2E), zod.

**Spec:** `docs/superpowers/specs/2026-06-06-inline-recurring-design.md`

**Constraints from CLAUDE.md / memory:**
- Never edit applied migration files — only add new forward migrations.
- Latest local timestamp: `20260606000012`. Use `20260606000020_inline_recurring_subscriptions.sql` (later than latest, leaves headroom).
- Never run `supabase` commands; the user applies migrations.
- Clients call RPCs, not `.from()` against household tables.
- Don't commit without explicit user prompt.

---

## File map

### Created
- `supabase/migrations/20260606000020_inline_recurring_subscriptions.sql`
- `components/transactions/RecurringFields.tsx`
- `tests/e2e/recurring-expense.spec.ts`
- `tests/e2e/recurring-income.spec.ts`
- `tests/e2e/subscription-add-from-due-income.spec.ts`

### Modified
- `lib/validators/transaction.ts` — add `recurringSchema`.
- `app/(app)/add/AddExpenseForm.tsx` — render `<RecurringFields>` when not in subscription mode.
- `app/(app)/add/actions.ts` — branch on `recurring` formData.
- `app/(app)/add-income/AddIncomeForm.tsx` — add `prefill` + `submitAction` / `submitLabel` / `cancelHref` props; render `<RecurringFields>`.
- `app/(app)/add-income/page.tsx` — adapt to new `AddIncomeForm` signature.
- `app/(app)/add-income/actions.ts` — branch on `recurring` formData.
- `app/(app)/subscriptions/actions.ts` — add `logSubscriptionIncomeAction`; delete `registerSubscriptionAction`.
- `app/(app)/subscriptions/SubscriptionsClient.tsx` — remove inline create form; add type pills + income-source label.
- `app/(app)/subscriptions/page.tsx` — drop categories/merchants fetches; thread `type` + `income_source` through row types.
- `app/(app)/subscriptions/[id]/add/page.tsx` — branch on `row.type` to render either form.
- `app/(app)/dashboard/DueSubscriptionsCard.tsx` — add type pill; gain `type` + `income_source` on `DueRow`.
- `app/(app)/dashboard/page.tsx` — `RawDueRow` gains the two new fields.

### E2E tests updated for new flow
- `tests/e2e/subscription-add-from-due.spec.ts`
- `tests/e2e/subscription-skip.spec.ts`
- `tests/e2e/subscription-custom-days.spec.ts`
- `tests/e2e/subscription-auto-log.spec.ts`

---

## Task 1: Migration — schema + RPCs

**Files:**
- Create: `supabase/migrations/20260606000020_inline_recurring_subscriptions.sql`

- [ ] **Step 1.1: Create file with schema changes**

```sql
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
```

- [ ] **Step 1.2: Append `log_expense_with_subscription`**

```sql
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

  -- Use start_date as occurrence_date so the partial unique index makes
  -- duplicate posts idempotent. The transaction's occurred_on is what the
  -- user typed (might differ from start_date for back-dated entries).
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
```

- [ ] **Step 1.3: Append `log_income_with_subscription`**

```sql
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
```

- [ ] **Step 1.4: Append `log_subscription_income`**

```sql
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
```

- [ ] **Step 1.5: Update `list_due_subscriptions` (CREATE OR REPLACE)**

```sql
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
```

- [ ] **Step 1.6: Update `list_upcoming_subscriptions` (CREATE OR REPLACE)**

```sql
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
```

- [ ] **Step 1.7: Update `get_subscription_prefill` (CREATE OR REPLACE)**

```sql
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
```

- [ ] **Step 1.8: Ask the user to apply the migration**

Stop and ask:

> "Migration `20260606000020_inline_recurring_subscriptions.sql` is ready. Please apply it before I continue. If the timestamp collides on cloud push, bump per the `feedback_cross_branch_migrations` memory."

Wait for confirmation.

- [ ] **Step 1.9: Stage and pause**

```bash
git add supabase/migrations/20260606000020_inline_recurring_subscriptions.sql
git status
```
Do not commit — wait for user prompt.

---

## Task 2: Validator + `RecurringFields` component

**Files:**
- Modify: `lib/validators/transaction.ts`
- Create: `components/transactions/RecurringFields.tsx`

- [ ] **Step 2.1: Add `recurringSchema` to validators**

Open `lib/validators/transaction.ts`. Append, after the existing exports:

```ts
export const recurringSchema = z.object({
  cadence: z.enum([
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "yearly",
    "custom_days",
  ]),
  interval_days: z.coerce.number().int().positive().nullable().optional(),
  start_date: isoDate,
});
export type RecurringInput = z.infer<typeof recurringSchema>;
```

- [ ] **Step 2.2: Create `RecurringFields.tsx`**

Create `components/transactions/RecurringFields.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

const CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_days",
] as const;

type Cadence = (typeof CADENCES)[number];

/**
 * Shared "Recurring" block for the Add Expense and Add Income forms.
 *
 * Uncontrolled w.r.t. the parent form — fields post via FormData under their
 * `name` attributes. When the checkbox is off, inner fields are unmounted so
 * the parent form never sees stale recurring values.
 */
export function RecurringFields({ todayIso }: { todayIso: string }) {
  const [recurring, setRecurring] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("monthly");

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="recurring"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4"
        />
        Recurring
      </label>

      {recurring && (
        <div className="flex flex-col gap-2 pl-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">
              Cadence
            </span>
            <select
              name="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c === "custom_days" ? "custom (days)" : c}
                </option>
              ))}
            </select>
          </label>

          {cadence === "custom_days" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted font-mono uppercase tracking-wider">
                Interval days
              </span>
              <Input
                type="number"
                name="interval_days"
                inputMode="numeric"
                step="1"
                min="1"
                defaultValue="30"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">
              Start date
            </span>
            <Input
              type="date"
              name="start_date"
              defaultValue={todayIso}
              required
            />
          </label>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2.3: Typecheck**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-03 && bun run typecheck
```
Expected: PASS.

- [ ] **Step 2.4: Stage and pause**

```bash
git add lib/validators/transaction.ts components/transactions/RecurringFields.tsx
```
Surface diff; do not commit.

---

## Task 3: Expense recurring path (action + form)

**Files:**
- Modify: `app/(app)/add/actions.ts`
- Modify: `app/(app)/add/AddExpenseForm.tsx`

- [ ] **Step 3.1: Update `logExpenseAction`**

Open `app/(app)/add/actions.ts`. Replace the whole `logExpenseAction` function (keep the rest of the file).

New content:

```ts
export async function logExpenseAction(
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const supabase = await createSupabaseServerClient();

  let categoryId = (raw.category_id as string | undefined) ?? "";
  const categoryName = ((raw.category_name as string | undefined) ?? "").trim();

  if (!categoryId) {
    if (!categoryName) {
      return { error: "Pick or add a category" };
    }
    if (categoryName.length > CATEGORY_NAME_MAX) {
      return { error: `Category name must be ${CATEGORY_NAME_MAX} characters or fewer` };
    }
    const { data: ensuredId, error: ensureErr } = await supabase.rpc("ensure_category", {
      p_name: categoryName,
      p_kind: "expense",
    });
    if (ensureErr || !ensuredId) {
      return { error: ensureErr?.message ?? "Could not create category" };
    }
    categoryId = ensuredId as string;
  }

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_id: raw.for_member_id || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const isRecurring = raw.recurring === "on";

  if (isRecurring) {
    const recurringParsed = recurringSchema.safeParse({
      cadence: raw.cadence,
      interval_days: raw.interval_days || undefined,
      start_date: raw.start_date,
    });
    if (!recurringParsed.success) {
      return { error: recurringParsed.error.issues[0]?.message ?? "Invalid recurring fields" };
    }
    const r = recurringParsed.data;
    if (r.cadence === "custom_days") {
      if (!r.interval_days || r.interval_days < 1) {
        return { error: "interval_days is required for custom cadence" };
      }
    } else if (r.interval_days != null) {
      return { error: "interval_days only allowed when cadence=custom_days" };
    }

    const { error } = await supabase.rpc("log_expense_with_subscription", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
        cadence: r.cadence,
        interval_days: r.cadence === "custom_days" ? r.interval_days : null,
        start_date: r.start_date,
      },
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.rpc("log_expense", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
      },
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/subscriptions");
  redirect("/dashboard");
}
```

Also add the import at the top of the file:

```ts
import { logExpenseSchema, recurringSchema } from "@/lib/validators/transaction";
```

Replace the existing `import { logExpenseSchema } ...` line.

- [ ] **Step 3.2: Render `<RecurringFields>` in `AddExpenseForm`**

Open `app/(app)/add/AddExpenseForm.tsx`. Two changes:

a. Add import near the top:

```tsx
import { RecurringFields } from "@/components/transactions/RecurringFields";
```

b. Inside the form JSX, between the SplitRuleChips block (with hidden `paid_by_member_id`) and the template-checkbox block, insert:

```tsx
{submitAction === undefined && (
  <RecurringFields todayIso={todayIso} />
)}
```

The `submitAction === undefined` gate keeps Recurring hidden in subscription-mode prefill (the `/subscriptions/[id]/add` route).

- [ ] **Step 3.3: Typecheck**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-03 && bun run typecheck
```
Expected: PASS.

- [ ] **Step 3.4: Smoke test**

Visit `/add`. Verify:
- "Recurring" checkbox renders below the Split chips.
- Clicking it reveals Cadence + Start date.
- Selecting "custom (days)" reveals the Interval days input.
- Submit with Recurring unchecked → still posts via `log_expense` (regression check).
- Submit with Recurring checked, cadence=monthly, start_date=today → expense logged and a subscription appears on `/subscriptions`.

- [ ] **Step 3.5: Stage and pause**

```bash
git add 'app/(app)/add/actions.ts' 'app/(app)/add/AddExpenseForm.tsx'
```

---

## Task 4: Income recurring path (form refactor + action)

**Files:**
- Modify: `app/(app)/add-income/AddIncomeForm.tsx`
- Modify: `app/(app)/add-income/page.tsx`
- Modify: `app/(app)/add-income/actions.ts`

- [ ] **Step 4.1: Refactor `AddIncomeForm.tsx`**

Full new contents:

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { RecurringFields } from "@/components/transactions/RecurringFields";
import { logIncomeAction, type LogIncomeState } from "./actions";

const INITIAL: LogIncomeState = { error: null };
const SOURCES = ["Salary", "Contract", "Self_employed", "Benefit", "Refund", "Gift"] as const;

export type AdultOption = { id: string; display_name: string };

export type IncomePrefill = {
  amount_cents: bigint;
  notes: string;
  paid_by_member_id: string;
  income_source: string;
};

export type SubmitAction = (
  prev: LogIncomeState,
  formData: FormData,
) => Promise<LogIncomeState>;

type Props = {
  incomeCategoryId: string | null;
  adults: AdultOption[];
  todayIso: string;
  prefill?: IncomePrefill | null;
  submitAction?: SubmitAction;
  submitLabel?: string;
  cancelHref?: string;
};

function centsToDollars(cents: bigint): string {
  const n = Number(cents) / 100;
  return n.toFixed(2);
}

export function AddIncomeForm({
  incomeCategoryId,
  adults,
  todayIso,
  prefill,
  submitAction,
  submitLabel,
  cancelHref,
}: Props) {
  const action = submitAction ?? logIncomeAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [amount, setAmount] = useState(
    prefill ? centsToDollars(prefill.amount_cents) : "0.00",
  );

  const cents = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 100));
  })();

  if (!incomeCategoryId) {
    return (
      <p className="px-4 text-sm text-muted">
        No income category seeded — re-run migrations.
      </p>
    );
  }

  const showRecurring = submitAction === undefined;

  return (
    <form action={formAction} className="px-4 pb-32 flex flex-col gap-4" noValidate>
      <AmountHero cents={cents} label="Net amount (post-tax)" />

      <input type="hidden" name="category_id" value={incomeCategoryId} />
      <input type="hidden" name="amount_cents" value={cents.toString()} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">$ Amount</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
        <Input type="date" name="occurred_on" defaultValue={todayIso} required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Earner</span>
        <select
          name="paid_by_member_id"
          required
          defaultValue={prefill?.paid_by_member_id ?? ""}
          className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          {adults.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Source</span>
        <select
          name="income_source"
          required
          defaultValue={prefill?.income_source ?? "Salary"}
          className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Notes</span>
        <Input
          type="text"
          name="notes"
          maxLength={200}
          defaultValue={prefill?.notes ?? ""}
        />
      </label>

      {showRecurring && <RecurringFields todayIso={todayIso} />}

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-3 mt-2 -mx-4 px-4 pt-2 pb-3 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 z-10 flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : (submitLabel ?? "Save income")}
        </Button>
        {cancelHref && (
          <Link
            href={cancelHref}
            className="inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface text-ink shadow-sm hover:bg-surface-soft h-13 px-5 text-base rounded-2xl"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
```

- [ ] **Step 4.2: Update `/add-income/page.tsx`**

The page already passes `incomeCategoryId`, `adults`, `todayIso`. Now it must also pass `prefill={null}` so TS is happy with the new (optional) prop. Open the file and locate the `<AddIncomeForm />` JSX. Verify the page still compiles — the new prop is optional, so no change is required, but explicitly pass `prefill={null}` for clarity:

Change:
```tsx
<AddIncomeForm
  incomeCategoryId={incomeCategoryId}
  adults={adults}
  todayIso={today}
/>
```
to:
```tsx
<AddIncomeForm
  incomeCategoryId={incomeCategoryId}
  adults={adults}
  todayIso={today}
  prefill={null}
/>
```

(If the page already imports any now-unused types, leave the file otherwise unchanged.)

- [ ] **Step 4.3: Update `logIncomeAction`**

Open `app/(app)/add-income/actions.ts`. Replace the whole function:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  logIncomeSchema,
  recurringSchema,
} from "@/lib/validators/transaction";

export type LogIncomeState = { error: string | null };

export async function logIncomeAction(
  _prev: LogIncomeState,
  formData: FormData,
): Promise<LogIncomeState> {
  const raw = Object.fromEntries(formData);
  const parsed = logIncomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const isRecurring = raw.recurring === "on";

  if (isRecurring) {
    const recurringParsed = recurringSchema.safeParse({
      cadence: raw.cadence,
      interval_days: raw.interval_days || undefined,
      start_date: raw.start_date,
    });
    if (!recurringParsed.success) {
      return { error: recurringParsed.error.issues[0]?.message ?? "Invalid recurring fields" };
    }
    const r = recurringParsed.data;
    if (r.cadence === "custom_days") {
      if (!r.interval_days || r.interval_days < 1) {
        return { error: "interval_days is required for custom cadence" };
      }
    } else if (r.interval_days != null) {
      return { error: "interval_days only allowed when cadence=custom_days" };
    }

    const { error } = await supabase.rpc("log_income_with_subscription", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
        cadence: r.cadence,
        interval_days: r.cadence === "custom_days" ? r.interval_days : null,
        start_date: r.start_date,
      },
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.rpc("log_income", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
      },
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/subscriptions");
  redirect("/dashboard");
}
```

- [ ] **Step 4.4: Typecheck**

```bash
cd /Users/aalmacin/Projects/budget-worktree/fixes-03 && bun run typecheck
```
Expected: PASS.

- [ ] **Step 4.5: Smoke test**

Visit `/add-income`. Verify:
- "Recurring" checkbox appears between Notes and the submit area.
- Unchecked save → income still posts via `log_income`.
- Checked save with cadence=monthly → income posted AND a subscription with `type='income'` appears on `/subscriptions`.

- [ ] **Step 4.6: Stage and pause**

```bash
git add 'app/(app)/add-income/AddIncomeForm.tsx' 'app/(app)/add-income/page.tsx' 'app/(app)/add-income/actions.ts'
```

---

## Task 5: Subscription actions cleanup

**Files:**
- Modify: `app/(app)/subscriptions/actions.ts`

- [ ] **Step 5.1: Replace the whole file**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  logExpenseSchema,
  logIncomeSchema,
} from "@/lib/validators/transaction";
import type { LogExpenseState } from "../add/actions";
import type { LogIncomeState } from "../add-income/actions";

export async function pauseSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("pause_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}

export async function resumeSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resume_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}

export async function skipSubscriptionOccurrenceAction(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_subscription_occurrence", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return {};
}

export async function logSubscriptionExpenseAction(
  subscriptionId: string,
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const supabase = await createSupabaseServerClient();

  const categoryId = (raw.category_id as string | undefined) ?? "";
  if (!categoryId) {
    return { error: "Pick an existing category (subscription prefill required)" };
  }

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_id: raw.for_member_id || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.rpc("log_subscription_expense", {
    p: {
      subscription_id: subscriptionId,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      occurred_on: parsed.data.occurred_on,
      notes: parsed.data.notes,
      paid_by_member_id: parsed.data.paid_by_member_id ?? null,
      for_member_id: parsed.data.for_member_id ?? null,
      essential_pct: parsed.data.essential_pct ?? 100,
      split_rule: parsed.data.split_rule ?? null,
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  redirect("/dashboard");
}

export async function logSubscriptionIncomeAction(
  subscriptionId: string,
  _prev: LogIncomeState,
  formData: FormData,
): Promise<LogIncomeState> {
  const raw = Object.fromEntries(formData);
  const parsed = logIncomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_subscription_income", {
    p: {
      subscription_id: subscriptionId,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      occurred_on: parsed.data.occurred_on,
      notes: parsed.data.notes,
      paid_by_member_id: parsed.data.paid_by_member_id,
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  redirect("/dashboard");
}
```

(This removes `registerSubscriptionAction`.)

- [ ] **Step 5.2: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 5.3: Stage and pause**

```bash
git add 'app/(app)/subscriptions/actions.ts'
```

---

## Task 6: Subscriptions page — remove panel, add type pills

**Files:**
- Modify: `app/(app)/subscriptions/page.tsx`
- Modify: `app/(app)/subscriptions/SubscriptionsClient.tsx`

- [ ] **Step 6.1: Update `page.tsx`**

Full new content:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  SubscriptionsClient,
  type SubscriptionRow,
  type DueRow,
  type UpcomingRow,
  type Overlap,
} from "./SubscriptionsClient";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";

export const metadata = { title: "Subscriptions · Budget" };
export const dynamic = "force-dynamic";

type RawSub = {
  id: string;
  type: string;
  merchant: string;
  amount_cents: number | string;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_id: string;
  income_source: string | null;
};

type RawDetailRow = {
  id: string;
  type: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  category_name: string;
  cadence: string;
  interval_days: number | null;
  next_renewal_at: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
  income_source: string | null;
};

type RawOverlap = {
  category_name: string;
  count: number | string;
  monthly_total_cents: number | string;
};

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

function asType(t: string): "expense" | "income" {
  return t === "income" ? "income" : "expense";
}

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: subsData },
    { data: dueData },
    { data: upcomingData },
    { data: overlapData },
  ] = await Promise.all([
    supabase.rpc("list_subscriptions"),
    supabase.rpc("list_due_subscriptions"),
    supabase.rpc("list_upcoming_subscriptions"),
    supabase.rpc("list_overlapping_subscriptions"),
  ]);

  // list_subscriptions doesn't return category_name; map ids from due/upcoming
  // and let the "others" rows show the cadence label as a fallback.
  const detailById = new Map<string, RawDetailRow>();
  for (const r of ((dueData ?? []) as RawDetailRow[])) detailById.set(r.id, r);
  for (const r of ((upcomingData ?? []) as RawDetailRow[])) detailById.set(r.id, r);

  const dueIds = new Set<string>(((dueData ?? []) as RawDetailRow[]).map((r) => r.id));
  const upcomingIds = new Set<string>(((upcomingData ?? []) as RawDetailRow[]).map((r) => r.id));

  const allRows = ((subsData ?? []) as RawSub[])
    .slice()
    .sort((a, b) => a.next_renewal_at.localeCompare(b.next_renewal_at))
    .map<SubscriptionRow>((s) => ({
      id: s.id,
      type: asType(s.type),
      merchant: s.merchant,
      amount_cents: toBig(s.amount_cents),
      cadence: s.cadence,
      next_renewal_at: s.next_renewal_at,
      active: s.active,
      category_name: detailById.get(s.id)?.category_name ?? "—",
      income_source: s.income_source,
    }));

  const others = allRows.filter((r) => !dueIds.has(r.id) && !upcomingIds.has(r.id));

  const dueRows: DueRow[] = ((dueData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    type: asType(r.type),
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));

  const upcomingRows: UpcomingRow[] = ((upcomingData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    type: asType(r.type),
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));

  const overlaps: Overlap[] = ((overlapData ?? []) as RawOverlap[]).map((o) => ({
    category_name: o.category_name,
    count: typeof o.count === "string" ? Number(o.count) : o.count,
    monthly_total_cents: toBig(o.monthly_total_cents),
  }));

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Subscriptions" subtitle="Recurring expenses and income" />
      <SubscriptionsClient
        due={dueRows}
        upcoming={upcomingRows}
        others={others}
        overlaps={overlaps}
      />
    </div>
  );
}
```

- [ ] **Step 6.2: Update `SubscriptionsClient.tsx`**

Full new content:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import {
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipSubscriptionOccurrenceAction,
} from "./actions";

export type SubscriptionRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_name: string;
  income_source: string | null;
};

export type DueRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
  income_source: string | null;
};

export type UpcomingRow = DueRow;

export type Overlap = {
  category_name: string;
  count: number;
  monthly_total_cents: bigint;
};

type Props = {
  due: DueRow[];
  upcoming: UpcomingRow[];
  others: SubscriptionRow[];
  overlaps: Overlap[];
};

function cadenceLabel(c: string): string {
  return c === "custom_days" ? "custom" : c;
}

function TypePill({ type }: { type: "expense" | "income" }) {
  const cls =
    type === "income"
      ? "bg-sage/15 text-sage"
      : "bg-brick/15 text-brick";
  const label = type === "income" ? "In" : "Out";
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md ${cls}`}>
      {label}
    </span>
  );
}

function rowMeta(r: { type: string; category_name: string; income_source: string | null; cadence: string }) {
  const label = r.type === "income" ? (r.income_source ?? "—") : r.category_name;
  return `${label} · ${cadenceLabel(r.cadence)}`;
}

export function SubscriptionsClient({ due, upcoming, others, overlaps }: Props) {
  const [pending, startTransition] = useTransition();

  const togglePause = (s: SubscriptionRow) => {
    startTransition(async () => {
      if (s.active) await pauseSubscriptionAction(s.id);
      else await resumeSubscriptionAction(s.id);
    });
  };

  const skipDue = (id: string) => {
    startTransition(async () => {
      await skipSubscriptionOccurrenceAction(id);
    });
  };

  return (
    <div className="px-4 space-y-3">
      {overlaps.length > 0 && (
        <div className="rounded-2xl bg-sand-soft p-3 shadow-sm">
          <div className="text-xs text-ink font-medium mb-1">Possible savings</div>
          <ul className="text-xs text-ink-2 space-y-1">
            {overlaps.map((o) => (
              <li key={o.category_name}>
                {o.count} overlapping {o.category_name} subs · review to save{" "}
                {formatCAD(o.monthly_total_cents).replace("CA$", "$")}/mo
              </li>
            ))}
          </ul>
        </div>
      )}

      {due.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-brick">
            Due now
          </h2>
          <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40 ring-1 ring-brick/20">
            {due.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · was {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
                <Link
                  href={`/subscriptions/${s.id}/add`}
                  className="inline-flex items-center px-3 h-9 rounded-2xl bg-sage text-white text-xs"
                >
                  Add
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => skipDue(s.id)}
                  disabled={pending}
                >
                  Skip
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Upcoming
          </h2>
          <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40">
            {upcoming.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · renews {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1">
        {(due.length > 0 || upcoming.length > 0) && (
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            All others
          </h2>
        )}
        <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40">
          {others.length === 0 ? (
            <p className="p-4 text-sm text-muted text-center">
              {due.length === 0 && upcoming.length === 0
                ? "No subscriptions yet. Create one from Add Expense or Add Income with the Recurring checkbox."
                : "Nothing else."}
            </p>
          ) : (
            others.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · next {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePause(s)}
                  disabled={pending}
                >
                  {s.active ? "Pause" : "Resume"}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6.3: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 6.4: Smoke test**

Visit `/subscriptions`. Verify:
- No "Add subscription" button or inline create form anywhere on the page.
- Existing expense subs render with a brick "Out" pill.
- After creating an income sub via `/add-income`, it appears with a sage "In" pill.
- Pause / Resume / Skip still work.
- "Possible savings" card still renders.

- [ ] **Step 6.5: Stage and pause**

```bash
git add 'app/(app)/subscriptions/page.tsx' 'app/(app)/subscriptions/SubscriptionsClient.tsx'
```

---

## Task 7: `/subscriptions/[id]/add` — type branching

**Files:**
- Modify: `app/(app)/subscriptions/[id]/add/page.tsx`

- [ ] **Step 7.1: Replace `page.tsx`**

Full new content:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption as ExpenseMemberOption,
  type ExpensePrefill,
} from "../../add/AddExpenseForm";
import {
  AddIncomeForm,
  type AdultOption,
  type IncomePrefill,
} from "../../add-income/AddIncomeForm";
import { logSubscriptionExpenseAction, logSubscriptionIncomeAction } from "../actions";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";
import type { CategoryRow, MemberRow, MerchantRow } from "@/lib/supabase/rpc-rows";

export const metadata = { title: "Log subscription · Budget" };
export const dynamic = "force-dynamic";

type PrefillRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  category_name: string;
  cadence: string;
  interval_days: number | null;
  next_renewal_at: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
  income_source: string | null;
};

type IncomeCategoryRow = { id: string };

export default async function SubscriptionAddPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: prefillRows, error: prefillErr } = await supabase.rpc(
    "get_subscription_prefill",
    { p_id: id },
  );
  const rows = (prefillRows ?? []) as PrefillRow[];
  if (prefillErr || rows.length === 0) {
    redirect("/subscriptions");
  }
  const row = rows[0];

  const [
    { data: membersData },
    { data: categoriesData },
    { data: merchantsData },
    { data: incomeCategoryRows },
  ] = await Promise.all([
    supabase.rpc("list_household_members"),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_merchants"),
    supabase.rpc("list_categories", { p_kind: "income" }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  if (row.type === "income") {
    const adults: AdultOption[] = ((membersData ?? []) as MemberRow[])
      .filter((m) => m.role === "adult")
      .map((m) => ({ id: m.id, display_name: m.display_name }));

    const incomeCategoryId =
      ((incomeCategoryRows ?? []) as IncomeCategoryRow[])[0]?.id ?? null;

    const prefill: IncomePrefill = {
      amount_cents: BigInt(
        typeof row.amount_cents === "string"
          ? row.amount_cents
          : Math.trunc(row.amount_cents),
      ),
      notes: row.merchant,
      paid_by_member_id: row.paid_by_member_id ?? "",
      income_source: row.income_source ?? "Salary",
    };

    const bound = logSubscriptionIncomeAction.bind(null, id);

    return (
      <div className="pt-3">
        <AppBar left={<MenuButton />} />
        <PageTitle
          title={`Log ${row.merchant}`}
          subtitle={`Renewal was ${row.next_renewal_at}`}
        />
        <AddIncomeForm
          incomeCategoryId={incomeCategoryId}
          adults={adults}
          todayIso={today}
          prefill={prefill}
          submitAction={bound}
          submitLabel="Save & advance"
          cancelHref="/subscriptions"
        />
      </div>
    );
  }

  // Expense path (default).
  const categories: CategoryOption[] = ((categoriesData ?? []) as CategoryRow[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));
  const members: ExpenseMemberOption[] = ((membersData ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
  }));
  const merchants: string[] = ((merchantsData ?? []) as MerchantRow[])
    .map((m) => m.name)
    .filter(Boolean);

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
    for_member_id: row.for_member_id,
    essential_pct: row.essential_pct,
    split_rule: row.split_rule,
  };
  const bound = logSubscriptionExpenseAction.bind(null, id);

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle
        title={`Log ${row.merchant}`}
        subtitle={`Renewal was ${row.next_renewal_at}`}
      />
      <AddExpenseForm
        categories={categories}
        members={members}
        merchants={merchants}
        todayIso={today}
        prefill={prefill}
        template={null}
        submitAction={bound}
        submitLabel="Save & advance"
        cancelHref="/subscriptions"
      />
    </div>
  );
}
```

- [ ] **Step 7.2: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 7.3: Stage and pause**

```bash
git add 'app/(app)/subscriptions/[id]/add/page.tsx'
```

---

## Task 8: Dashboard `DueSubscriptionsCard` — type pill

**Files:**
- Modify: `app/(app)/dashboard/DueSubscriptionsCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 8.1: Update `DueSubscriptionsCard.tsx`**

Full new content:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import { skipSubscriptionOccurrenceAction } from "../subscriptions/actions";

export type DueRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
  income_source: string | null;
};

function TypePill({ type }: { type: "expense" | "income" }) {
  const cls =
    type === "income"
      ? "bg-sage/15 text-sage"
      : "bg-brick/15 text-brick";
  const label = type === "income" ? "In" : "Out";
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-md ${cls}`}>
      {label}
    </span>
  );
}

export function DueSubscriptionsCard({ rows }: { rows: DueRow[] }) {
  const [pending, startTransition] = useTransition();

  const skip = (id: string) => {
    startTransition(async () => {
      await skipSubscriptionOccurrenceAction(id);
    });
  };

  return (
    <div className="mx-4 mb-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-brick/20">
      <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-brick mb-2">
        Due subscriptions · {rows.length}
      </div>
      <ul className="divide-y divide-line/40">
        {rows.map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3">
            <TypePill type={r.type} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate">{r.merchant}</div>
              <div className="text-[11px] text-faint">
                {r.type === "income" ? (r.income_source ?? "—") : r.category_name} · was {r.next_renewal_at}
              </div>
            </div>
            <div className="font-mono text-sm text-ink">
              {formatCAD(r.amount_cents).replace("CA$", "$")}
            </div>
            <Link
              href={`/subscriptions/${r.id}/add`}
              className="inline-flex items-center px-3 h-9 rounded-2xl bg-sage text-white text-xs"
            >
              Add
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => skip(r.id)}
              disabled={pending}
            >
              {pending ? "…" : "Skip"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8.2: Update `dashboard/page.tsx`**

Open `app/(app)/dashboard/page.tsx`. Update `RawDueRow` to add `type` and `income_source`, and add them to the `dueRows` mapping.

Find the existing `RawDueRow` type and the `dueRows: DueRow[] = ...` projection. Replace them with:

```ts
  type RawDueRow = {
    id: string;
    type: "expense" | "income";
    merchant: string;
    amount_cents: number | string;
    category_name: string;
    cadence: string;
    next_renewal_at: string;
    income_source: string | null;
  };
  const dueRows: DueRow[] = ((dueSubsData ?? []) as RawDueRow[]).map((r) => ({
    id: r.id,
    type: r.type,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));
```

- [ ] **Step 8.3: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 8.4: Smoke test**

Visit `/dashboard`. Seed a due expense AND a due income subscription (use `/add` and `/add-income` with Recurring + start_date in the past). Verify both appear in the Due card with the appropriate pill, and tapping "Add" routes to a prefilled form of the correct type.

- [ ] **Step 8.5: Stage and pause**

```bash
git add 'app/(app)/dashboard/DueSubscriptionsCard.tsx' 'app/(app)/dashboard/page.tsx'
```

---

## Task 9: Update existing E2E tests

The old tests assume an inline "Add subscription" panel that no longer exists.

**Files:**
- Modify: `tests/e2e/subscription-add-from-due.spec.ts`
- Modify: `tests/e2e/subscription-skip.spec.ts`
- Modify: `tests/e2e/subscription-custom-days.spec.ts`
- Modify: `tests/e2e/subscription-auto-log.spec.ts`

- [ ] **Step 9.1: Helper for creating a recurring expense**

Each of these tests previously used the subscriptions-page inline form. They must now drive `/add` with Recurring checked. To avoid copy-paste, define a small helper inside each test file (no shared fixture — keeps each spec self-contained, matching codebase convention).

For each modified test, add this helper near the top of the file:

```ts
async function createRecurringExpense(
  page: Page,
  opts: { merchant: string; amount: string; cadence?: string; startDateIso?: string; intervalDays?: string },
) {
  await page.goto("/add");
  await page.locator('input[name="amount_cents_dollars"]').fill(opts.amount);
  // Pick the first existing category from the combobox.
  const catInput = page.locator('input[placeholder*="category"]').or(
    page.getByRole("combobox").first(),
  );
  await catInput.click();
  const firstCategory = page.getByRole("option").first();
  await firstCategory.click();
  // Merchant (notes).
  await page.locator('input[name="notes"]').fill(opts.merchant);

  // Toggle Recurring.
  await page.getByLabel("Recurring").check();
  if (opts.cadence) {
    await page.locator('select[name="cadence"]').selectOption(opts.cadence);
  }
  if (opts.cadence === "custom_days" && opts.intervalDays) {
    await page.locator('input[name="interval_days"]').fill(opts.intervalDays);
  }
  if (opts.startDateIso) {
    await page.locator('input[name="start_date"]').fill(opts.startDateIso);
  }

  await page.getByRole("button", { name: /save expense/i }).click();
  await page.waitForURL(/\/dashboard/);
}
```

- [ ] **Step 9.2: Rewrite `subscription-add-from-due.spec.ts`**

Replace the body of the existing test that previously created subs via the inline form. Use the helper to create an expense sub with `startDateIso` set to a date 31 days ago — so `next_renewal_at = start_date + 1 month` falls on or before today and the sub is due. Then assert the Due card row, click Add, save, etc. (the rest of the existing test logic stays).

Construct the past date with:

```ts
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
```

In the test body:

```ts
const merchant = `DueSub-${Date.now()}`;
await createRecurringExpense(page, {
  merchant,
  amount: "12.34",
  cadence: "monthly",
  startDateIso: isoDaysAgo(31),
});

await page.goto("/dashboard");
// ...rest unchanged.
```

- [ ] **Step 9.3: Rewrite `subscription-skip.spec.ts`**

Same helper-based setup. Use `cadence: "monthly", startDateIso: isoDaysAgo(31)`. Then go to dashboard and tap Skip. Assertions remain unchanged.

- [ ] **Step 9.4: Rewrite `subscription-custom-days.spec.ts`**

Use the helper with `cadence: "custom_days", intervalDays: "14"`. After save, navigate to `/subscriptions` and assert the new sub appears in All others (since next_renewal_at = today + 14 days). Verify the create flow no longer exists on `/subscriptions` (no "Add subscription" button visible).

```ts
test("No \"Add subscription\" button on /subscriptions", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");
  await expect(page.getByRole("button", { name: /add subscription/i })).toHaveCount(0);
});
```

- [ ] **Step 9.5: Rewrite `subscription-auto-log.spec.ts`**

The original test exercised the inline form. Replace the body to:

```ts
test("Register a Netflix subscription via Add Expense + Recurring", async ({ page }) => {
  await signIn(page);
  const merchant = `Netflix-${Date.now()}`;
  await createRecurringExpense(page, {
    merchant,
    amount: "19.99",
    cadence: "monthly",
  });
  await page.goto("/subscriptions");
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });
  // The first sub in "All others" has a Pause button.
  const pause = page.getByRole("button", { name: /pause/i }).first();
  await expect(pause).toBeVisible();
  await pause.click();
  await expect(page.getByRole("button", { name: /resume/i }).first()).toBeVisible();
});
```

- [ ] **Step 9.6: Run the updated tests**

```bash
bun run test:e2e -- subscription-add-from-due.spec.ts subscription-skip.spec.ts subscription-custom-days.spec.ts subscription-auto-log.spec.ts
```
Expected: PASS.

- [ ] **Step 9.7: Stage and pause**

```bash
git add tests/e2e/subscription-add-from-due.spec.ts tests/e2e/subscription-skip.spec.ts tests/e2e/subscription-custom-days.spec.ts tests/e2e/subscription-auto-log.spec.ts
```

---

## Task 10: New E2E tests

**Files:**
- Create: `tests/e2e/recurring-expense.spec.ts`
- Create: `tests/e2e/recurring-income.spec.ts`
- Create: `tests/e2e/subscription-add-from-due-income.spec.ts`

- [ ] **Step 10.1: `recurring-expense.spec.ts`**

```ts
// 2026-06-06: Recurring checkbox flow on /add.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Add Expense with Recurring creates a subscription AND the first transaction", async ({ page }) => {
  await signIn(page);
  await page.goto("/add");

  const merchant = `RecurExp-${Date.now()}`;
  await page.locator('input[name="amount_cents_dollars"]').fill("5.55");

  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();

  await page.locator('input[name="notes"]').fill(merchant);

  await page.getByLabel("Recurring").check();
  await expect(page.locator('select[name="cadence"]')).toBeVisible();
  await page.locator('select[name="cadence"]').selectOption("monthly");
  await expect(page.locator('input[name="start_date"]')).toBeVisible();

  await page.getByRole("button", { name: /save expense/i }).click();
  await page.waitForURL(/\/dashboard/);

  // Expense visible.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // Subscription visible on /subscriptions (under All others — next renewal is 1 month out).
  await page.goto("/subscriptions");
  await expect(page.getByText(merchant)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText("Out").first()).toBeVisible();
});
```

- [ ] **Step 10.2: `recurring-income.spec.ts`**

```ts
// 2026-06-06: Recurring checkbox flow on /add-income.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Add Income with Recurring creates an income subscription", async ({ page }) => {
  await signIn(page);
  await page.goto("/add-income");

  const note = `RecurInc-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill("1500.00");
  // Earner is the first adult by default — leave as-is.
  await page.locator('select[name="income_source"]').selectOption("Salary");
  await page.locator('input[name="notes"]').fill(note);

  await page.getByLabel("Recurring").check();
  await page.locator('select[name="cadence"]').selectOption("monthly");

  await page.getByRole("button", { name: /save income/i }).click();
  await page.waitForURL(/\/dashboard/);

  await expect(page.getByText(note).first()).toBeVisible({ timeout: 5_000 });

  await page.goto("/subscriptions");
  await expect(page.getByText(note)).toBeVisible({ timeout: 5_000 });
  // Income pill present.
  await expect(page.getByText("In").first()).toBeVisible();
});
```

- [ ] **Step 10.3: `subscription-add-from-due-income.spec.ts`**

```ts
// 2026-06-06: Add-from-due flow for an INCOME subscription.

import { test, expect, type Page } from "@playwright/test";

const ALEX_EMAIL = process.env.E2E_ALEX_EMAIL ?? "alex@example.com";
const ALEX_PASSWORD = process.env.E2E_ALEX_PASSWORD ?? "TestPass1!";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("you@example.com").fill(ALEX_EMAIL);
  await page.locator('input[name="password"]').fill(ALEX_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(dashboard|onboarding\/create-household)/);
}

test("Add from a due INCOME subscription routes to AddIncomeForm and saves", async ({ page }) => {
  await signIn(page);
  await page.goto("/add-income");

  const note = `DueIncome-${Date.now()}`;
  await page.locator('input[type="number"]').first().fill("99.00");
  await page.locator('select[name="income_source"]').selectOption("Refund");
  await page.locator('input[name="notes"]').fill(note);
  await page.getByLabel("Recurring").check();
  await page.locator('select[name="cadence"]').selectOption("monthly");
  await page.locator('input[name="start_date"]').fill(isoDaysAgo(31));
  await page.getByRole("button", { name: /save income/i }).click();
  await page.waitForURL(/\/dashboard/);

  // The new sub is due (start was 31 days ago + 1 month ≤ today).
  const dueCard = page.locator("text=Due subscriptions").locator("..");
  await expect(dueCard.getByText(note)).toBeVisible({ timeout: 5_000 });

  await dueCard.getByRole("link", { name: /^Add$/ }).first().click();
  await page.waitForURL(/\/subscriptions\/.+\/add/);

  // The form is the income form: it has the Source select.
  await expect(page.locator('select[name="income_source"]')).toBeVisible();

  await page.getByRole("button", { name: /save & advance/i }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByText(note).first()).toBeVisible({ timeout: 5_000 });
});
```

- [ ] **Step 10.4: Run the new tests**

```bash
bun run test:e2e -- recurring-expense.spec.ts recurring-income.spec.ts subscription-add-from-due-income.spec.ts
```
Expected: PASS.

- [ ] **Step 10.5: Stage and pause**

```bash
git add tests/e2e/recurring-expense.spec.ts tests/e2e/recurring-income.spec.ts tests/e2e/subscription-add-from-due-income.spec.ts
```

---

## Task 11: Final verification

- [ ] **Step 11.1: Full typecheck + unit**

```bash
bun run typecheck
bun run test:unit
```

- [ ] **Step 11.2: Full E2E**

```bash
bun run test:e2e
```

If any unrelated existing test fails, report it. Do not "fix" by lowering coverage — investigate.

- [ ] **Step 11.3: Surface diff and stop**

```bash
git status
git diff --stat main
```

Report to the user. Do not commit. Wait for explicit prompt.

---

## Self-review

- **Spec coverage:** Schema (T1) ✓, three new RPCs (T1) ✓, three updated RPCs (T1) ✓, `recurringSchema` (T2) ✓, `RecurringFields` (T2) ✓, expense action+form (T3) ✓, income action+form refactor (T4) ✓, subscriptions actions cleanup (T5) ✓, subscriptions page panel removal + type pills (T6) ✓, `[id]/add` branching (T7) ✓, dashboard card (T8) ✓, E2E updates + adds (T9–T10) ✓, final verification (T11) ✓.
- **Placeholder scan:** No TBD / TODO / vague "add validation" left. Code blocks are concrete in every step.
- **Type consistency:** `DueRow` shape (id, type, merchant, amount_cents bigint, cadence, next_renewal_at, category_name, income_source) is identical in `SubscriptionsClient.tsx`, `DueSubscriptionsCard.tsx`, and the dashboard page projection. `ExpensePrefill` reused; `IncomePrefill` introduced and used by both `AddIncomeForm` and `[id]/add`. `RecurringFields` posts under names `recurring`, `cadence`, `interval_days`, `start_date` — every server action reads those same names.
