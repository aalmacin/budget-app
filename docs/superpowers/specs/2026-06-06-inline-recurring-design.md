# Inline recurring on Add Expense / Add Income — design

**Date:** 2026-06-06
**Branch:** fixes-03
**Status:** Approved (brainstorming) — ready for implementation plan
**Builds on:** `docs/superpowers/specs/2026-06-06-subscription-rework-design.md`

## Problem

Subscription creation currently lives in an inline panel on `/subscriptions`.
Users have to context-switch to a separate page (and a separate form) to make
something recurring. We want to fold "recurring" into the existing Add Expense
and Add Income flows so the user picks "Recurring" the same time they enter
the first occurrence.

Income subscriptions don't exist in the schema today — this design adds them.

## Goals

1. Add a "Recurring" checkbox on both `/add` (expense) and `/add-income`. When
   checked, reveal an inline block with cadence + (optional) interval days +
   start date.
2. On save with Recurring checked: insert the first transaction AND create the
   subscription row atomically. `next_renewal_at = start_date + 1 cadence step`.
3. Extend `public.subscription` to support `type='income'` with `income_source`.
4. Remove the inline "Add subscription" panel on `/subscriptions`. Creation is
   now exclusively via the recurring checkbox.
5. Generalize `/subscriptions/[id]/add` so it renders either `AddExpenseForm`
   or `AddIncomeForm` based on the subscription's type.

## Non-goals

- Touching `list_overlapping_subscriptions` (stays expense-only).
- Backfilling income subscriptions for historical income transactions.
- Reworking `log_expense` / `log_income` themselves — the recurring path uses
  new dedicated RPCs.
- Adding a "Recurring" template-save feature (the saved-template UI stays
  orthogonal; if both are checked, recurring wins server-side).

## Schema changes

One forward migration (per the never-edit-applied-migrations rule). Use a
timestamp later than the highest visible (current latest local: `20260606000012`).

### `public.subscription`
- Add `type TEXT NOT NULL DEFAULT 'expense'` with CHECK in `('expense', 'income')`.
  Default backfills existing rows as expense.
- Add `income_source TEXT NULL` with CHECK in `('Salary', 'Contract', 'Self_employed', 'Benefit', 'Refund', 'Gift')`. Matches the income form's `<select>` values.
- Add a type-aware constraint:
  - `type='expense'` → `income_source IS NULL`.
  - `type='income'`  → `income_source IS NOT NULL`, `for_member_id IS NULL`,
    `split_rule IS NULL`, `essential_pct = 100`. (We keep the columns and
    force neutral values so existing RPCs that read them don't need null-handling
    branches.)

No data migration: all existing rows are valid as `type='expense'`,
`income_source=NULL`.

## RPCs

All new functions follow the project pattern: `SECURITY DEFINER`,
`SET search_path = ''`, owner `budget_function_owner`, `REVOKE ALL FROM PUBLIC`,
`GRANT EXECUTE TO authenticated`.

### New
1. **`log_expense_with_subscription(p JSONB) → UUID`**
   Atomic: inserts an expense transaction with `subscription_id` + `occurrence_date = start_date`, then inserts a subscription row with `type='expense'` and `next_renewal_at = start_date + 1 cadence step`. Validates start_date / cadence / interval_days iff custom_days. Uses the partial unique index `(subscription_id, occurrence_date)` for idempotency.

2. **`log_income_with_subscription(p JSONB) → UUID`**
   Same pattern. Inserts an income transaction (no `for_member_id` / `essential_pct` / `split_rule`) and a subscription with `type='income'`, `income_source` set, `essential_pct=100`, `split_rule=NULL`, `for_member_id=NULL`. Validates `income_source` is required and one of the allowed values.

3. **`log_subscription_income(p JSONB) → UUID`**
   Mirrors `log_subscription_expense` but for income subs. Inserts an income transaction with `subscription_id`/`occurrence_date` set; advances `next_renewal_at` by one cadence step from the ORIGINAL renewal date; uses `ON CONFLICT (subscription_id, occurrence_date) DO NOTHING`.

