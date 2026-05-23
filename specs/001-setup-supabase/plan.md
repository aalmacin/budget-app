# Implementation Plan: Supabase Foundation for Budget App

**Branch**: `001-setup-supabase` | **Date**: 2026-05-22 | **Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-setup-supabase/spec.md`

## Summary

Add Supabase as the auth and database layer for the Budget app, scoped to the `budget` schema on a shared Postgres instance. Ship: email+password sign-in, server-side session refresh in middleware, an authenticated app shell (header showing email + sign-out), placeholder authenticated home, and `Category`/`Transaction` tables with RLS enforcing per-user isolation. Accounts are created out-of-band by an administrator via the Supabase dashboard; no signup, no MFA, no UI for Category/Transaction CRUD in this feature.

Technical approach: `@supabase/ssr` for browser + server clients; Next.js App Router with a root middleware that refreshes the session and gates protected routes; Server Actions for sign-in/sign-out (auth-provider calls, exempt from the RPC rule per Principle III); migrations under `supabase/migrations/` with schema `budget` and policies built on `auth.uid()`; Playwright as the critical-path test runner for the auth flow.

## Technical Context

**Language/Version**: TypeScript 5 (strict, no `any`)
**Primary Dependencies**: Next.js 16.2.6 (App Router), React 19.2.4, `@supabase/ssr` ~0.10, `@supabase/supabase-js` ~2.x, `supabase` CLI (devDep), `@playwright/test` (devDep)
**Storage**: Supabase Postgres — all app tables, functions, policies live in schema `budget` on a Supabase instance shared with another app (per project memory)
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
├── layout.tsx                       # Existing root layout (CSP nonce + fonts)
├── globals.css                      # Existing
├── page.tsx                         # REPLACED: redirects to /(authed) home or /login
├── login/
│   └── page.tsx                     # NEW: sign-in page (Server Component)
└── (authed)/
    ├── layout.tsx                   # NEW: app shell — header w/ email + sign-out
    └── page.tsx                     # NEW: placeholder authenticated home

actions/
└── auth.ts                          # NEW: signIn, signOut Server Actions

lib/
├── supabase/
│   ├── client.ts                    # NEW: createSupabaseBrowserClient()
│   └── server.ts                    # NEW: createSupabaseServerClient()
└── auth.ts                          # NEW: getCurrentUser() server helper

components/
├── AppHeader.tsx                    # NEW: Server Component — shell header
└── SignOutButton.tsx                # NEW: "use client" — invokes signOut action

middleware.ts                        # NEW: session refresh + auth gate + CSP nonce

supabase/
├── config.toml                      # NEW: local CLI config, schemas = ["budget", "graphql_public"]
├── .gitignore                       # NEW: ignore .temp/, .branches/, secrets
└── migrations/
    ├── 20260522000000_budget_schema.sql        # CREATE SCHEMA budget; grant usage
    ├── 20260522000001_categories.sql           # categories table + RLS
    ├── 20260522000002_transactions.sql         # transactions table + RLS
    └── 20260522000003_rls_test.sql             # SQL-level isolation assertions (run on db reset)

tests/
└── e2e/
    ├── auth.spec.ts                 # NEW: Playwright critical-path auth tests
    └── fixtures.ts                  # NEW: test-user helpers (read creds from env)

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
