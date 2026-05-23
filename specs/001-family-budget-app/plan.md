# Implementation Plan: Family Budget App (Canadian PWA)

**Branch**: `001-family-budget-app` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-family-budget-app/spec.md`
**Visual reference**: High-fidelity designs in `specs/001-family-budget-app/design/project/` — primary entry `Budget Hi-Fi Screens.html`, screen components in `hifi-screens.jsx`, `hifi-screens-2.jsx`, design tokens in `hifi-shared.jsx`.

## Summary

A mobile-first Progressive Web App for Canadian couples and families to track shared household money — expenses, income, budgets, subscriptions, and reports. Differentiator: family-aware tagging (for-whom + essential/treats split) plus income-proportional cost-sharing between two adults derived live from logged incomes. A FAB-launched **Quick Add** screen makes one-tap re-logging of frequent transactions the default entry path. Income amounts are entered as net (post-tax); v1 ships **no** Canadian tax tracking surface (CRA instalments, deductions, GST/HST, marginal-rate display, province profile are all out per spec clarification §6).

Technical approach: Next.js 16 App Router (Server Components default; Server Actions for mutations) on top of Supabase (Postgres + RLS + Auth + Realtime + pg_cron). Client-to-backend traffic is exclusively `supabase.rpc(<fn>)` into Postgres functions per Constitution III. Authentication is admin-provisioned per spec clarifications (no signup screen in v1). Money is stored as `bigint` cents; the visual language follows the hi-fi designs (Geist + Geist Mono, sage `#2a3d33` + warm sand `#f4f0e6` palette, rounded card surfaces).

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode; `any` and type-assertion escape hatches forbidden per Constitution I).
**Primary Dependencies**: Next.js 16.2.6 (App Router), React 19.2.4, `@supabase/supabase-js` + `@supabase/ssr`, `@reduxjs/toolkit` + `react-redux` (UI state only), `zod` (shared client+server validation), `recharts` (dynamic-imported per report route), `date-fns` (general date math), `@serwist/next` (service worker tooling), Tailwind v4 (already installed). `date-fns-tz` and the `lib/canadian-tax/` module are no longer required (US8 removed).
**Storage**: Supabase Postgres. RLS enabled on every table; one policy per table keyed on `household_member.user_id = auth.uid()`. Money columns are `bigint` cents. `pgcrypto`, `citext`, `pg_cron` extensions used.
**Testing**: Playwright (critical flows per Constitution IV; enumerated below). Vitest for pure helpers (`lib/money.ts`, `lib/split.ts`, `lib/canadian-tax/dates.ts`). `tsc --noEmit` as the type-check gate.
**Target Platform**: Modern evergreen browsers (Chrome, Safari, Firefox), installable as a mobile PWA. Primary viewport target 340–414 px wide (per spec SC-004 and hi-fi designs which use iPhone 402 px / Android 412 px frames).
**Project Type**: Web application — single Next.js app at the repository root (`app/`, `components/`, `lib/`, `store/`, `supabase/`, `tests/`). No separate frontend/backend split because Supabase is the backend and Server Actions live inside the same Next.js process.
**Performance Goals**: Dashboard updates ≤5 s across devices via Realtime (SC-003). Per-person pie recompose ≤500 ms on a mid-range mobile device (SC-006). Subscription auto-log within 24 h of renewal via hourly `pg_cron` (SC-007). Bundle: charts excluded from the cold-load dashboard bundle via `next/dynamic({ ssr: false })`.
**Constraints**: Zero horizontal scroll at 340 px viewport with 0–8 kids (SC-004). CAD-only with two decimal places, always (FR-037). Offline expense entry queues to IndexedDB outbox keyed by client UUID and replays through the same RPCs on reconnect (PWA expectation). Nonce-based CSP (no `unsafe-inline`) per Constitution II.
**Scale/Scope**: Single household tenant per session; tens of thousands of transactions per household upper bound; ten screens; eight critical flows; nine user stories (US1+US2 = MVP).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|---|---|---|
| **I. Code Quality & Pattern Consistency** | ✅ | Strict TS, ESLint bans `any` + `@ts-ignore`. Single state library (Redux Toolkit), single HTTP/data-access surface (`supabase-js` only), single styling system (Tailwind v4 + design tokens from `hifi-shared.jsx`). Shared UI primitives live in `components/ui/`. |
| **II. Security-First (NON-NEGOTIABLE)** | ✅ | RLS enabled on every table created across all migrations. Nonce-based CSP generated in `lib/supabase/middleware.ts` and applied in root layout. Server-only `SUPABASE_SERVICE_ROLE_KEY` is never read by app code (migrations tooling only). No `.env` reads. Supabase Auth password policy mirrors FR-001a (≥8 chars + 1 digit + 1 symbol). No signup form exposed (FR-001). |
| **III. Backend via DB Functions (NON-NEGOTIABLE)** | ✅ | Every write and every authorization-sensitive read goes through a Postgres function invoked via `supabase.rpc(<name>)`. List/read paths use `transaction_view`, `deduction_view`, etc., behind RPCs that wrap RLS. No bespoke REST handlers. |
| **IV. Testing Discipline (Critical-Path Playwright)** | ✅ | Critical flows enumerated below; each ships with a Playwright spec. Non-critical helpers covered by Vitest. |
| **V. UX Consistency** | ✅ | App Router only. Two route groups: `(auth)` for login + create-household (minimal shell), `(app)` for authenticated screens (drawer + realtime). Shared layouts. Shared components from `components/ui/`. Visual language derived from `specs/001-family-budget-app/design/project/hifi-shared.jsx` (HIFI palette + Geist fonts) — these become the design tokens applied via Tailwind config. |
| **VI. Performance via Next.js Best Practices** | ✅ | Server Components default. Server Actions for mutations. Recharts loaded via `next/dynamic({ ssr: false })` only on `/reports/*`. `next/font` for Geist + Geist Mono. `next/image` for any raster assets. Static rendering where data-freshness permits; `revalidateTag('household:<id>')` after mutations and on Realtime events. |

