# Subscription Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop auto-materializing subscriptions; surface due subscriptions on the home page + subscriptions page so the user manually logs each occurrence through a prefilled expense form, with "Skip" as a no-transaction advance. Add a `custom_days` cadence and swap the subscription create form's merchant input to the existing combobox.

**Architecture:** One forward DB migration adds schema bits, unschedules the cron, and ships five new RPCs (list_due / list_upcoming / get_prefill / skip / log_expense). The existing `AddExpenseForm` is refactored to accept a prefill (without template UI) and a swappable submit action, then reused at a new `/subscriptions/[id]/add` route. A new `DueSubscriptionsCard` renders the top of the dashboard. The `SubscriptionsClient` gets three sections (Due / Upcoming / All others) and a `custom_days` cadence option.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Supabase Postgres (security-definer RPCs), Tailwind v4, Vitest (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-06-subscription-rework-design.md`

**Constraints from CLAUDE.md / memory:**
- Never edit applied migration files — only add new forward migrations.
- Never run `supabase` commands; the user applies migrations.
- Clients call RPCs, not `.from()` against household tables.
- Always use types; never ignore them.
- Don't write excessive comments; explain WHY, not WHAT.
- Never commit without explicit user prompt.

---

## File map

### Created
- `supabase/migrations/20260606000001_subscription_manual_logging.sql` — schema + cron unschedule + 5 RPCs + `register_subscription` update
- `app/(app)/subscriptions/[id]/add/page.tsx` — prefilled expense route
- `app/(app)/dashboard/DueSubscriptionsCard.tsx` — top-of-home due card
- `tests/e2e/subscription-add-from-due.spec.ts`
- `tests/e2e/subscription-skip.spec.ts`
- `tests/e2e/subscription-custom-days.spec.ts`

### Modified
- `app/(app)/add/AddExpenseForm.tsx` — split `template` into `prefill` + `template`; add `submitAction`, `submitLabel`, `cancelHref`
- `app/(app)/add/page.tsx` — pass `prefill` and `template` separately
- `app/(app)/subscriptions/actions.ts` — `registerSubscriptionAction` accepts `interval_days`; add `skipSubscriptionOccurrenceAction`, `logSubscriptionExpenseAction`
- `app/(app)/subscriptions/page.tsx` — fetch due / upcoming / all-others / merchants in parallel
- `app/(app)/subscriptions/SubscriptionsClient.tsx` — three sections, MerchantCombobox, `custom_days` option + interval-days input
- `app/(app)/dashboard/page.tsx` — fetch `list_due_subscriptions`; render `DueSubscriptionsCard` above hero

### Untouched but worth knowing about
- `app/(app)/_actions/` (no subscription-related actions live here)
- `components/transactions/MerchantCombobox.tsx` already exposes `defaultValue`, supports `name` override — no change needed.
- `components/transactions/CategoryCombobox.tsx` already exposes `defaultValue` — no change needed.

---

## Task 1: Migration — schema, cron unschedule, `register_subscription` update

**Files:**
- Create: `supabase/migrations/20260606000001_subscription_manual_logging.sql`

This is one migration file; we build it up step by step.

- [ ] **Step 1.1: Create file with schema additions**

Create `supabase/migrations/20260606000001_subscription_manual_logging.sql`:

```sql
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
  DROP CONSTRAINT subscription_cadence_check;

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

-- Stop auto-materializing. Materialize RPC is left in place but unused.
SELECT cron.unschedule('subscriptions-hourly');

COMMENT ON FUNCTION public.materialize_due_subscriptions(BOOLEAN) IS
  'Deprecated 2026-06-06: subscriptions are no longer auto-materialized. '
  'Kept for historical traceability of subscription_id/occurrence_date on '
  'past transactions; do not call from new code.';
```

- [ ] **Step 1.2: Add updated `register_subscription`**

Append to the same file:

```sql
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
```

- [ ] **Step 1.3: Stop here, do not commit yet**

The remaining RPCs go in this same file in subsequent tasks. We're keeping all related migration content in one file to avoid timestamp collisions and partial-state confusion.

---

## Task 2: Migration — `list_due_subscriptions` + `list_upcoming_subscriptions`

**Files:**
- Modify: `supabase/migrations/20260606000001_subscription_manual_logging.sql` (append)

- [ ] **Step 2.1: Append `list_due_subscriptions`**

Append:

```sql
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
```

- [ ] **Step 2.2: Append `list_upcoming_subscriptions`**

Append:

```sql
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
```

---

## Task 3: Migration — `get_subscription_prefill`

**Files:**
- Modify: `supabase/migrations/20260606000001_subscription_manual_logging.sql` (append)

- [ ] **Step 3.1: Append `get_subscription_prefill`**

Append:

```sql
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
```

---

## Task 4: Migration — `skip_subscription_occurrence`

**Files:**
- Modify: `supabase/migrations/20260606000001_subscription_manual_logging.sql` (append)

- [ ] **Step 4.1: Append `skip_subscription_occurrence`**

Append:

```sql
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
  END;

  UPDATE public.subscription SET next_renewal_at = v_next WHERE id = p_id;
END;
$$;

ALTER FUNCTION public.skip_subscription_occurrence(UUID) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.skip_subscription_occurrence(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skip_subscription_occurrence(UUID) TO authenticated;
```

---

## Task 5: Migration — `log_subscription_expense`

**Files:**
- Modify: `supabase/migrations/20260606000001_subscription_manual_logging.sql` (append)

- [ ] **Step 5.1: Append `log_subscription_expense`**

Append:

```sql
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
  END;

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
  RETURNING id INTO v_tx_id;

  UPDATE public.subscription SET next_renewal_at = v_next WHERE id = v_sub_id;

  RETURN v_tx_id;
END;
$$;

ALTER FUNCTION public.log_subscription_expense(JSONB) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.log_subscription_expense(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_subscription_expense(JSONB) TO authenticated;
```

- [ ] **Step 5.2: Ask the user to apply the migration**

Per CLAUDE.md, the agent does not run Supabase commands. Stop and ask:

> "Migration `20260606000001_subscription_manual_logging.sql` is ready. Please run `npx supabase db reset` (or your usual apply command) before I continue. If the timestamp collides with another branch's migration on the cloud push, rename this file to a later timestamp per `feedback_cross_branch_migrations`."

Wait for confirmation.

- [ ] **Step 5.3: Typecheck and verify migration file**

After user confirms migration applied, run:

```bash
bun run typecheck
```

Expected: PASS (no code consumes the new RPCs yet, but the SQL file itself doesn't affect TS types).

- [ ] **Step 5.4: Commit**

```bash
git add supabase/migrations/20260606000001_subscription_manual_logging.sql
# Wait for explicit user prompt before committing. Surface the staged diff and pause.
```

Do not run `git commit` until the user explicitly says to commit. (CLAUDE.md: never commit unless prompted.)

---

## Task 6: Refactor `AddExpenseForm` — split `template` prop, add submission-override props

**Files:**
- Modify: `app/(app)/add/AddExpenseForm.tsx`
- Modify: `app/(app)/add/page.tsx`

The goal: same form usable from both `/add` (template flow) and `/subscriptions/[id]/add` (subscription flow), without leaking subscription concerns into `/add/actions.ts`.

- [ ] **Step 6.1: Update `AddExpenseForm` types and prop signature**

Replace the existing `Props` and `ExpenseTemplate` types and the function signature. Full new file content for `app/(app)/add/AddExpenseForm.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { CategoryCombobox } from "@/components/transactions/CategoryCombobox";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { ForWhomChips } from "@/components/transactions/ForWhomChips";
import { SplitSlider } from "@/components/transactions/SplitSlider";
import { SplitRuleChips, type SplitRule } from "@/components/transactions/SplitRuleChips";
import { logExpenseAction, createExpenseCategoryAction, type LogExpenseState } from "./actions";

const INITIAL: LogExpenseState = { error: null };

export type CategoryOption = { id: string; name: string };
export type MemberOption = { id: string; display_name: string; role: "adult" | "kid" };

/** Field values used to prefill the form. Shared between the saved-template
 *  flow and the subscription "Add" flow — both supply the same shape. */
export type ExpensePrefill = {
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  category_name: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
};

/** When set, the form renders the "Override saved values" template-specific
 *  controls and a hidden template_id input. Subscription mode passes null. */
export type ExpenseTemplateRef = {
  id: string;
  merchant: string;
};

export type SubmitAction = (
  prev: LogExpenseState,
  formData: FormData,
) => Promise<LogExpenseState>;

type Props = {
  categories: CategoryOption[];
  members: MemberOption[];
  merchants: string[];
  todayIso: string;
  prefill: ExpensePrefill | null;
  template: ExpenseTemplateRef | null;
  /** Defaults to logExpenseAction. */
  submitAction?: SubmitAction;
  /** Defaults to "Save expense". */
  submitLabel?: string;
  /** When set, renders a Cancel link to this href next to submit. */
  cancelHref?: string;
};

function centsToDollars(cents: bigint): string {
  const n = Number(cents) / 100;
  return n.toFixed(2);
}

export function AddExpenseForm({
  categories,
  members,
  merchants,
  todayIso,
  prefill,
  template,
  submitAction,
  submitLabel,
  cancelHref,
}: Props) {
  const action = submitAction ?? logExpenseAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [amount, setAmount] = useState(
    prefill ? centsToDollars(prefill.amount_cents) : "0.00",
  );
  const [forMember, setForMember] = useState<string | null>(
    prefill?.for_member_id ?? null,
  );
  const [essentialPct, setEssentialPct] = useState<number>(
    prefill?.essential_pct ?? 100,
  );
  const [splitRule, setSplitRule] = useState<SplitRule | null>(
    prefill?.split_rule ?? null,
  );
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [overrideTemplate, setOverrideTemplate] = useState(false);

  // Template UI only renders in the default submit-action path; if the caller
  // overrode submitAction (subscription flow) we hide it because save-as-template
  // and override-template wouldn't fire anyway.
  const showTemplateUI = submitAction === undefined;

  const adults = members.filter((m) => m.role === "adult");
  const adultA = adults[0]?.display_name ?? "Adult A";
  const adultB = adults[1]?.display_name ?? "Adult B";

  const cents = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 100));
  })();

  return (
    <form action={formAction} className="px-4 pb-32 flex flex-col gap-4" noValidate>
      <AmountHero cents={cents} label="Amount" />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">$ Amount</span>
        <Input
          type="number"
          name="amount_cents_dollars"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <input type="hidden" name="amount_cents" value={cents.toString()} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
        <Input type="date" name="occurred_on" defaultValue={todayIso} required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Category</span>
        <CategoryCombobox
          categories={categories}
          required
          defaultValue={prefill?.category_name ?? ""}
          onCreate={createExpenseCategoryAction}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Merchant / notes</span>
        <MerchantCombobox merchants={merchants} defaultValue={prefill?.merchant ?? ""} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">For whom</span>
        <ForWhomChips
          members={members}
          value={forMember}
          onChange={setForMember}
          asFormField
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Essential split</span>
        <SplitSlider
          value={essentialPct}
          onChange={setEssentialPct}
          asFormField
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">
          Paid by · split
        </span>
        <SplitRuleChips
          value={splitRule}
          onChange={setSplitRule}
          adultALabel={`${adultA} 100%`}
          adultBLabel={`${adultB} 100%`}
          asFormField
        />
        <input
          type="hidden"
          name="paid_by_member_id"
          value={
            splitRule === "adult_a"
              ? adults[0]?.id ?? ""
              : splitRule === "adult_b"
                ? adults[1]?.id ?? ""
                : ""
          }
        />
      </div>

      {showTemplateUI && template ? (
        <>
          <input type="hidden" name="template_id" value={template.id} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="override_template"
              checked={overrideTemplate}
              onChange={(e) => setOverrideTemplate(e.target.checked)}
              className="h-4 w-4"
            />
            Override saved values for &ldquo;{template.merchant}&rdquo;
          </label>
        </>
      ) : showTemplateUI ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="save_as_template"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="h-4 w-4"
          />
          Save as template
        </label>
      ) : null}

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-3 mt-2 -mx-4 px-4 pt-2 pb-3 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 z-10 flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : (submitLabel ?? "Save expense")}
        </Button>
        {cancelHref && (
          <Link
            href={cancelHref}
            className="inline-flex items-center justify-center px-4 h-12 rounded-2xl bg-surface text-ink text-sm shadow-sm"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
```

Key changes vs current file:
- Replaces single `template` prop with two: `prefill` (data) + `template` (template-flow UI ref).
- Adds `submitAction`, `submitLabel`, `cancelHref` props.
- `showTemplateUI` is `true` only when no `submitAction` override (i.e. default `/add` flow).
- Submit row becomes a flex row to make space for the Cancel link.
- New `Link` import from `next/link`.

- [ ] **Step 6.2: Update `/add/page.tsx` to pass `prefill` + `template` separately**

Modify `app/(app)/add/page.tsx`. Replace the import line and the `<AddExpenseForm ... template={template} />` line.

Change import (line ~5-10):
```tsx
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption,
  type ExpensePrefill,
  type ExpenseTemplateRef,
} from "./AddExpenseForm";
```

Replace the existing `let template: ExpenseTemplate | null = null;` block and the JSX. Use this exact replacement for lines from `let template:` through the closing `</div>`:

```tsx
  let prefill: ExpensePrefill | null = null;
  let template: ExpenseTemplateRef | null = null;
  if (templateId) {
    const { data: tplRows } = await supabase.rpc("get_saved_expense", {
      p_id: templateId,
    });
    const tplData = ((tplRows ?? []) as RawTemplate[])[0] ?? null;
    if (tplData) {
      // Bump MRU so the tile sorts to the top next time Quick Add loads.
      await supabase.rpc("touch_saved_expense", { p_id: templateId });
      const categoryName =
        categories.find((c) => c.id === tplData.category_id)?.name ?? "";
      prefill = {
        merchant: tplData.merchant,
        amount_cents: BigInt(
          typeof tplData.amount_cents === "string"
            ? tplData.amount_cents
            : Math.trunc(tplData.amount_cents),
        ),
        category_id: tplData.category_id,
        category_name: categoryName,
        paid_by_member_id: tplData.paid_by_member_id,
        for_member_id: tplData.for_member_id,
        essential_pct: tplData.essential_pct,
        split_rule: tplData.split_rule,
      };
      template = { id: tplData.id, merchant: tplData.merchant };
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle
        title={template ? `Add expense (from ${template.merchant})` : "Add expense"}
        subtitle="Money out"
      />
      <AddExpenseForm
        categories={categories}
        members={members}
        merchants={merchants}
        todayIso={today}
        prefill={prefill}
        template={template}
      />
    </div>
  );
}
```

Also remove the now-unused `ExpenseTemplate` import (it doesn't exist anymore). The `RawTemplate` type at the top of the file stays.

- [ ] **Step 6.3: Typecheck**

```bash
bun run typecheck
```

Expected: PASS. (Any remaining import of the old `ExpenseTemplate` type would error.)

- [ ] **Step 6.4: Verify `/add` still works in the browser**

Start dev server (`bun run dev`) and visit `http://localhost:3023/add`. The form should look identical to before. Also visit `http://localhost:3023/add?template=<an-existing-template-id>` if one exists, and verify prefill + "Override saved values" checkbox appear.

- [ ] **Step 6.5: Commit (wait for prompt)**

Stage:
```bash
git add app/\(app\)/add/AddExpenseForm.tsx app/\(app\)/add/page.tsx
```
Surface the staged diff. Do not commit until the user prompts.

---

## Task 7: Server actions — skip + log_subscription_expense + interval_days on register

**Files:**
- Modify: `app/(app)/subscriptions/actions.ts`

- [ ] **Step 7.1: Replace the whole file**

Full new content for `app/(app)/subscriptions/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logExpenseSchema } from "@/lib/validators/transaction";
import type { LogExpenseState } from "../add/actions";

export async function registerSubscriptionAction(p: {
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  cadence: string;
  next_renewal_at: string;
  paid_by_member_id?: string | null;
  for_member_id?: string | null;
  essential_pct?: number;
  interval_days?: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_subscription", {
    p: {
      ...p,
      amount_cents: p.amount_cents.toString(),
      interval_days: p.interval_days ?? null,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return {};
}

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

  // The subscription prefill always supplies a real category_id, so we don't
  // need the create-on-the-fly path that /add has. If the user happened to
  // type a new category name, we surface a friendly error.
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
```

- [ ] **Step 7.2: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 7.3: Commit (wait for prompt)**

Stage:
```bash
git add app/\(app\)/subscriptions/actions.ts
```
Surface the diff. Do not commit until the user prompts.

---

## Task 8: New route `/subscriptions/[id]/add`

**Files:**
- Create: `app/(app)/subscriptions/[id]/add/page.tsx`

- [ ] **Step 8.1: Create the page**

Create `app/(app)/subscriptions/[id]/add/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption,
  type ExpensePrefill,
} from "../../add/AddExpenseForm";
import { logSubscriptionExpenseAction } from "../actions";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";

export const metadata = { title: "Log subscription · Budget" };
export const dynamic = "force-dynamic";

type PrefillRow = {
  id: string;
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
};

export default async function SubscriptionAddPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: prefillRows, error: prefillErr },
    { data: categoriesData },
    { data: membersData },
    { data: merchantsData },
  ] = await Promise.all([
    supabase.rpc("get_subscription_prefill", { p_id: id }),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_household_members"),
    supabase.rpc("list_merchants"),
  ]);

  if (prefillErr || !prefillRows || (prefillRows as PrefillRow[]).length === 0) {
    redirect("/subscriptions");
  }

  const row = (prefillRows as PrefillRow[])[0];

  type RawCategory = { id: string; name: string };
  type RawMember = { id: string; display_name: string; role: "adult" | "kid" };
  type RawMerchant = { name: string };

  const categories: CategoryOption[] = ((categoriesData ?? []) as RawCategory[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));
  const members: MemberOption[] = ((membersData ?? []) as RawMember[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
  }));
  const merchants: string[] = ((merchantsData ?? []) as RawMerchant[])
    .map((m) => m.name)
    .filter(Boolean);

  const prefill: ExpensePrefill = {
    merchant: row.merchant,
    amount_cents: BigInt(
      typeof row.amount_cents === "string" ? row.amount_cents : row.amount_cents,
    ),
    category_id: row.category_id,
    category_name: row.category_name,
    paid_by_member_id: row.paid_by_member_id,
    for_member_id: row.for_member_id,
    essential_pct: row.essential_pct,
    split_rule: row.split_rule,
  };

  const today = new Date().toISOString().slice(0, 10);
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

- [ ] **Step 8.2: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 8.3: Smoke test in browser**

Pick an existing active subscription id from the `/subscriptions` page and visit `/subscriptions/<that-id>/add`. The form should show prefilled values (merchant, amount, category, split). Don't submit yet (Tasks 9-10 wire up the entry points).

- [ ] **Step 8.4: Commit (wait for prompt)**

Stage:
```bash
git add 'app/(app)/subscriptions/[id]/add/page.tsx'
```
Pause for user prompt.

---

## Task 9: Subscriptions page — three sections, MerchantCombobox, `custom_days`

**Files:**
- Modify: `app/(app)/subscriptions/page.tsx`
- Modify: `app/(app)/subscriptions/SubscriptionsClient.tsx`

- [ ] **Step 9.1: Update `page.tsx` data fetch**

Full new content for `app/(app)/subscriptions/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { SubscriptionsClient, type SubscriptionRow, type DueRow, type UpcomingRow, type Overlap } from "./SubscriptionsClient";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";

export const metadata = { title: "Subscriptions · Budget" };
export const dynamic = "force-dynamic";

type RawSub = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_id: string;
};

