# Subscription rework — manual expense logging, due-card UX

**Date:** 2026-06-06
**Branch:** fixes-03
**Status:** Approved (brainstorming) — ready for implementation plan

## Problem

The current subscription model auto-creates expense transactions hourly via a
pg_cron job. That removes user agency: there is no chance to tweak the date,
amount, merchant, or split before the transaction is recorded, and there is no
visibility into which subscriptions are due. Subscriptions also offer no
"custom interval" cadence, and their create form uses a plain text input for
merchant while the regular expense form uses a combobox with prior-merchant
suggestions.

## Goals

1. Stop auto-materializing subscriptions into transactions.
2. Surface due subscriptions on the home page (top card, hidden when empty)
   and on the subscriptions page (Due section).
3. Let the user tap **Add** on a due subscription to open the full expense
   form prefilled from the subscription, tweak any field, and save — which
   atomically inserts the transaction and advances `next_renewal_at` by one
   cadence step.
4. Let the user tap **Skip** to advance `next_renewal_at` by one step without
   creating a transaction (the subscription remains visible on the
   subscriptions page).
5. Show **Upcoming** subscriptions on the subscriptions page using a
   cadence-relative window (monthly = 1 week ahead, yearly = 1 month ahead,
   etc.).
6. Replace the subscription create form's plain merchant `<Input>` with the
   existing `MerchantCombobox`.
7. Add a `custom_days` cadence so users can pick any interval (default 30
   days).

## Non-goals

- Cleaning up historical auto-materialized transactions (left untouched).
- Removing the `materialize_due_subscriptions` RPC (kept dormant; only the
  cron schedule is dropped). Transaction columns `subscription_id` and
  `occurrence_date` remain in use for traceability.
- Editing existing subscription rows from the due card (out of scope —
  users can still edit cadence/amount via the subscriptions list).
- Touching the "Possible savings" overlap card on the subscriptions page.
- Touching `pause_subscription` / `resume_subscription`.

## Schema changes

One new forward migration (no edits to applied migrations — per project rule).

### `public.subscription`
- Add `interval_days INT NULL`.
- Constraint: `interval_days IS NOT NULL` **iff** `cadence = 'custom_days'`,
  AND `interval_days > 0` when present.
- Extend the `cadence` CHECK to allow `'custom_days'` alongside the existing
  `weekly | biweekly | monthly | quarterly | yearly`.

### Cron
- `SELECT cron.unschedule('subscriptions-hourly');` — drops the hourly job.
- `materialize_due_subscriptions(p_bypass_rls)` stays in place (dormant).
  Add a SQL comment marking it deprecated; do not drop, to keep existing
  grants and to leave the door open for backfill use.

## RPCs

All new functions: `SECURITY DEFINER`, `SET search_path = ''`, owner
`budget_function_owner`, `EXECUTE` granted to `authenticated`. Same pattern
as existing subscription RPCs.

### `list_due_subscriptions()`
Returns active subs with `next_renewal_at <= current_date`, ordered by
`next_renewal_at` ASC (most overdue first). Columns:
```
id, merchant, amount_cents, category_id, category_name, cadence,
interval_days, next_renewal_at, paid_by_member_id, for_member_id,
essential_pct, split_rule
```
Same column shape powers both the home-page card and the subscriptions-page
"Due" section.

### `list_upcoming_subscriptions()`
Returns active subs whose `next_renewal_at` is **in the future** AND within
the cadence-relative upcoming window. Window per cadence:

| Cadence       | Window (days before `next_renewal_at`) |
|---------------|----------------------------------------|
| `weekly`      | 1                                      |
| `biweekly`    | 3                                      |
| `monthly`     | 7                                      |
| `quarterly`   | 14                                     |
| `yearly`      | 30                                     |
| `custom_days` | `least(ceil(interval_days/4), 30)`     |

Same column shape as `list_due_subscriptions`.

### `get_subscription_prefill(p_id UUID)`
Single-row variant for the `/subscriptions/[id]/add` route. Raises if the
sub is not visible to the caller's household (RLS via `auth_user_household_ids`
is automatic; the function additionally raises a friendly error if no row).

### `skip_subscription_occurrence(p_id UUID)`
Advances `next_renewal_at` by one cadence step. For `custom_days`, advances
by `interval_days`. Creates **no transaction**. No-op if the subscription is
inactive or not visible.

