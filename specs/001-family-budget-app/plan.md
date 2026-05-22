# Implementation Plan: Family Budget App (Canadian PWA)

**Branch**: `001-family-budget-app` | **Date**: 2026-05-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-family-budget-app/spec.md`

## Summary

A calm, mobile-first PWA budgeting app for Canadian couples and families (2 adults + any number of kids) covering authentication, household sharing, transactions, family-aware tagging (essential/treats + "for whom"), income-proportional cost-splitting, budgets, reports, recurring subscriptions, and Canadian tax tracking (CRA).

Technical approach: Next.js 16 App Router (React Server Components default, Server Actions for mutations) with Supabase (PostgreSQL + RLS + Realtime). All client→backend communication goes through Supabase RPC into PostgreSQL functions per the constitution. Tailwind CSS v4 for styling, Redux Toolkit for genuine client UI state only (drawer, filter chips, offline outbox), Zod for shared client+server validation, Recharts for report visuals, and a Serwist-based service worker for PWA install + offline write queue. Amounts persist as integer cents to avoid float drift; income-proportional split percentages are derived in a database function, never stored.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node 20+ runtime
**Primary Dependencies**: Next.js 16.2.6 (App Router), React 19.2.4, Tailwind CSS 4, `@supabase/supabase-js`, `@supabase/ssr`, `@reduxjs/toolkit` + `react-redux`, `zod`, `recharts`, `date-fns`, `date-fns-tz` (CRA deadlines anchored in `America/Toronto`), `@serwist/next` (PWA / service worker)
**Storage**: Supabase PostgreSQL. All client→backend communication via Supabase RPC into PostgreSQL functions. RLS enabled on every table; policies scope rows to the calling user's household memberships. Realtime channels broadcast household-scoped transaction changes
**Testing**: Playwright for critical flows (auth, log expense, household invite, income-split derivation, report toggle, subscription auto-log, offline write replay); Vitest for unit tests on pure helpers (money math, split math, tax-date math)
**Target Platform**: Mobile-first installable PWA. Primary design target is a 340 px-wide phone viewport. Modern evergreen browsers (Chromium, WebKit, Firefox) and iOS/Android home-screen installs
**Project Type**: Web application (Next.js full-stack with Supabase backend) — Option 2 in the structure section, adapted to a single Next.js app (no separate backend project, since Supabase is the backend)
**Performance Goals**:
- Real-time sync between adults' devices within 5 s of opening the app (SC-003)
- Per-person pie chart "include general expenses" toggle recomposes in under 500 ms on mid-range mobile (SC-006)
- 95% of subscription auto-logs created within 24 h of renewal (SC-007)
- LCP < 2.5 s and TBT < 200 ms on mid-range mobile for dashboard cold load

**Constraints**:
- Mobile-first; zero horizontal scroll at 340 px viewport, 0–8 kids (SC-004)
- CAD only, 2-decimal display; integer-cent storage
- Strict TypeScript, no `any`, no suppressed type errors
- Nonce-based CSP for any inline scripts/styles
- Supabase RLS authoritative; multi-table writes / business rules live in DB functions
- Offline expense entry queued and replayed on reconnect; conflict policy is last-write-wins for v1
- No `.env` content read by tooling; secrets never committed

**Scale/Scope**: Hundreds of households at v1 launch (low thousands of writes/day across the fleet). 38 functional requirements, 9 user stories (P1–P3), ~9 entities. ~13 screens behind the hamburger drawer (dashboard, add, transactions, budget, family, reports {spend-over-time, cashflow, per-person, essentials}, subscriptions, taxes, settings, plus login/signup).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence in this plan |
|-----------|--------|-----------------------|
| **I. Code Quality & Pattern Consistency** | PASS | Strict TS already enabled in `tsconfig.json`; no `any`; single state lib (Redux Toolkit) restricted to genuine client UI state; shared `components/ui/` for primitives; one styling system (Tailwind v4); comments reserved for business rationale. |
| **II. Security-First (NON-NEGOTIABLE)** | PASS | RLS enabled on every table (data-model spells out policies); no service-role key in client bundle (`@supabase/ssr` uses anon key with user session); nonce-based CSP wired in `middleware.ts`; no `.env` reads; no `dangerouslySetInnerHTML`; server actions validate with Zod at the boundary. |
| **III. Backend via DB Functions (NON-NEGOTIABLE)** | PASS | All writes (signup completion, household creation, invite accept, log_expense, log_income, edit/delete txn, set_budget, register_subscription, log_deduction, set_tax_profile) routed through `rpc()` to Postgres functions. Reads that depend on derived state (income-split ratios, subscription auto-log materialization, per-person pie with "include general expenses" toggle) are RPC-backed. Direct table reads only where RLS plus a simple `select` suffices (lists, filters). No ad-hoc REST handlers except `app/api/webhooks/` for inbound (none planned in v1). |
| **IV. Testing Discipline (Critical-Path Playwright)** | PASS | Critical flows enumerated below; secondary flows covered by unit tests. |
| **V. UX Consistency** | PASS | Single App Router; nested layouts (`(auth)` and `(app)` route groups); shared `components/ui/` primitives; the hamburger drawer is one component reused across every authenticated screen; no Pages Router. |
| **VI. Performance via Next.js Best Practices** | PASS | RSC default; `"use client"` only on interactive leaves (drawer toggle, filter chips, split slider, chart with toggle); Server Actions for mutations through RPC; `next/image` and `next/font` already in use; Recharts is the single chart dep (bundle-budgeted, lazy-loaded only on `reports/*` routes); revalidation is on-demand via `revalidateTag('household:<id>')` after mutations. |

**Critical Playwright flows for this feature** (enumerated for the IV gate):

1. Sign up + sign in + sign out (FR-001/002)
2. Owner invites second adult and both adults see shared household state (FR-003/004, US1)
3. Log expense → dashboard balance updates → second adult sees it within 5 s (FR-008/016/017, US2)
4. Tag expense `for whom = kid` and apply essential split slider; reports reflect both portions (FR-008/011, US3)
5. "By income" split on a shared expense derives from current incomes and updates when income changes (FR-012/015, US4)
6. Set monthly category limit, log expenses, verify progress + filter All/Essential/Treats (FR-018/020, US5)
7. Register monthly subscription, advance clock past renewal, verify auto-logged transaction with correct tags (FR-027/028, US9)
8. Offline expense entry queued and replayed on reconnect (edge case + FR-036)

Non-critical flows (reports visuals beyond the toggle, search/filter combinations, deduction list rendering, settings edits) are covered by unit/integration tests, not Playwright.

**No constitution violations to justify** — Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-family-budget-app/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── README.md
│   ├── auth.md
│   ├── household.md
│   ├── transactions.md
│   ├── budgets.md
│   ├── subscriptions.md
│   ├── tax.md
│   └── reports.md
├── checklists/
│   └── requirements.md  # Already produced by /speckit-checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
app/                              # Next.js 16 App Router
├── (auth)/                       # Unauthenticated route group
│   ├── layout.tsx                # Minimal auth shell
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── invite/[token]/page.tsx   # Accept-household-invite link
├── (app)/                        # Authenticated route group
│   ├── layout.tsx                # Hamburger drawer + auth gate
│   ├── dashboard/page.tsx
│   ├── add/page.tsx              # Add transaction (expense or income)
│   ├── transactions/page.tsx     # List, search, filter chips
│   ├── budget/page.tsx
│   ├── family/page.tsx
│   ├── subscriptions/page.tsx
│   ├── taxes/page.tsx
│   ├── reports/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Reports index
│   │   ├── spend-over-time/page.tsx
│   │   ├── cashflow/page.tsx
│   │   ├── per-person/page.tsx
│   │   └── essentials/page.tsx
│   └── settings/page.tsx
├── api/                          # Reserved for non-DB-expressible only (none in v1)
├── manifest.ts                   # PWA manifest
├── sw.ts                         # Serwist service worker entry
├── globals.css
├── layout.tsx                    # Root layout (html/body, fonts, CSP nonce)
└── page.tsx                      # Redirect → /dashboard or /login

components/
├── ui/                           # Shared primitives (buttons, inputs, modals, toasts, empty/loading/error states, slider, chip, drawer)
├── layout/                       # AppDrawer, AppHeader
├── transactions/                 # AddForm, TxnRow, FilterChips, SplitSlider
├── reports/                      # Charts (lazy-loaded), KPIBox, ToggleableLegend
└── family/                       # MemberCard, KidGrid

lib/
├── supabase/
│   ├── server.ts                 # createServerClient (SSR)
│   ├── client.ts                 # createBrowserClient
│   └── middleware.ts             # token refresh + CSP nonce
├── money.ts                      # cents↔dollars, CAD formatting
├── split.ts                      # pure income-proportional helpers (mirrors DB fn for UI preview)
├── canadian-tax/                 # static deadlines, deduction categories, provincial rates
├── validators/                   # Zod schemas shared client+server
└── pwa/                          # Offline outbox (IndexedDB) + replay

store/                            # Redux Toolkit — UI state only
├── index.ts
└── slices/
    ├── drawer.ts
    ├── filters.ts                # Transactions filters
    └── outbox.ts                 # Offline write queue mirror for UI

supabase/                         # Schema + RLS + functions (managed by user)
├── migrations/
│   ├── 0001_init.sql
│   ├── 0002_household.sql
│   ├── 0003_transactions.sql
│   ├── 0004_budgets.sql
│   ├── 0005_subscriptions.sql
│   └── 0006_tax.sql
├── policies/                     # RLS policy SQL per table
└── functions/                    # SQL function bodies (one file per RPC)

tests/
├── e2e/                          # Playwright (critical flows only — see Constitution Check)
│   ├── auth.spec.ts
│   ├── household-invite.spec.ts
│   ├── log-expense.spec.ts
│   ├── for-whom-and-split.spec.ts
│   ├── income-split.spec.ts
│   ├── budget.spec.ts
│   ├── subscription-auto-log.spec.ts
│   └── offline-replay.spec.ts
└── unit/                         # Vitest
    ├── money.test.ts
    ├── split.test.ts
    └── tax-dates.test.ts
```

**Structure Decision**: Single Next.js application (App Router) backed by Supabase. The "backend" project from the template is not a separate Node service — it is Supabase (managed Postgres + Auth + Realtime + Storage), with all server-side business logic living in SQL functions under `supabase/functions/`. The Next.js app is the only runtime we deploy; client and server pieces share the same TypeScript codebase.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

_None._ The plan introduces no patterns that overlap existing sanctioned ones: one framework (Next.js App Router), one styling system (Tailwind v4), one state lib (Redux Toolkit, scoped to UI state), one chart lib (Recharts, lazy-loaded), one PWA toolkit (Serwist), one backend (Supabase). Every cross-cutting decision is recorded in `research.md` with rationale.