**Critical flows for Playwright coverage** (Constitution IV):

1. Sign in with admin-provisioned credentials → routed to "Create your household" on first sign-in → empty dashboard.
2. Sign in by an already-membered user → directly to dashboard.
3. Log an expense via the full Add form → balance decrements → second adult's device sees it within 5 s.
4. **Quick Add re-log**: open Quick Add from FAB → tap a recent-merchant tile → new transaction created with copied tags and today's date in ≤2 taps.
5. Add a second adult by email (success + "no account" error + idempotent re-add + 2-adult cap rejection).
6. Soft-delete a member → hidden from selectors/family/chips → historical transactions still attribute to them.
7. Apply `by income` split on a shared expense → residual cent allocated to the higher-earning adult; shares sum exactly.
8. Subscription auto-log: register a sub, run `materialize_due_subscriptions()`, transaction appears with correct tags; re-run is idempotent.
9. Offline replay: turn network off → log expense → "queued" badge → reconnect → badge clears, row persists.

**Result**: No violations to record in Complexity Tracking.

### Post-design re-check (after Phase 1 artifacts)

Re-evaluated after writing `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`, after the scope-reduction clarifications (US8 removed, kid allowance dropped, Quick Add added, income switched to net), and after the design v2 alignment (friendlier income labels, Subs dual-action, no per-kid budget for v1):

- **I (Code Quality)**: surface shrank — `lib/canadian-tax/`, `lib/validators/tax.ts`, `contracts/tax.md`, the `gst_hst_setaside` ledger, the `deduction` table, and one Playwright spec are all gone. No new patterns introduced by Quick Add: it reuses `log_expense` RPC and existing tiles styling.
- **II (Security)**: every remaining table in `data-model.md` carries an RLS policy. `list_quick_add_options` is `security invoker` and returns nothing outside the caller's household. Password policy and nonce-CSP unchanged.
- **III (DB Functions)**: Quick Add adds one new RPC (`list_quick_add_options`); the tile-tap write path still goes through `log_expense`. No bespoke REST handlers.
- **IV (Testing)**: 9 critical flows now (Quick Add tile re-log added; tax-related GST/HST set-aside spec dropped — there was none in the v0 list anyway). 1:1 mapping to `tests/e2e/`.
- **V (UX Consistency)**: drawer loses the "Taxes" entry. FAB target changes from `/add` to `/quick-add`. Shared primitives unchanged; `QuickAddTile` is built on the existing `MerchantIcon` + `ChipsRow` primitives.
- **VI (Performance)**: smaller bundle (`date-fns-tz` and `canadian-tax/` dropped). Quick Add tile-tap is one RPC round-trip; no chart load.

No new violations. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-family-budget-app/
├── plan.md              # This file
├── spec.md              # Feature specification (with 5 clarifications)
├── research.md          # Phase 0 — decisions + rationale
├── data-model.md        # Phase 1 — tables, RLS, triggers
├── quickstart.md        # Phase 1 — first-run smoke test
├── contracts/           # Phase 1 — RPC contracts (one .md per domain)
├── checklists/          # speckit-checklist outputs
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
app/
├── (auth)/                              # Minimal shell, no drawer
│   ├── layout.tsx
│   ├── login/page.tsx                   # Email/password sign-in (no signup)
│   └── onboarding/
│       └── create-household/page.tsx    # First-sign-in household creation (FR-003)
├── (app)/                               # Authenticated, drawer + realtime
│   ├── layout.tsx                       # Mounts AppDrawer + useHouseholdRealtime
│   ├── dashboard/page.tsx
│   ├── quick-add/page.tsx               # FR-011a — FAB lands here first
│   ├── add/page.tsx                     # Full Add Expense (reached from Quick Add "+")
│   ├── add-income/page.tsx              # Net income only (drawer item)
│   ├── transactions/page.tsx
│   ├── budget/page.tsx
│   ├── family/page.tsx                  # Add/remove members, edit incomes
│   ├── reports/
│   │   ├── layout.tsx                   # Tab strip across the 4 reports
│   │   ├── spend-over-time/page.tsx
│   │   ├── cashflow/page.tsx
│   │   ├── per-person/page.tsx
│   │   └── essentials/page.tsx
│   ├── subscriptions/page.tsx
│   └── settings/page.tsx
├── layout.tsx                           # Root: next/font, CSP nonce, theme color
├── manifest.ts                          # PWA manifest
├── sw.ts                                # Serwist service worker entry
└── page.tsx                             # Redirect: signed-in → /dashboard; else → /login