### `log_subscription_expense(p JSONB)`
Atomic operation. Payload:
```
{
  subscription_id,           -- required
  amount_cents,              -- required (may differ from sub default)
  category_id,               -- required
  notes,                     -- merchant string the user submitted
  occurred_on,               -- required (date the user picked)
  paid_by_member_id,         -- optional
  for_member_id,             -- optional
  essential_pct,             -- optional
  split_rule                 -- optional
}
```
Behavior:
1. Validate household ownership of subscription.
2. INSERT into `public.transaction` (type=`expense`,
   `subscription_id` set, `occurrence_date` = the original
   `next_renewal_at` for ON CONFLICT idempotency with the existing partial
   unique index).
3. UPDATE `subscription.next_renewal_at`: add **one cadence step** to the
   row's **original** `next_renewal_at`. **Not** based on `occurred_on`.
   (This was an explicit design decision — keeps rhythm even when logged
   late.)
4. Return the inserted transaction id.

### `register_subscription(p JSONB)` — modify
Accept new optional key `interval_days INT`. Validate:
- Required when `cadence = 'custom_days'`; rejects otherwise (errcode 22023).
- Must be > 0 when present.

## Server actions

### `app/(app)/subscriptions/actions.ts` — add
- `skipSubscriptionOccurrenceAction(id: string)` — calls
  `skip_subscription_occurrence`, revalidates `/dashboard` and
  `/subscriptions`.
- `logSubscriptionExpenseAction(subscriptionId: string, prev: LogExpenseState, formData: FormData)` —
  reuses `logExpenseSchema` from `@/lib/validators/transaction`. Calls
  `log_subscription_expense` with `{ ...validated, subscription_id }`.
  Revalidates `/dashboard`, `/transactions`, `/subscriptions`. On success
  `redirect("/dashboard")`. Returns same `LogExpenseState` shape used by
  `/add` so `useActionState` is identical.

### `app/(app)/subscriptions/actions.ts` — modify
- `registerSubscriptionAction` — accept optional `interval_days: number | null`
  and pass through in the RPC payload.

### No changes
`app/(app)/add/actions.ts` is unchanged.

## Routes

### New: `app/(app)/subscriptions/[id]/add/page.tsx`
Server component. Fetches in parallel:
- `get_subscription_prefill(id)`
- `list_categories({ p_kind: 'expense' })`
- `list_household_members()` (same RPC `/add` uses)
- `list_merchants()`

Computes `initialValues` from the prefill row, renders
`<AddExpenseForm initialValues={...} submitAction={bound} submitLabel="..." cancelHref="/subscriptions" .../>`.
404 on missing subscription redirects to `/subscriptions`.

## Components

### `components/.../AddExpenseForm.tsx` — additive props

New optional props (existing `/add` callers don't pass them, no behavior
change):
```ts
type Props = {
  // ...existing props...
  initialValues?: {
    amount_cents?: bigint;
    category_id?: string;
    notes?: string;
    paid_by_member_id?: string | null;
    for_member_id?: string | null;
    essential_pct?: number;
    split_rule?: SplitRule | null;
  };
  submitAction?: (
    prev: LogExpenseState,
    formData: FormData,
  ) => Promise<LogExpenseState>;
  submitLabel?: string;
  cancelHref?: string;
};
```

Internal changes:
- `amount` initial state derived from `initialValues.amount_cents` (display
  dollars to 2 decimals).
- `forMember`, `essentialPct`, `splitRule` initial states seeded from
  `initialValues`.
- Pass `defaultValue` to `CategoryCombobox` (by id) and `MerchantCombobox`
  (by string). Verify both expose `defaultValue` — if not, small additive
  prop on each.
- Submit button label uses `submitLabel ?? "Save expense"`.
- When `cancelHref` present, render a "Cancel" `<Link>` beside submit.

### New: `app/(app)/dashboard/DueSubscriptionsCard.tsx` (client)
Header "Due subscriptions" + count badge. Each row:
- merchant · category · "renewal was {date}", amount.
- **Add** button — `<Link href={`/subscriptions/${id}/add`}>`, primary.
- **Skip** button — `useTransition` + `skipSubscriptionOccurrenceAction(id)`.
  Disabled while pending; "Skipping…" label.

Card styled with existing primitives (`rounded-3xl bg-surface p-4 shadow-sm`),
with a brick-tinted accent to differentiate from passive content. Rendered
only when the list has rows.