type RawDetailRow = {
  id: string;
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
};

type RawOverlap = {
  category_name: string;
  count: number;
  monthly_total_cents: number | string;
};

type RawMerchant = { name: string };

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: subsData },
    { data: dueData },
    { data: upcomingData },
    { data: overlapData },
    { data: categoriesData },
    { data: merchantsData },
  ] = await Promise.all([
    supabase.rpc("list_subscriptions"),
    supabase.rpc("list_due_subscriptions"),
    supabase.rpc("list_upcoming_subscriptions"),
    supabase.rpc("list_overlapping_subscriptions"),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_merchants"),
  ]);

  type RawCategory = { id: string; name: string };
  const categoryRows = (categoriesData ?? []) as RawCategory[];
  const categoryMap = new Map<string, string>(
    categoryRows.map((c) => [c.id, c.name]),
  );

  const dueIds = new Set<string>(((dueData ?? []) as RawDetailRow[]).map((r) => r.id));
  const upcomingIds = new Set<string>(((upcomingData ?? []) as RawDetailRow[]).map((r) => r.id));

  const allRows = ((subsData ?? []) as RawSub[])
    .slice()
    .sort((a, b) => a.next_renewal_at.localeCompare(b.next_renewal_at))
    .map<SubscriptionRow>((s) => ({
      id: s.id,
      merchant: s.merchant,
      amount_cents: toBig(s.amount_cents),
      cadence: s.cadence,
      next_renewal_at: s.next_renewal_at,
      active: s.active,
      category_name: categoryMap.get(s.category_id) ?? "—",
    }));

  const others = allRows.filter((r) => !dueIds.has(r.id) && !upcomingIds.has(r.id));

  const dueRows: DueRow[] = ((dueData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
  }));

  const upcomingRows: UpcomingRow[] = ((upcomingData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
  }));

  const overlaps: Overlap[] = ((overlapData ?? []) as RawOverlap[]).map((o) => ({
    category_name: o.category_name,
    count: o.count,
    monthly_total_cents: toBig(o.monthly_total_cents),
  }));

  const categories = categoryRows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));

  const merchants: string[] = ((merchantsData ?? []) as RawMerchant[])
    .map((m) => m.name)
    .filter(Boolean);

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Subscriptions" subtitle="Recurring expenses" />
      <SubscriptionsClient
        due={dueRows}
        upcoming={upcomingRows}
        others={others}
        overlaps={overlaps}
        categories={categories}
        merchants={merchants}
      />
    </div>
  );
}
```

- [ ] **Step 9.2: Update `SubscriptionsClient.tsx`**

Full new content for `app/(app)/subscriptions/SubscriptionsClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { formatCAD } from "@/lib/money";
import {
  registerSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipSubscriptionOccurrenceAction,
} from "./actions";