### Updated (RETURNS TABLE shape changes)
4. **`list_due_subscriptions()`** — add `type TEXT` and `income_source TEXT`.
5. **`list_upcoming_subscriptions()`** — add `type TEXT` and `income_source TEXT`.
6. **`get_subscription_prefill(p_id UUID)`** — add `type TEXT` and `income_source TEXT`.

### Unchanged
- `register_subscription` — left in place but now unused. Drop the server action wrapper (`registerSubscriptionAction`); the RPC itself is dormant.
- `log_expense`, `log_income`, `pause_subscription`, `resume_subscription`, `skip_subscription_occurrence`, `log_subscription_expense`, `list_subscriptions`, `list_overlapping_subscriptions`.

## Server actions

### `app/(app)/add/actions.ts`
`logExpenseAction` reads four optional fields from FormData:
- `recurring` (`"on"` when checked)
- `cadence`
- `interval_days` (only when `cadence=custom_days`)
- `start_date`

Behavior:
- `recurring` absent → call `log_expense` (unchanged).
- `recurring` present → validate cadence + start_date + (interval_days iff custom_days) with a new `recurringSchema`. Call `log_expense_with_subscription` instead. Same revalidate + redirect.

### `app/(app)/add-income/actions.ts`
Mirror change for `logIncomeAction` → `log_income_with_subscription`.

### `app/(app)/subscriptions/actions.ts`
- Add `logSubscriptionIncomeAction(subscriptionId, prev, formData)` — wraps `log_subscription_income`. Same shape as `logSubscriptionExpenseAction`.
- **Delete `registerSubscriptionAction`** — no longer wired to any UI.

### `lib/validators/transaction.ts`
Add `recurringSchema`:
```ts
export const recurringSchema = z.object({
  cadence: z.enum(["weekly","biweekly","monthly","quarterly","yearly","custom_days"]),
  interval_days: z.coerce.number().int().positive().nullable().optional(),
  start_date: isoDate,
});
```
Server actions enforce the `custom_days` ↔ `interval_days > 0` iff rule inline.

## Forms

### New shared component: `components/transactions/RecurringFields.tsx`
- Controlled checkbox `<input type="checkbox" name="recurring">`.
- When checked, expands inline (smooth transition) to reveal:
  - Cadence `<select name="cadence">` — six options. `custom_days` displays as "custom (days)".
  - Conditional `<input type="number" name="interval_days" min="1" step="1">` shown only when `cadence === "custom_days"` (default `30`).
  - `<input type="date" name="start_date">` defaulting to today.