components/
├── ui/                                  # Shared primitives (Constitution V)
│   ├── Button.tsx, IconButton.tsx, MenuButton.tsx
│   ├── Input.tsx, NumberInput.tsx, AmountHero.tsx
│   ├── Chip.tsx, ChipsRow.tsx, SegControl.tsx
│   ├── Sheet.tsx, Modal.tsx, Toast.tsx
│   ├── EmptyState.tsx, ErrorState.tsx, Skeleton.tsx
│   ├── FamilyAvatar.tsx, MerchantIcon.tsx
│   ├── Bar.tsx, SplitBar.tsx, Donut.tsx
│   └── PageTitle.tsx, AppBar.tsx, FAB.tsx
├── layout/
│   └── AppDrawer.tsx
├── transactions/
│   ├── ActivityRow.tsx, TxnRow.tsx
│   ├── ForWhomChips.tsx, SplitSlider.tsx, PaidBySplitCard.tsx
│   ├── FilterChips.tsx, EditTxnSheet.tsx
├── family/
│   ├── MemberCard.tsx, KidGrid.tsx, AddAdultByEmail.tsx, AddKidForm.tsx
├── budget/
│   └── CategoryRow.tsx
├── quick-add/
│   ├── QuickAddTile.tsx, RecentTilesGrid.tsx, SubscriptionTilesList.tsx
├── reports/
│   └── charts.tsx                        # dynamic Recharts wrappers
└── tokens.ts                            # Re-exports HIFI palette as TS constants

lib/
├── supabase/
│   ├── server.ts                        # Cookie-aware server client
│   ├── client.ts                        # Browser client
│   ├── middleware.ts                    # Session refresh + CSP nonce
│   └── realtime.ts                      # useHouseholdRealtime hook
├── validators/                          # Zod schemas mirrored client+server
│   ├── index.ts                         # Base primitives
│   ├── auth.ts                          # Sign-in only (no signup)
│   ├── household.ts                     # Create household, add adult by email, add kid
│   ├── transaction.ts
│   ├── subscription.ts
│   └── budget.ts
├── pwa/
│   └── outbox.ts                        # IndexedDB outbox + replay
├── money.ts                             # cents ↔ dollars, formatCAD
├── split.ts                             # Pure mirror of compute_income_split for UI
└── formatters/                          # date, percent

store/                                   # Redux Toolkit — UI state only
├── index.ts
└── slices/
    ├── drawer.ts
    ├── filters.ts
    └── outbox.ts

supabase/
├── config.toml
├── migrations/
│   ├── 0001_init.sql                    # Extensions, helpers, update_timestamp trigger
│   ├── 0002_household.sql               # household, household_member (+ deleted_at)
│   ├── 0003_transactions.sql            # category (seed), transaction, indexes
│   ├── 0004_subscriptions.sql           # subscription + idempotent unique index + pg_cron
│   └── 0005_views_and_functions.sql     # All RPC functions (incl. list_quick_add_options)
├── policies/                            # RLS policy SQL grouped by table
└── functions/                           # One .sql per RPC for readability

tests/
├── e2e/                                 # Playwright — 9 critical flows
│   ├── signin-onboarding.spec.ts
│   ├── signin-existing-member.spec.ts
│   ├── log-expense-realtime.spec.ts
│   ├── quick-add-tile-relog.spec.ts
│   ├── add-adult-by-email.spec.ts
│   ├── soft-delete-member.spec.ts
│   ├── by-income-split-residual.spec.ts
│   ├── subscription-auto-log.spec.ts
│   └── offline-replay.spec.ts
└── unit/                                # Vitest
    ├── money.test.ts
    └── split.test.ts

proxy.ts                                 # Repo-root Next.js proxy (formerly `middleware.ts`; renamed in Next.js 16) → lib/supabase/middleware
playwright.config.ts
vitest.config.ts
```

**Structure Decision**: Single Next.js application at the repository root. Server Actions inside the same process call Supabase RPCs; there is no separate backend tier. Visual styling consumes the HIFI design tokens lifted from `specs/001-family-budget-app/design/project/hifi-shared.jsx` into `components/tokens.ts` and the Tailwind theme — the design folder remains a read-only visual reference, not imported at runtime.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