### `app/(app)/dashboard/page.tsx` — modify
Add `list_due_subscriptions` to the parallel RPC batch. If the result has
rows, render `<DueSubscriptionsCard rows={...} />` **above** the sage
"Left to spend" hero (per design decision: first content card).
`RealtimeRefresher` already triggers `router.refresh()` on household changes,
so Add/Skip propagate without extra wiring.

### `app/(app)/subscriptions/page.tsx` — modify
Fetch `list_due_subscriptions`, `list_upcoming_subscriptions`,
`list_subscriptions` in parallel (in addition to current categories/overlap).
Compute "All others" on the server by excluding due/upcoming ids from the
full list. Pass three arrays to `SubscriptionsClient`. Also pass `merchants`
(from `list_merchants`).

### `app/(app)/subscriptions/SubscriptionsClient.tsx` — modify
Sections in render order:
1. **Possible savings** (existing overlap card) — unchanged.
2. **Due** — each row shows merchant/category/"renewal was {date}", amount,
   Add (link) + Skip (action). Brick accent. Section omitted when empty.
3. **Upcoming** — each row shows merchant/category/"renews {date}", amount.
   No actions (heads-up only). Section omitted when empty.
4. **All others** — existing list shape with Pause/Resume.
5. **Add subscription** form (existing inline panel).

Create form changes:
- Merchant `<Input>` → `<MerchantCombobox merchants={merchants} name="merchant" />`.
- Cadence `<select>` → add `Custom (days)` as a sixth option (value
  `custom_days`).
- When `cadence === "custom_days"`, reveal `<Input type="number" min="1" step="1">`
  for interval days (default `30`); hidden otherwise.
- `registerSubscriptionAction` call: pass `interval_days` as a number when
  custom, `null` otherwise.
- Client-side guard: disable submit when `cadence === "custom_days"` and
  `interval_days < 1`.

## Cadence-step helper (SQL)

Used by `log_subscription_expense` and `skip_subscription_occurrence`:

```sql
v_next := CASE r.cadence
  WHEN 'weekly'      THEN r.next_renewal_at + INTERVAL '7 days'
  WHEN 'biweekly'    THEN r.next_renewal_at + INTERVAL '14 days'
  WHEN 'monthly'     THEN r.next_renewal_at + INTERVAL '1 month'
  WHEN 'quarterly'   THEN r.next_renewal_at + INTERVAL '3 months'
  WHEN 'yearly'      THEN r.next_renewal_at + INTERVAL '1 year'
  WHEN 'custom_days' THEN r.next_renewal_at + (r.interval_days || ' days')::INTERVAL
END;
```

## Tests

### RPC / migration (Vitest)
- `register_subscription` requires `interval_days > 0` when
  `cadence='custom_days'`; rejects when missing.
- `register_subscription` with a non-custom cadence rejects when
  `interval_days` is provided.
- `list_due_subscriptions` returns only `next_renewal_at <= today` and only
  active rows.
- `list_upcoming_subscriptions` respects the cadence-relative window
  (cases: monthly = 7d, yearly = 30d, `custom_days` interval=20 → 5d window).
- `skip_subscription_occurrence` advances `next_renewal_at` by one cadence
  step (one case per cadence, including `custom_days`), creates no
  transaction.
- `log_subscription_expense` inserts a transaction AND advances
  `next_renewal_at` from the **original** date, not from `occurred_on`.

### E2E (Playwright)
- Home page: seeded due subscription appears in top card → tap **Add** →
  form prefilled → save → redirected to `/dashboard`, transaction visible in
  Recent activity, due card row gone, `next_renewal_at` advanced.
- Home page: due sub → tap **Skip** → row disappears, no new transaction in
  Recent activity, `next_renewal_at` advanced.
- Subscriptions page: due / upcoming / all-others sections render correctly
  given seeded data spanning the windows.
- Subscriptions page create form: pick `Custom (days)`, enter `14`, submit →
  succeeds; verify the interval-days input is hidden for non-custom cadences.

### Out of scope
The cron job removal — there is no realistic way to time-test the absence
of an hourly cron in CI. Covered by manual verification + the DB diff.

## Open questions

None.

## Migration ordering

One new migration file named with today's date or later, e.g.
`20260606000001_subscription_manual_logging.sql`. Per the `feedback_cross_branch_migrations`
memory: if a timestamp collision occurs on push, rename **this** migration
to a later timestamp — never rename foreign-branch files.
