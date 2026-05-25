# Implementation Plan: Supabase Foundation for Budget App

**Branch**: `001-setup-supabase` | **Date**: 2026-05-22 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-setup-supabase/spec.md`

## Summary

Add Supabase as the auth and database layer for the Budget app, scoped to the `budget` schema on a **local Supabase stack** (see research.md § R9). Ship: email+password sign-in, server-side session refresh in middleware, an authenticated app shell (header showing email + sign-out), placeholder authenticated home, and `Category`/`Transaction` tables with RLS enforcing per-user isolation. Accounts are created out-of-band in Supabase Studio (locally; in Studio dashboard for the future cloud project); no signup, no MFA, no UI for Category/Transaction CRUD in this feature. Cloud deployment to a dedicated paid Supabase project is a later feature.

**Phase 7 addendum (2026-05-24)**: Scope expanded to restore the household-based model carried over from the reference project. Adds `budget.household`, `budget.household_member`, `budget.subscription`; drops + recreates `budget.category` and `budget.transaction` as household-scoped (no production data exists); implements ~25 SECURITY DEFINER RPCs (owned by a new non-superuser role `budget_function_owner`) covering onboarding, family CRUD, transactions, subscriptions, budgets, dashboard, and reports; re-introduces `pg_cron` in the `extensions` schema for hourly subscription materialization. See spec.md US4–US8, FR-021–FR-035; data-model.md "Phase 7 entities"; research.md R12–R16; tasks.md Phase 7.

Technical approach: `@supabase/ssr` for browser + server clients; Next.js App Router with a root middleware that refreshes the session and gates protected routes; Server Actions for sign-in/sign-out (auth-provider calls, exempt from the RPC rule per Principle III); migrations under `supabase/migrations/` with schema `budget` and policies built on `auth.uid()`; Playwright as the critical-path test runner for the auth flow.

## Technical Context

**Language/Version**: TypeScript 5 (strict, no `any`)
**Primary Dependencies**: Next.js 16.2.6 (App Router), React 19.2.4, `@supabase/ssr` ~0.10, `@supabase/supabase-js` ~2.x, `supabase` CLI (devDep), `@playwright/test` (devDep)
**Storage**: Supabase Postgres — all app tables, functions, policies live in schema `budget`. Local Supabase only for now (see research.md § R9); cloud deployment to a dedicated paid Supabase project is a later feature.
**Testing**: Playwright for the critical auth flow (US1, US3 acceptance scenarios); SQL-level assertions in a migration test file for RLS isolation (US2)
**Target Platform**: Web (Node 20+ runtime), modern browsers
**Project Type**: Web app — single Next.js project (no separate frontend/backend split)
**Performance Goals**: SC-001 sign-in→main under 5 s on broadband
**Constraints**: Nonce-based CSP for inline scripts/styles (Principle II); no secrets/credentials in repo; no hardcoded user UUIDs in migrations (FR-012a); all tables/functions in `budget` schema (FR-013)
**Scale/Scope**: Single-digit admin-provisioned users initially; two tables (Category, Transaction) added in this feature

## Constitution Check

*GATE 1 — pre-research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| **I. Code Quality & Pattern Consistency** | PASS | TS `strict: true` already on. No new state-management library introduced (no client state yet, so no Redux Toolkit needed in this feature — first stateful UI will add it). Shared UI primitives placed under `components/`. |
| **II. Security-First (NON-NEGOTIABLE)** | PASS | Every new table (`budget.categories`, `budget.transactions`) ships with RLS enabled and explicit owner policies. Nonce-based CSP added to root middleware. `.env*` ignored (already in `.gitignore`). No service-role keys client-side. |
| **III. Backend via DB Functions (NON-NEGOTIABLE)** | PASS (with documented exception) | The only client→backend interactions in this feature are Supabase Auth calls (sign-in/sign-out/get-user). These go to GoTrue, not the Postgres API surface, and "cannot be expressed in the database" — the canonical Principle III exception. Categories and Transactions have **no UI / no client read or write** in this feature, so no RPC functions are required yet. The first feature that exposes Category or Transaction CRUD must introduce Postgres functions and `supabase.rpc()` calls per Principle III. Recorded in research.md. |
| **IV. Testing Discipline (Critical-Path Playwright)** | PASS | Auth is explicitly listed in the constitution as a critical flow. Playwright is installed by this feature with a critical-path suite covering: redirect-when-anonymous, valid sign-in, invalid sign-in, session persistence across reload, and sign-out invalidates session. US2 isolation is enforced and tested at the DB layer (SQL test) because no UI exposes Category/Transaction yet; when CRUD UIs land in a later feature they will get their own Playwright coverage including a cross-user test. |
| **V. UX Consistency** | PASS | App Router only (the project already is App-Router). One root `app/layout.tsx`; the authenticated app shell goes in a route group `app/(authed)/layout.tsx` so the shell wraps every protected page automatically. Reusable primitives (`<AppHeader />`, `<SignOutButton />`) live under `components/`. No second router, no UI primitive duplication. |
| **VI. Performance via Next.js Best Practices** | PASS | Login page is a Server Component using a Server Action (`signIn`) for the form. App shell is a Server Component; only the sign-out button is `"use client"` (form action + small interaction). Middleware runs on the Edge runtime as Next.js defaults. `next/image` and `next/font` already in use. CSP nonce wired through middleware → layout meta (no inline scripts that bypass it). |

**No principle is violated.** Complexity Tracking table at the bottom of this file remains empty.

### Gate 2 — post-design re-check (after research.md, data-model.md, contracts/, quickstart.md)

Re-evaluated each principle against the design artifacts; no new patterns or surfaces emerged that would change the original assessment:

- I. Strict types preserved in every contract signature; no `any` introduced.
- II. RLS + explicit policies + cross-user trigger documented in `data-model.md`; CSP middleware path locked down in `research.md` R4.
- III. `contracts/server-actions.md` confirms zero new client → Postgres business calls; only auth provider Server Actions ship.
- IV. `quickstart.md` documents `npm run test:e2e`; SQL-level RLS test migration handles US2; future CRUD will inherit the Playwright pattern.
- V. Project structure section above keeps App Router only; the authenticated app shell lives in route group `app/(authed)/layout.tsx`.
- VI. Server Components by default in the design; only `<SignOutButton />` is `"use client"`.

Gate 2 result: **PASS**. Complexity Tracking remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-setup-supabase/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions resolving "how" questions
├── data-model.md        # Phase 1 — Category, Transaction, User entities + RLS
├── quickstart.md        # Phase 1 — minimal path from fresh clone to signed-in
├── contracts/
│   └── server-actions.md  # Phase 1 — signIn/signOut server-action contracts
└── tasks.md             # Phase 2 — produced by /speckit-tasks (not this command)
```