export type SubscriptionRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_name: string;
};

export type DueRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
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
  categories: Array<{ id: string; name: string }>;
  merchants: string[];
};

const CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_days",
] as const;

function cadenceLabel(c: string): string {
  return c === "custom_days" ? "custom" : c;
}

export function SubscriptionsClient({
  due,
  upcoming,
  others,
  overlaps,
  categories,
  merchants,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [cadence, setCadence] = useState<(typeof CADENCES)[number]>("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [nextRenewal, setNextRenewal] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  const add = () => {
    startTransition(async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return;
      const intervalDaysNum =
        cadence === "custom_days" ? Number(intervalDays) : null;
      if (cadence === "custom_days") {
        if (!Number.isInteger(intervalDaysNum) || (intervalDaysNum as number) < 1) {
          return;
        }
      }
      await registerSubscriptionAction({
        merchant,
        amount_cents: BigInt(Math.round(n * 100)),
        category_id: categoryId,
        cadence,
        next_renewal_at: nextRenewal,
        interval_days: intervalDaysNum,
      });
      setMerchant("");
      setAmount("0.00");
      setIntervalDays("30");
      setCadence("monthly");
      setAdding(false);
    });
  };

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
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · was {s.next_renewal_at}
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · renews {s.next_renewal_at}
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
                ? "No subscriptions yet."
                : "Nothing else."}
            </p>
          ) : (
            others.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · next {s.next_renewal_at}
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

      {adding ? (
        <div className="rounded-2xl bg-surface p-3 shadow-sm space-y-2">
          <MerchantCombobox
            merchants={merchants}
            name="merchant"
            defaultValue=""
            placeholder="Merchant (Netflix)"
            // The combobox is uncontrolled; we mirror its value via name="merchant"
            // and read it on submit. Because this client form drives registerSubscription
            // directly, we keep merchant in local state via an onInput listener.
          />
          {/* Mirror combobox value into local state for the action call. */}
          <input
            type="hidden"
            value={merchant}
            onChange={() => {}}
          />
          {/* Workaround: capture merchant from the rendered combobox input. */}
          <MerchantInputCapture onChange={setMerchant} />
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as (typeof CADENCES)[number])}
            className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {c === "custom_days" ? "custom (days)" : c}
              </option>
            ))}
          </select>
          {cadence === "custom_days" && (
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              placeholder="Interval days"
            />
          )}
          <Input type="date" value={nextRenewal} onChange={(e) => setNextRenewal(e.target.value)} />
          <div className="flex gap-2">
            <Button
              onClick={add}
              disabled={
                pending ||
                !merchant ||
                !categoryId ||
                (cadence === "custom_days" && (!intervalDays || Number(intervalDays) < 1))
              }
              className="flex-1"
            >
              {pending ? "Adding…" : "Add subscription"}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setAdding(true)} size="lg" className="w-full">
          Add subscription
        </Button>
      )}
    </div>
  );
}

