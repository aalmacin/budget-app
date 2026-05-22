# Quickstart — Family Budget App

First-run setup and smoke-test path for any developer landing on the `001-family-budget-app` branch.

## 0. Prerequisites

- Node 20+
- A Supabase project (cloud or local Supabase CLI). Populate two env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - (server-only, for migrations / scripts) `SUPABASE_SERVICE_ROLE_KEY` — never read by the Next.js app at runtime; only by migration tooling.

Put these in `.env.local` (gitignored). Do **not** commit secrets; do **not** read `.env` files in app code.

## 1. Install

```bash
npm install
```

This pulls in the additional dependencies introduced by the plan: `@supabase/supabase-js`, `@supabase/ssr`, `@reduxjs/toolkit`, `react-redux`, `zod`, `recharts`, `date-fns`, `@serwist/next`.

> Once installed, **read the relevant guide in `node_modules/next/dist/docs/`** before writing framework code (per `AGENTS.md`). The Next.js version in `package.json` may have breaking changes vs. older training data.

## 2. Run database migrations

From the `supabase/` directory (or via the Supabase CLI):

```bash
npx supabase db push
```

The migrations create every table in `data-model.md`, enable RLS, install policies, seed system-global categories, install `compute_income_split` + `apply_split_rule` + `list_quick_add_options`, and `create extension if not exists pg_cron;` then schedule `materialize_due_subscriptions()` hourly. No tax-related tables (`deduction`, `gst_hst_setaside`) are installed in v1.

## 3. Configure Supabase Auth password policy

In the Supabase dashboard → **Authentication → Providers → Email**:

- **Minimum length**: `8`
- **Password requirements**: enable at least one number, at least one symbol (matches `passwordSchema` in `lib/validators/auth.ts`, which enforces the same on the client).

This applies to admin-set and admin-reset passwords as well as in-app sign-in feedback (FR-001a, spec clarification §4).

## 4. Pre-create two adult accounts in Supabase

In the Supabase dashboard → **Authentication → Users → Invite** (or **Create user**), create two users:

- `alex@example.com`
- `bea@example.com`

Set passwords that match the policy above. **The app has no signup page** (FR-001) — every adult must be admin-provisioned. Kids never get auth accounts.

## 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3023>.

## 6. Smoke-test path (covers US1 → US4 in under 5 minutes)

1. **Sign in** as `alex@example.com`. Because Alex has no `household_member` row yet, the app redirects to `/onboarding/create-household`.
2. **Create the household** — name it "The Almacin household". Submitting calls `rpc('create_household', { name })`, which inserts the `household` row (Alex becomes owner) and Alex's `household_member` row (`role='adult'`) atomically. You land on the empty dashboard.
3. **Family screen** → tap "+ Add" under Adults → enter `bea@example.com`. This calls `rpc('add_adult_by_email', { email })`. Bea is now Alex's second adult.
   - Try entering a non-existing email — you should see the error "No account exists for that email — ask the admin to create one first" with no row inserted.
   - Try entering Bea again — silent success (idempotent, FR-004b).
4. **Family screen** → tap "+ Add" under Kids → add Sam (14), Mia (11), Jo (8), Eli (5). The kid grid wraps cleanly at the 340 px viewport.
5. **Dashboard FAB → Quick Add → "+"** (since Quick Add is empty on a fresh household). The full Add Expense form opens. Log $45.20 in Groceries, for Mia, essential split 80%. The dashboard balance drops by $45.20 and the recent-activity strip shows the entry.
6. In an incognito window, **sign in as Bea**. She has a `household_member` row, so she goes straight to the shared dashboard. The Groceries expense is visible within 5 s (Realtime).
7. **Quick Add tile re-log**: Bea taps the dashboard FAB → Quick Add now shows a "Whole Foods · $45.20" tile (the entry Alex just logged). Tap it. A new $45.20 transaction is created with today's date, the same tags, and is attributed to Mia. Two taps total (FAB, tile) — meets SC-008.
8. **Income**: drawer → Add Income → enter $5,800 **net** for Alex (T4 employment label); $2,485 net for Bea. The income-split rule view in Settings now shows ~70/30 derived ratios. No tax-bucket aside is created — v1 income is entered as net (clarification §6).
9. **By-income split**: edit the original $45.20 expense, set `Split = by income`. Alex owes $31.62 and Bea owes $13.58 — note the shares sum to exactly $45.20 (residual cent goes to Alex, the higher earner; clarification §3).
10. **Soft-delete**: on the Family screen, remove Sam. He disappears from the family grid, "for whom" chips, and the new-transaction selector. Open the per-person report — Sam still appears with his prior $0 spend, because historical attribution is preserved.
11. **Budget**: set Groceries monthly limit to $800. After both Groceries entries, progress reads ~11% (~9% if filtered to Essentials).
12. **Reports → Per-person**: pie shows Mia's slice. Flip "include general expenses" on; the chart recomposes within 500 ms and now includes Alex & Bea income-proportional shares.

If any of those 12 steps fail, you have a regression worth filing before continuing.

## 7. Run the test suite

```bash
npm run test:unit      # Vitest — pure helpers (money, split, tax-dates)
npm run test:e2e       # Playwright — the 8 critical flows enumerated in plan.md
```

The Playwright suite is the constitutional gate for the critical flows.

## 8. PWA install (manual check)

In Chrome, open DevTools → Application → Manifest. You should see the manifest produced by `app/manifest.ts` with the HIFI sage theme color (`#2a3d33`). The "Install" button in the address bar should be enabled.

Turn off network in DevTools → log a new expense → the row appears in the list with a "queued" badge sourced from `store/slices/outbox.ts`. Turn the network back on → the badge clears within a second as the outbox replays through `log_expense` (idempotent via the client-supplied UUID v7).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Sign-in succeeds but lands on `/onboarding/create-household` repeatedly | `create_household` RPC failed silently — check the SQL function exists and RLS allows the insert |
| 401 on every RPC | Session cookies not set — confirm `lib/supabase/middleware.ts` runs on the affected route |
| `42501` from `log_expense` | RLS denial; check that the caller has a non-soft-deleted `household_member` row |
| `add_adult_by_email` returns `no_account` for a known address | The email isn't in `auth.users` — create it in the Supabase dashboard first (FR-004) |
| Dashboards don't update across devices | Realtime subscription not started; check `app/(app)/layout.tsx` |
| Subscription auto-log missed | `pg_cron` not enabled, or the cron job wasn't scheduled in `0004_subscriptions.sql` |
| Currency shows `45.2` instead of `$45.20` | A formatter call slipped through that didn't use `lib/money.ts` |
| Split shares don't sum to the transaction total | A path in the UI used the JS preview without applying the residual rule — the SQL is authoritative; revisit `lib/split.ts` to match `apply_split_rule` |
| Quick Add tile shows a soft-deleted member's name | `list_quick_add_options` is missing the `deleted_at IS NULL` filter on `for_member_id`; rebuild and re-deploy `0005_views_and_functions.sql` |
| Quick Add tile re-log creates a duplicate of a future cron-driven subscription auto-log | Client forgot to leave `occurrence_date = null` on the tile-tap payload (the cron uses `occurrence_date = next_renewal_at`); the unique index `(subscription_id, occurrence_date)` only protects when both rows have a non-null `occurrence_date`. Fix the client payload. |