### Source Code (repository root)

```text
app/
├── layout.tsx                       # UPDATED: root layout applies CSP nonce + Geist fonts
├── globals.css                      # Existing
├── login/
│   └── page.tsx                     # NEW: sign-in page (Server Component)
└── (authed)/
    ├── layout.tsx                   # NEW: app shell — header w/ email + sign-out
    ├── error.tsx                    # NEW: route-level error boundary (Principle V)
    ├── loading.tsx                  # NEW: route-level loading skeleton (Principle V)
    └── page.tsx                     # NEW: authenticated home page (greets the user)

# Note: the starter `app/page.tsx` is DELETED. The route group `(authed)`
# serves `/` via `app/(authed)/page.tsx`; the middleware + the layout guard
# handle authentication before that page renders.

actions/
└── auth.ts                          # NEW: signIn, signOut Server Actions

lib/
├── supabase/
│   ├── client.ts                    # NEW: createSupabaseBrowserClient()
│   └── server.ts                    # NEW: createSupabaseServerClient()
└── auth.ts                          # NEW: getCurrentUser() server helper

components/
├── AppHeader.tsx                    # NEW: Server Component — shell header
├── SignOutButton.tsx                # NEW: "use client" — wraps Button
└── ui/
    ├── Button.tsx                   # NEW: shared primitive (primary/secondary variants)
    └── TextInput.tsx                # NEW: shared primitive (labeled input)

proxy.ts                             # NEW: Next.js 16 proxy (formerly "middleware") — session refresh + auth gate + CSP nonce

supabase/
├── config.toml                      # NEW: local CLI config, schemas = ["budget", "graphql_public"]
├── .gitignore                       # NEW: ignore .temp/, .branches/, secrets
└── migrations/
    ├── 20260522000000_budget_schema.sql        # CREATE SCHEMA budget; grant usage
    ├── 20260522000001_categories.sql           # categories table + RLS  (Phase 4; dropped in Phase 7 T058)
    ├── 20260522000002_transactions.sql         # transactions table + RLS (Phase 4; dropped in Phase 7 T058)
    ├── 20260522000003_rls_test.sql             # SQL-level isolation assertions (run on db reset)
    ├── 20260522000004_drop_legacy_public.sql   # T044 — drops legacy public.* artifacts
    ├── 20260522000005_lockdown_budget_grants.sql  # T045 — revoke direct grants on budget.*
    ├── 20260522000006_rls_post_lockdown_test.sql  # T046 — verify lockdown
    │
    │   # Phase 7 (household model + full app restoration; T055–T093)
    ├── 20260524000000_household_foundation.sql      # update_timestamp(), budget_function_owner role
    ├── 20260524000001_household.sql                 # budget.household + RLS (no policy yet)
    ├── 20260524000002_household_member.sql          # budget.household_member + adult cap triggers (no policy yet)
    ├── 20260524000003_drop_user_owned_budget.sql    # drops the Phase 4 budget.categories + budget.transactions
    ├── 20260524000004_helper_and_policies.sql       # auth_user_household_ids() helper + household/household_member policies — MUST precede any policy that references the helper (renumbered from …000005 per T060)
    ├── 20260524000005_category.sql                  # household-scoped budget.category + system seeds (renumbered from …000004; depends on helper above)
    ├── 20260524000006_transaction.sql               # household-scoped budget.transaction (full schema)
    ├── 20260524000007_subscription.sql              # budget.subscription
    ├── 20260524000008_lockdown_household_grants.sql # revoke direct; grant to budget_function_owner
    ├── 20260524000009_rpc_household.sql             # create_household
    ├── 20260524000010_rpc_family.sql                # add_adult_by_email, add_kid, soft_delete_member, update_member_income, list_household_members, get_current_household, list_kid_month_summary
    ├── 20260524000011_rpc_transactions.sql          # list_transactions, log_expense, log_income, update_transaction, delete_transaction, list_quick_add_options, get_dashboard_summary
    ├── 20260524000012_rpc_category_budget.sql       # set_category_essential_pct, set_category_budget, get_budget_progress, compute_income_split, list_categories
    ├── 20260524000013_rpc_subscriptions.sql         # register_subscription, pause_subscription, resume_subscription, list_subscriptions, list_overlapping_subscriptions, materialize_due_subscriptions
    ├── 20260524000014_cron_subscriptions.sql        # pg_cron in extensions schema + hourly schedule
    ├── 20260524000015_rpc_reports.sql               # cashflow_kpis, essentials_breakdown, spend_over_time, per_person_breakdown
    ├── 20260524000016_helper_security_definer_fix.sql  # flips auth_user_household_ids() to SECURITY DEFINER to break the policy/helper recursion cycle (latent bug surfaced during T097 authoring)
    ├── 20260524000017_auth_user_helpers.sql         # T055a — postgres-owned helpers for auth.users reads (current_user_display_name, resolve_user_by_email)
    └── 20260524000018_household_rls_test.sql        # T097 — SQL-level lockdown + cross-household isolation + create_household happy path (renumbered from …000016)

tests/
└── e2e/
    ├── anonymous/
    │   └── auth.spec.ts             # NEW: anonymous-storage critical-path auth tests
    ├── authed/
    │   ├── already-signed-in.spec.ts  # NEW: revisit /login while signed in
    │   └── sign-out.spec.ts         # NEW: US3 acceptance + multi-tab edge case
    ├── fixtures.ts                  # NEW: test-user helpers (read creds from env)
    └── global-setup.ts              # NEW: pre-signs-in User A and writes storage state

playwright.config.ts                 # NEW

# Configuration changes
.env.local.example                   # NEW: documents required env vars (no secrets)
next.config.ts                       # UPDATED: CSP nonce header policy if needed
package.json                         # UPDATED: add dependencies + test scripts
```

**Structure Decision**: single Next.js project (no separate `frontend/`/`backend/`). Choice rationale: this is a Next.js App Router app with Supabase as both auth and database; server logic lives in Server Components, Server Actions, and Postgres — there is no separate backend service. The directory layout mirrors the reference project at `~/Projects/daily-learning-worktree/fix-account-access/` so future contributors familiar with that codebase can navigate immediately.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _(none)_  |            |                                      |
