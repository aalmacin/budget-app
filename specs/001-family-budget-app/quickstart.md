# Quickstart — Family Budget App

This is the first-run setup and smoke-test path for any developer landing on the `001-family-budget-app` branch.

## 0. Prerequisites

- Node 20+
- A Supabase project (cloud or local Supabase CLI). You will populate two env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - (server-only, for migrations / scripts) `SUPABASE_SERVICE_ROLE_KEY` — never read by the Next.js app at runtime; only by migration tooling.

Put these in `.env.local` (gitignored). Do **not** commit secrets; do **not** read `.env` files in app code.

## 1. Install

```bash
npm install
```

This pulls in the additional dependencies introduced by the plan: `@supabase/supabase-js`, `@supabase/ssr`, `@reduxjs/toolkit`, `react-redux`, `zod`, `recharts`, `date-fns`, `date-fns-tz`, `@serwist/next`.

> Once installed, **read the relevant guide in `node_modules/next/dist/docs/`** before writing framework code (per `AGENTS.md`). The Next.js version in `package.json` may have breaking changes vs. older training data.

## 2. Run database migrations

From the `supabase/` directory (or via the Supabase CLI):

```bash
npx supabase db push
```

The migrations create every table in `data-model.md`, enable RLS, install policies, and seed system-global categories. They also `create extension if not exists pg_cron;` and schedule `materialize_due_subscriptions()` hourly.

## 3. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3023>.

## 4. Smoke-test path (covers US1 → US4 in under 5 minutes)

1. **Sign up** with `alex@example.com` / a password ≥ 8 chars. You land on `/dashboard` for a brand-new empty household.
2. **Family screen** → add an adult member (Bea, no account yet) and 4 kids. The kid grid wraps correctly at the 340 px viewport.
3. **Invite the second adult**: Settings → Invite → enter `bea@example.com`. Copy the printed `/invite/<token>` URL.
4. In an incognito window, **sign up as Bea** with that URL: signup → automatic `accept_invite(token)` → both adults are now in the same household.
5. Back as Alex: **Add → Expense → $45.20 in Groceries, for Mia, essential split 80%**. The dashboard balance drops by $45.20 and the recent-activity strip shows the entry.
6. In Bea's browser: refresh the dashboard. Same transaction is visible within 5 s (Realtime).
7. **Income**: Add → Income → $5,800 T4 employment for Alex; $2,485 T4 for Bea. The income-split rule view in Settings now shows ~70/30 derived ratios.
8. **By-income split**: edit the $45.20 expense, set `Split = by income`. Each adult's owed share is computed inline.
9. **Budget**: Budget screen → set Groceries monthly limit to $800. After the $45.20 entry, progress reads 5.6% (or 4.5% if filtered to Essentials).
10. **Reports → Per-person**: pie shows Mia's slice. Flip "include general expenses" on; the chart recomposes within 500 ms and now includes Alex & Bea income-proportional shares.

If any of those 10 steps fail, you have a regression worth filing before continuing.

## 5. Run the test suite

```bash
npm run test:unit      # Vitest — fast, pure helpers
npm run test:e2e       # Playwright — critical flows only
```

The Playwright suite is the constitutional gate for the critical flows enumerated in `plan.md`.

## 6. PWA install (manual check)

In Chrome, open DevTools → Application → Manifest. You should see the manifest produced by `app/manifest.ts` with the calm-warm-grey theme color. The "Install" button in the address bar should be enabled.

Turn off network in DevTools → log a new expense → the row appears in the list with a "queued" badge sourced from `store/slices/outbox.ts`. Turn the network back on → the badge clears within a second as the outbox replays through `log_expense` (idempotent via client UUID).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 401 on every RPC | Session cookies not set — confirm `lib/supabase/middleware.ts` runs on the affected route |
| `42501` from `log_expense` | RLS denial; check that the caller has a `household_member` row |
| Dashboards don't update across devices | Realtime subscription not started; check `app/(app)/layout.tsx` |
| Subscription auto-log missed | `pg_cron` not enabled, or the cron job wasn't scheduled in migrations |
| Currency shows `45.2` instead of `$45.20` | A formatter call slipped through that didn't use `lib/money.ts` |