- When unchecked, the inner inputs are unmounted (so they don't post stale values).
- Props: `{ todayIso: string }`.

### `app/(app)/add/AddExpenseForm.tsx`
- Render `<RecurringFields todayIso={todayIso} />` just above the template-related checkbox row.
- Hide the entire recurring block when `submitAction !== undefined` (subscription-mode prefill from `/subscriptions/[id]/add`). Recurring doesn't make sense when you're logging an existing sub's occurrence.

### `app/(app)/add-income/AddIncomeForm.tsx` — refactor + recurring
- Add optional `prefill?: IncomePrefill | null` and `submitAction?` / `submitLabel?` / `cancelHref?` props (mirror the `AddExpenseForm` shape established in the prior rework).
- `IncomePrefill` shape: `{ amount_cents: bigint; notes: string; paid_by_member_id: string; income_source: string }`.
- Render `<RecurringFields todayIso={todayIso} />` just above the submit area when `submitAction` is undefined (default path). Hide in subscription-mode.

## Subscriptions page

### `app/(app)/subscriptions/SubscriptionsClient.tsx`
- **Delete the inline "Add subscription" panel** and everything that supports it: the `adding` state, the `submitCreate` handler, the inline create form, `MerchantCombobox` / cadence select / interval-days input within the create form.
- Drop `categories` and `merchants` props (not needed once the create form is gone).
- Type-aware rows in Due / Upcoming / All others:
  - Expense row label: unchanged — `{merchant} · {category} · {date}`.
  - Income row label: `{merchant} · {income_source} · {date}` with a small sage "In" pill before the merchant text. Expense rows get a brick "Out" pill for parity.
- Pause / Resume / Skip apply to both types unchanged.
- The "Possible savings" overlap card stays.

### `app/(app)/subscriptions/page.tsx`
- Drop the `list_categories` and `list_merchants` fetches.
- Add `type: "expense" | "income"` and `income_source: string | null` to the `RawSub` / `RawDetailRow` types and to the client-facing `SubscriptionRow` / `DueRow` / `UpcomingRow` types.
- Compute the "All others" group as before.

## `/subscriptions/[id]/add` route

### `app/(app)/subscriptions/[id]/add/page.tsx`
- Fetch the prefill row (now includes `type`, `income_source`).
- Branch on `row.type`:
  - `expense` → existing path: build `ExpensePrefill`, bind `logSubscriptionExpenseAction.bind(null, id)`, render `<AddExpenseForm ... />`.
  - `income` → build `IncomePrefill`, bind `logSubscriptionIncomeAction.bind(null, id)`, render `<AddIncomeForm prefill={prefill} submitAction={bound} submitLabel="Save & advance" cancelHref="/subscriptions" />`.
- The route fetches `list_categories` only when needed (expense path) to keep the income branch lean.

## Dashboard

### `DueSubscriptionsCard.tsx`
- `DueRow` gains `type: "expense" | "income"` and `income_source: string | null`.
- Each row renders a small pill before the merchant: brick "Out" for expense, sage "In" for income.
- "Add" link still goes to `/subscriptions/[id]/add` (which branches internally).
- Skip works the same for both.

### `app/(app)/dashboard/page.tsx`
- `RawDueRow` gains the two new fields; the projection into `DueRow` carries them through.

## Tests

### RPC / migration (Vitest)
- `log_expense_with_subscription` happy path: inserts a transaction AND a subscription row; `next_renewal_at = start_date + 1 cadence step`; transaction's `occurrence_date = start_date`.
- `log_expense_with_subscription` idempotency: a second call with the same payload returns the existing transaction id (via ON CONFLICT) and does NOT advance `next_renewal_at` again.
- `log_expense_with_subscription` rejects when `cadence='custom_days'` and `interval_days IS NULL` (and the inverse for non-custom).
- `log_income_with_subscription` happy path: same as above for income, with `income_source` populated and `for_member_id/split_rule=NULL`.
- `log_income_with_subscription` rejects when `income_source IS NULL`.
- `log_subscription_income` advances renewal from ORIGINAL date, not `occurred_on`.
- `subscription` type-aware constraint rejects:
  - `type='expense'` with `income_source IS NOT NULL`.
  - `type='income'` with `income_source IS NULL`.
  - `type='income'` with `for_member_id IS NOT NULL`.
  - `type='income'` with `split_rule IS NOT NULL`.
- `list_due_subscriptions` returns rows of both types ordered by `next_renewal_at`.

### E2E (Playwright)
- `recurring-expense.spec.ts` — `/add` with Recurring checked, cadence=monthly, start_date=today: save, expense in Recent activity, subscription visible on `/subscriptions` All-others (since next_renewal_at = today + 1 month → not due).
- `recurring-income.spec.ts` — `/add-income` with Recurring checked, cadence=monthly: save, income in Recent activity, subscription on `/subscriptions` shows with "In" pill.
- `subscription-add-from-due-income.spec.ts` — seed a due income sub (or create one with start_date set to last month so it's now due); tap Add on the dashboard card; the page renders `AddIncomeForm` prefilled; save; redirected; renewal advanced.
- Update `subscription-add-from-due.spec.ts` (existing) to seed via the new Recurring flow rather than the removed inline panel.
- Update `subscription-skip.spec.ts` (existing) similarly.
- Update `subscription-custom-days.spec.ts` (existing) to exercise the new checkbox flow.
- Update `subscription-auto-log.spec.ts` (existing) — the inline "Add subscription" panel no longer exists; redirect the test to use the new Recurring flow.

## Open questions

None.

## Migration ordering

One new migration file with a timestamp strictly later than `20260606000012`. Suggested: `20260606000020_inline_recurring_subscriptions.sql` to leave headroom. If timestamp collides with another branch on push, bump per the `feedback_cross_branch_migrations` memory.