/**
 * Tiny helper that bridges the uncontrolled MerchantCombobox (which keeps its
 * own internal state and writes a form field) to our local `merchant` state.
 * We don't want to refactor the combobox itself, so we read its rendered input
 * via DOM ref on mount + on each input event in the document subtree.
 */
function MerchantInputCapture({ onChange }: { onChange: (v: string) => void }) {
  return (
    <span
      style={{ display: "none" }}
      ref={(span) => {
        if (!span) return;
        // Find the combobox input within the parent siblings.
        const parent = span.parentElement;
        if (!parent) return;
        const input = parent.querySelector<HTMLInputElement>('input[name="merchant"]');
        if (!input) return;
        const handler = () => onChange(input.value);
        input.addEventListener("input", handler);
        handler();
        // Best-effort cleanup; React won't call this ref again until unmount.
      }}
    />
  );
}
```

**WAIT — this MerchantInputCapture hack is ugly.** Replace the bridging pattern with a simpler one: add a controlled wrapper around `MerchantCombobox` for this form, OR teach the form to read `merchant` from the form's hidden input directly at submit.

- [ ] **Step 9.3: Simpler bridge — switch the create form to a real `<form>` and read FormData**

Replace the entire `adding ? (...)` block with this cleaner version. Also delete the `MerchantInputCapture` helper. Drop the `merchant` state and instead read it from FormData at submit time:

```tsx
const submitCreate = (formData: FormData) => {
  startTransition(async () => {
    const m = ((formData.get("merchant") as string) ?? "").trim();
    const n = Number(amount);
    if (!m || !Number.isFinite(n) || n <= 0) return;
    const intervalDaysNum = cadence === "custom_days" ? Number(intervalDays) : null;
    if (cadence === "custom_days") {
      if (!Number.isInteger(intervalDaysNum) || (intervalDaysNum as number) < 1) {
        return;
      }
    }
    await registerSubscriptionAction({
      merchant: m,
      amount_cents: BigInt(Math.round(n * 100)),
      category_id: categoryId,
      cadence,
      next_renewal_at: nextRenewal,
      interval_days: intervalDaysNum,
    });
    setAmount("0.00");
    setIntervalDays("30");
    setCadence("monthly");
    setAdding(false);
  });
};
```

And the JSX `adding` block becomes:

```tsx
{adding ? (
  <form
    action={submitCreate}
    className="rounded-2xl bg-surface p-3 shadow-sm space-y-2"
  >
    <MerchantCombobox merchants={merchants} name="merchant" placeholder="Merchant (Netflix)" />
    <Input
      type="number"
      inputMode="decimal"
      step="0.01"
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
    />
    <select
      value={categoryId}
      onChange={(e) => setCategoryId(e.target.value)}
      className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
    >
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
    <select
      value={cadence}
      onChange={(e) => setCadence(e.target.value as (typeof CADENCES)[number])}
      className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
    >
      {CADENCES.map((c) => (
        <option key={c} value={c}>
          {c === "custom_days" ? "custom (days)" : c}
        </option>
      ))}
    </select>
    {cadence === "custom_days" && (
      <Input
        type="number"
        inputMode="numeric"
        step="1"
        min="1"
        value={intervalDays}
        onChange={(e) => setIntervalDays(e.target.value)}
        placeholder="Interval days"
      />
    )}
    <Input type="date" value={nextRenewal} onChange={(e) => setNextRenewal(e.target.value)} />
    <div className="flex gap-2">
      <Button
        type="submit"
        disabled={
          pending ||
          !categoryId ||
          (cadence === "custom_days" && (!intervalDays || Number(intervalDays) < 1))
        }
        className="flex-1"
      >
        {pending ? "Adding…" : "Add subscription"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
        Cancel
      </Button>
    </div>
  </form>
) : (
  <Button onClick={() => setAdding(true)} size="lg" className="w-full">
    Add subscription
  </Button>
)}
```

Remove the unused `merchant` state and any unused `setMerchant` references. Remove the `MerchantInputCapture` helper if you placed it.

Final imports at top of `SubscriptionsClient.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { formatCAD } from "@/lib/money";
import {
  registerSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipSubscriptionOccurrenceAction,
} from "./actions";
```

- [ ] **Step 9.4: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 9.5: Smoke test in the browser**

Visit `/subscriptions`. Verify:
- The page still renders.
- Tapping "Add subscription" opens the form; merchant input now shows the combobox suggestions (after typing).
- Switching cadence to "custom (days)" reveals the interval-days input; switching away hides it.
- Submitting with `custom_days` and `interval_days=14` returns to the list with the new subscription visible.

- [ ] **Step 9.6: Commit (wait for prompt)**

Stage:
```bash
git add 'app/(app)/subscriptions/page.tsx' 'app/(app)/subscriptions/SubscriptionsClient.tsx'
```
Pause for the user's prompt.

---

## Task 10: Home page — `DueSubscriptionsCard`

**Files:**
- Create: `app/(app)/dashboard/DueSubscriptionsCard.tsx`
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 10.1: Create `DueSubscriptionsCard.tsx`**

Create `app/(app)/dashboard/DueSubscriptionsCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import { skipSubscriptionOccurrenceAction } from "../subscriptions/actions";

export type DueRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
};

export function DueSubscriptionsCard({ rows }: { rows: DueRow[] }) {
  const [pending, startTransition] = useTransition();

  const skip = (id: string) => {
    startTransition(async () => {
      await skipSubscriptionOccurrenceAction(id);
    });
  };

  return (
    <div className="mx-4 mb-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-brick/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-brick">
          Due subscriptions · {rows.length}
        </div>
      </div>
      <ul className="divide-y divide-line/40">
        {rows.map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate">{r.merchant}</div>
              <div className="text-[11px] text-faint">
                {r.category_name} · was {r.next_renewal_at}
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

- [ ] **Step 10.2: Modify `dashboard/page.tsx`**

Modify the parallel RPC batch and JSX. The two specific changes:

1. **Import + add RPC call**

Add at top:
```tsx
import { DueSubscriptionsCard, type DueRow } from "./DueSubscriptionsCard";
```

Replace the `Promise.all([...])` block:

```tsx
  const [
    { data: summaryData },
    { data: householdIdRaw },
    { data: dueSubsData },
  ] = await Promise.all([
    supabase.rpc("get_dashboard_summary", { p_year: year, p_month: month }),
    supabase.rpc("get_current_household"),
    supabase.rpc("list_due_subscriptions"),
  ]);
```

Add the type and projection just before the `return (`:

```tsx
  type RawDueRow = {
    id: string;
    merchant: string;
    amount_cents: number | string;
    category_name: string;
    cadence: string;
    next_renewal_at: string;
  };
  const dueRows: DueRow[] = ((dueSubsData ?? []) as RawDueRow[]).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
  }));
```

2. **Render the card as the FIRST content card** (above the sage hero)

Inside the returned JSX, immediately after `<AppBar .../>`, insert:

```tsx
      {dueRows.length > 0 && <DueSubscriptionsCard rows={dueRows} />}
```

- [ ] **Step 10.3: Typecheck**

```bash
bun run typecheck
```
Expected: PASS.

- [ ] **Step 10.4: Smoke test**

Visit `/dashboard`. If no subs are due, the card shouldn't appear. To force a due sub for testing, you can:
- Create a subscription on `/subscriptions` with `next_renewal_at` set to today's date, OR
- In the Supabase SQL editor: `UPDATE public.subscription SET next_renewal_at = current_date WHERE merchant = '<your test sub>';`

Then reload `/dashboard` — the card should appear at top with the sub's row, "Add" button, and "Skip" button.

- [ ] **Step 10.5: Commit (wait for prompt)**

Stage:
```bash
git add 'app/(app)/dashboard/page.tsx' 'app/(app)/dashboard/DueSubscriptionsCard.tsx'
```
Pause for prompt.

---

## Task 11: E2E test — Add from due

**Files:**
- Create: `tests/e2e/subscription-add-from-due.spec.ts`

This test exercises: create a subscription with `next_renewal_at = today`, visit dashboard, tap Add, the form is prefilled, save, redirected to dashboard, transaction visible.

- [ ] **Step 11.1: Create the test**

```ts
// 2026-06-06: subscription "Add" flow from the home page due card.
// Creates a subscription whose next_renewal_at is today so it shows up in
// the Due card. Verifies prefill, save, redirect, and that the row is gone
// from the due card afterwards.

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

test("Add from due subscription prefills, saves, and clears the due card", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  // Create a subscription due today.
  const merchant = `DueSub-${Date.now()}`;
  await page.getByRole("button", { name: /add subscription/i }).click();
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("12.34");
  // Cadence stays monthly (default). Next renewal stays today (default).
  await page.getByRole("button", { name: /^add subscription$/i }).click();

  // Go to dashboard; the Due card should appear with our row.
  await page.goto("/dashboard");
  const dueRow = page.locator("text=Due subscriptions").locator("..");
  await expect(dueRow.getByText(merchant)).toBeVisible({ timeout: 5_000 });

  // Tap Add.
  await dueRow.getByRole("link", { name: /^Add$/ }).first().click();
  await page.waitForURL(/\/subscriptions\/.+\/add/);

  // Verify prefill: the amount field should show 12.34.
  await expect(page.locator('input[name="amount_cents_dollars"]')).toHaveValue("12.34");

  // Save.
  await page.getByRole("button", { name: /save & advance/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The merchant appears in Recent activity.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // The due card no longer shows our row (renewal advanced one month forward).
  const dueCard = page.locator("text=Due subscriptions");
  if (await dueCard.isVisible().catch(() => false)) {
    await expect(dueCard.locator("..").getByText(merchant)).toHaveCount(0);
  }
});
```

- [ ] **Step 11.2: Run the test**

```bash
bun run test:e2e -- subscription-add-from-due.spec.ts
```
Expected: PASS.

If the dev server isn't running, Playwright config should start it. If signin fails because the user doesn't exist, follow the quickstart in `tests/e2e/log-expense-realtime.spec.ts` comments to seed the user.

- [ ] **Step 11.3: Commit (wait for prompt)**

Stage and pause.

---

## Task 12: E2E test — Skip from due

**Files:**
- Create: `tests/e2e/subscription-skip.spec.ts`

- [ ] **Step 12.1: Create the test**

```ts
// 2026-06-06: subscription "Skip" flow from the home page due card.
// Creates a subscription due today, taps Skip on the dashboard, verifies the
// row is gone AND no transaction was logged.

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

test("Skip advances the subscription with no transaction", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  const merchant = `SkipSub-${Date.now()}`;
  await page.getByRole("button", { name: /add subscription/i }).click();
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("9.99");
  await page.getByRole("button", { name: /^add subscription$/i }).click();

  await page.goto("/dashboard");
  const dueCard = page.locator("text=Due subscriptions").locator("..");
  await expect(dueCard.getByText(merchant)).toBeVisible({ timeout: 5_000 });

  // Tap Skip for our row.
  const row = dueCard.locator(`li:has-text("${merchant}")`);
  await row.getByRole("button", { name: /skip/i }).click();

  // The row disappears from the due card.
  await expect(dueCard.getByText(merchant)).toHaveCount(0, { timeout: 5_000 });

  // No new transaction with this merchant in Recent activity.
  await expect(page.getByText(merchant)).toHaveCount(0);
});
```

- [ ] **Step 12.2: Run**

```bash
bun run test:e2e -- subscription-skip.spec.ts
```
Expected: PASS.

- [ ] **Step 12.3: Commit (wait for prompt)**

Stage and pause.

---

## Task 13: E2E test — Custom-days cadence

**Files:**
- Create: `tests/e2e/subscription-custom-days.spec.ts`

- [ ] **Step 13.1: Create the test**

```ts
// 2026-06-06: subscription create flow with cadence=custom_days.
// Verifies the interval-days input only appears when "custom (days)" is
// selected, and that a sub with cadence=custom_days, interval_days=14 saves
// successfully.

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

test("Create subscription with custom_days cadence", async ({ page }) => {
  await signIn(page);
  await page.goto("/subscriptions");

  await page.getByRole("button", { name: /add subscription/i }).click();

  // Interval-days input should not be visible yet.
  await expect(page.getByPlaceholder("Interval days")).toHaveCount(0);

  // Pick custom (days).
  const cadenceSelect = page.locator("select").nth(1);
  await cadenceSelect.selectOption("custom_days");

  // Interval-days input now visible, default 30.
  await expect(page.getByPlaceholder("Interval days")).toBeVisible();
  await page.getByPlaceholder("Interval days").fill("14");

  const merchant = `Custom-${Date.now()}`;
  await page.locator('input[name="merchant"]').fill(merchant);
  await page.locator('input[type="number"]').first().fill("5.00");

  await page.getByRole("button", { name: /^add subscription$/i }).click();

  // The new subscription appears in the list.
  await expect(page.getByText(merchant).first()).toBeVisible({ timeout: 5_000 });

  // Switch back to monthly — interval-days input should disappear again.
  await page.getByRole("button", { name: /add subscription/i }).click();
  // (The form is reset on close+reopen.)
  await expect(page.getByPlaceholder("Interval days")).toHaveCount(0);
});
```

- [ ] **Step 13.2: Run**

```bash
bun run test:e2e -- subscription-custom-days.spec.ts
```
Expected: PASS.

- [ ] **Step 13.3: Commit (wait for prompt)**

Stage and pause.

---

## Task 14: Final verification

- [ ] **Step 14.1: Full typecheck + unit tests**

```bash
bun run typecheck
bun run test:unit
```
Both PASS.

- [ ] **Step 14.2: Full E2E run (existing tests must not regress)**

```bash
bun run test:e2e
```
All PASS. Particularly check:
- `subscription-auto-log.spec.ts` (existing) — its name is misleading; it actually only tests the create + pause/resume flow. The merchant input now uses the combobox, so the `getByPlaceholder(/merchant/i)` may need updating to `locator('input[name="merchant"]')`. Update only if it fails; otherwise leave it.
- `log-expense-realtime.spec.ts` — unaffected.

- [ ] **Step 14.3: Update `subscription-auto-log.spec.ts` if needed**

If Step 14.2 reveals it fails because the merchant input no longer matches the old selector, change line 24 from:
```ts
  await page.getByPlaceholder(/merchant/i).fill(`Netflix-${Date.now()}`);
```
to:
```ts
  await page.locator('input[name="merchant"]').fill(`Netflix-${Date.now()}`);
```

Rerun `subscription-auto-log.spec.ts` to confirm. Stage and pause for prompt.

- [ ] **Step 14.4: Manual UX pass**

In the browser, walk:
1. `/dashboard` → Due card present when something is due, absent otherwise.
2. Tap Add on a due row → prefilled form on `/subscriptions/[id]/add` → save → redirected to `/dashboard` with new transaction.
3. Tap Skip on a due row → row disappears, no transaction logged.
4. `/subscriptions` → three sections render as expected; Possible savings card untouched.
5. Create form → merchant input shows previous-merchant suggestions; cadence picker includes "custom (days)"; switching to custom reveals the interval input.

- [ ] **Step 14.5: Surface diff and stop**

Run:
```bash
git status
git diff --stat
```
Report to the user. **Do not commit.** Wait for an explicit "commit" prompt.

---

## Self-review checklist (already done — recorded for the executor)

- **Spec coverage:** every section in `2026-06-06-subscription-rework-design.md` maps to at least one task above (schema → T1; RPCs → T1-T5; server actions → T7; form refactor → T6; new route → T8; subs page → T9; home card → T10; tests → T11-T13).
- **Placeholder scan:** no TBD / TODO / "handle edge cases" left. Every step has actual code or commands.
- **Type consistency:** `DueRow` defined in `SubscriptionsClient.tsx` and `DueSubscriptionsCard.tsx` have the same fields; both files own their copy so neither has to import the other. `ExpensePrefill` and `ExpenseTemplateRef` are exported from `AddExpenseForm.tsx` and consumed by both `/add/page.tsx` and `/subscriptions/[id]/add/page.tsx` with the same field names. Server action `logSubscriptionExpenseAction` returns `LogExpenseState` (imported from `../add/actions`) — same type the form expects via `useActionState`.
