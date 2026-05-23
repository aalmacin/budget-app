# Phase 0 Research: Supabase Foundation for Budget App

**Feature**: 001-setup-supabase
**Date**: 2026-05-22

This document captures the "how" decisions for the items the spec deliberately left implementation-free. There are no remaining `NEEDS CLARIFICATION` markers — every item below has a chosen approach, the reasoning, and the alternatives that were rejected.

---

## R1. Auth + DB client integration with Next.js App Router

**Decision**: Use `@supabase/ssr` (browser client + server client + middleware helper) with `@supabase/supabase-js` as the underlying SDK. Mirror the reference project's three-file split:

- `lib/supabase/client.ts` exports `createSupabaseBrowserClient()` (used in `"use client"` modules only)
- `lib/supabase/server.ts` exports an `async createSupabaseServerClient()` that reads cookies from `next/headers` (used in Server Components, Server Actions, and Route Handlers)
- `proxy.ts` constructs its own server client per request, bound to `NextRequest.cookies` so it can refresh the session before downstream handlers see it

**Rationale**: `@supabase/ssr` exists precisely to handle the cookie-store wiring across Next.js's three rendering contexts (client, RSC, middleware). The reference project at `~/Projects/daily-learning-worktree/fix-account-access/` already operates this pattern successfully against a current Next.js. Using one library across all surfaces avoids cookie drift between contexts.

**Alternatives considered**:

- Hand-roll cookie handling with `@supabase/supabase-js` directly — rejected: re-implements a moving target (Next.js cookie API has changed multiple times) and the reference project explicitly moved off this pattern.
- Use the legacy `@supabase/auth-helpers-nextjs` package — rejected: deprecated in favor of `@supabase/ssr`.

**Notes for implementers**: per `AGENTS.md`, this Next.js version may differ from training data. Before writing middleware or `cookies()` calls, consult `node_modules/next/dist/docs/` (after `npm install`) for the current cookie-store and middleware APIs in 16.2.x. In particular, `cookies()` in 16.x is async and must be awaited.

---

## R2. Exposing the `budget` schema to the application

**Decision**:

1. Migrations start with `CREATE SCHEMA IF NOT EXISTS budget;` (idempotent guard) and grant `USAGE` to `authenticated` and `anon`.
2. Local `supabase/config.toml`'s `[api]` section sets `schemas = ["budget", "graphql_public"]` and `extra_search_path = ["budget", "public", "extensions"]`.
3. The browser/server Supabase clients are constructed with `db: { schema: 'budget' }` so `supabase.from('categories')` resolves to `budget.categories` without per-call schema prefixes.

**Rationale**: Even though the Budget app currently runs only against a local Supabase stack (see R9), keeping the dedicated `budget` schema convention now means the same migrations and clients will Just Work when the app moves to its dedicated cloud Supabase project later, without rewrites. PostgREST only exposes schemas listed in `[api].schemas`, so the `budget` schema needs explicit inclusion. Setting the client default schema keeps call sites clean and avoids accidental writes to `public`.

**Alternatives considered**:

- Put all tables in `public` schema — rejected: violates FR-013 and forfeits the per-app namespace, making future co-tenancy harder.
- Keep `public` in the `[api].schemas` array — rejected: would expose unrelated tables if the local stack accumulates them.

**Constitution interaction**: When the first feature exposes a Category or Transaction RPC (Principle III), that function will be defined as `budget.<fn_name>` and called via `supabase.rpc('fn_name')` — with the default schema set to `budget`, no prefix is needed.

---

## R3. Authentication gating: middleware vs. per-page

**Decision**: A single `proxy.ts` at the repo root does two things on every request:

1. **Session refresh**: calls `supabase.auth.getUser()` to surface the current user and write any refreshed session cookies into the response (this is the canonical `@supabase/ssr` pattern — removing it silently breaks SSR auth).
2. **Auth gate**: if there is no user **and** the path is not in the public allow-list (`/login`, static assets), redirect to `/login`.

The `app/(authed)/layout.tsx` route group then performs a second `getCurrentUser()` so the layout has a typed user object to render in the app shell. This is a redundant call, but it gives the layout a typed `user` without parsing headers/cookies inside the layout itself.

**Rationale**: Matches the reference project. Centralizing the gate in middleware means future routes are protected by default; opting a route out (e.g., a future `/forgot-password` page) becomes an additive change to the allow-list rather than a missing-guard bug.

**Alternatives considered**:

- Gate inside every protected `layout.tsx` / `page.tsx` — rejected: easy to forget on new routes; produces inconsistent unauthorized responses across the app.
- Gate only in middleware, skip the layout call, and pass the user via headers — rejected: passing structured data through headers is fragile and bypasses TypeScript's help.

---

## R4. Nonce-based CSP (constitutional requirement, new vs. reference)

**Decision**: Generate a per-request nonce in `proxy.ts` using the Web Crypto API (`crypto.randomUUID()`), attach it as a request header so Server Components can read it via `headers()`, and emit a `Content-Security-Policy` response header that whitelists that nonce for `script-src` and `style-src`. Root `app/layout.tsx` reads the nonce and applies it to any inline `<script>` or `<style>` the framework can't otherwise nonce.

**Rationale**: Constitution Principle II requires nonce-based CSP for inline scripts/styles. The reference project does not implement this — it's a new constitutional requirement this feature pays the upfront cost for so later features inherit it. Next.js 16's recommended pattern is exactly this: middleware-generated nonce, propagated via headers, applied by the framework.

**Alternatives considered**:

- Static `'unsafe-inline'` CSP — rejected: explicit constitution violation.
- Skip CSP entirely until needed — rejected: deferring security baseline foundations is exactly the regression Principle II is meant to prevent.

**Open implementation detail (resolved during build, not blocking)**: Next.js 16's exact API for injecting a nonce into framework-emitted inline scripts may be `unstable_*` or a setting under `experimental` in `next.config.ts`. The implementer must consult `node_modules/next/dist/docs/` (per `AGENTS.md`) before wiring this and document the version-specific API used.

**Resolved during implementation — `style-src 'unsafe-inline'` fallback**: The shipped `proxy.ts` emits `style-src 'self' 'nonce-<n>' 'unsafe-inline'`. This is intentional and **not** a relaxation of Principle II:

- CSP Level 3 specifies that when a nonce or hash is present in `style-src`, browsers MUST ignore `'unsafe-inline'`. Modern browsers (Chrome 59+, Firefox 58+, Safari 15.4+) follow this; the policy is therefore effectively nonce-only for them.
- `'unsafe-inline'` remains as a graceful fallback for older browsers that don't understand the nonce token. We accept this trade-off because the alternative is breaking the app entirely on those browsers; the constitution allows fallbacks documented in the plan.
- `script-src` does **not** include `'unsafe-inline'` — the script policy is strict-nonce only.

The same pattern is widely used in production Next.js apps and is the recommendation in the Next.js security docs for projects that depend on framework-managed inline styles.

---

## R5. Migration shape for `budget` schema + tables

**Decision**: Four migration files, applied in order:

1. `20260522000000_budget_schema.sql` — `CREATE SCHEMA IF NOT EXISTS budget; GRANT USAGE ON SCHEMA budget TO anon, authenticated;`. Sets default privileges so subsequent table grants are predictable.
2. `20260522000001_categories.sql` — defines `budget.categories` with `id BIGSERIAL PK`, `name TEXT NOT NULL`, `kind TEXT NOT NULL CHECK (kind IN ('income', 'expense'))`, `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `UNIQUE (user_id, name)`. Enables RLS, adds policy `"categories_owner" FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. Grants `SELECT, INSERT, UPDATE, DELETE` to `authenticated`.
3. `20260522000002_transactions.sql` — defines `budget.transactions` with `id BIGSERIAL PK`, `amount NUMERIC(14,2) NOT NULL`, `occurred_on DATE NOT NULL`, `note TEXT`, `category_id BIGINT NOT NULL REFERENCES budget.categories(id) ON DELETE RESTRICT`, `user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Same RLS pattern. Adds a deferred trigger to assert `category_id`'s owner matches `user_id` (DB-enforced cross-user reference rejection per FR-017).
4. `20260522000003_rls_test.sql` — wrapped in a `DO $$ … END $$;` block, creates two temp roles impersonating two `auth.uid()` values, runs `SET LOCAL request.jwt.claims = '...'` to simulate each user, inserts and selects, and asserts isolation. Rolls back at the end. This file is the SQL-level evidence for US2 (and is exercised on `supabase db reset`).

**Rationale**: Each migration does one thing, names are timestamp-ordered, and the RLS test migration sits next to the schema so a fresh `supabase db reset` proves isolation. The owner-match trigger is the constitutional way to enforce FR-017 (no cross-user category reference) at the storage layer — checking it in client code alone would not be enough.

**Alternatives considered**:

- One mega-migration — rejected: harder to review, harder to revert.
- Enforce owner-match via a Postgres function called from the client (RPC) — rejected: this feature has no client write paths; the constraint must hold even against direct admin / future RPC inserts, so it lives at the DB.
- Skip the SQL-level test migration and rely solely on the future Playwright cross-user test (in the next feature) — rejected: US2 is a P1 story and the constitution forbids shipping critical guarantees unverified.

---

## R6. Test-user provisioning for Playwright in an admin-managed setup

**Decision**: Tests read two test-user credential pairs from environment variables (`E2E_USER_A_EMAIL` / `E2E_USER_A_PASSWORD` / same for B). These users are created by an administrator in the Supabase dashboard for the test environment (matches the production provisioning model from Q3). Playwright's global setup signs each test user in once and stores their session as a storage state file under `tests/e2e/.auth/` (gitignored). Individual tests start from that storage state.

**Rationale**: Stays faithful to FR-012a (no credentials in repo) — the actual values live in environment variables. Storage state reuse keeps Playwright fast. Two users let the future cross-user isolation test (next feature's Categories UI) drop in cleanly.

**Alternatives considered**:

- Use the Supabase admin API to create test users programmatically in Playwright's global setup — rejected for this feature: requires the service-role key to be available to the test runner, expanding the secret surface, and the spec's account model says admin provisioning is the answer. We can revisit if test-environment churn becomes painful.
- Single test user only — rejected: blocks the cross-user assertion in the next feature; trivial to add the second now.

---

## R7. State management — does this feature introduce Redux Toolkit?

**Decision**: No. This feature ships zero client-side global state. The only `"use client"` component is `<SignOutButton />`, which is a stateless form-action wrapper. Redux Toolkit will be introduced in the first feature that actually needs cross-component client state (likely the first Categories/Transactions UI). The constitution mandates RTK *when* state is needed, not preemptively.

**Rationale**: Avoids dead code and an empty store; aligns with "don't add features beyond what the task requires."

**Alternatives considered**:

- Scaffold an empty Redux store now "so it's ready" — rejected: empty abstractions rot and are easy to misuse later.

---

## R8. Why no RPC functions in this feature (Principle III interaction)

**Decision**: The Constitution's Principle III ("Backend Communication via Database Functions, NON-NEGOTIABLE") applies to **client-to-backend** business operations. This feature's only client-to-backend operations are Supabase Auth provider calls (`signInWithPassword`, `signOut`, `getUser`) which:

- target GoTrue, not PostgREST,
- cannot be expressed as Postgres functions (auth provider is a managed external service surface), and
- are the canonical "exception documented in the plan" the principle anticipates.

Categories and Transactions tables are created in this feature but **no client UI reads from or writes to them in this feature**. There is therefore nothing to wrap in an RPC yet. The first feature that exposes Category or Transaction CRUD is the place to introduce Postgres functions and `supabase.rpc()` calls.

**Action item carried forward**: the next feature's plan must add this gate item explicitly: *"Any new client → Categories/Transactions interaction goes through a Postgres function in `budget.*`, not `.from().select()` from client code."*

**Rationale**: Adding RPCs now without a caller would be premature abstraction; deferring them to the first caller keeps the surface honest.

---

## R9. Hosting model: local-only for now, dedicated cloud project later

**Decision**: The Budget app develops and tests against a **local Supabase stack** per developer (`npx supabase start` boots an isolated Docker stack on a per-project basis — no conflict with any other app's local stack). There is **no shared cloud Supabase project** for the Budget app at this time. A dedicated paid Supabase project will be provisioned in a later feature; that future feature will introduce `supabase db push` to the dedicated cloud project as the deployment path. Until then, "cloud" deployment is out of scope.

**Rationale**: The original spec recorded a "shared cloud instance with another app" assumption inherited from project memory. During post-implementation review, we recognised that Supabase CLI manages migrations through a single project-global tracking table (`supabase_migrations.schema_migrations`); two CLI-owning repos pushing to the same Supabase project would fight over that table and produce exactly the "only one migrations table" symptom the user observed. Moving to a dedicated cloud project per app sidesteps the issue entirely and matches how Supabase itself recommends multi-app setups. Local stacks are unaffected because each project's `supabase start` produces its own isolated Docker stack on a per-project port range.

**Alternatives considered**:

- **Manual SQL application against the shared cloud project** (admin pastes SQL into Studio) — rejected: works but is brittle long-term and doesn't track applied state.
- **Switch this app to dbmate/sqitch with a per-app tracking table** — rejected for now: introduces a second migration tool when local-only operation needs zero extra tooling; revisit if cloud deployment lands without a dedicated project.
- **Spin up a separate Supabase cloud project today** — deferred: the user has chosen to pay for it later; not blocking development of this feature.

**Implications recorded in spec/quickstart**:

- FR-013's "shared instance" wording was retracted; the `budget` schema convention stays as forward-compatible hygiene.
- Quickstart and README emphasise local Supabase as the only currently supported path.
- The `NEXT_PUBLIC_SUPABASE_URL` developers use is the local URL `http://127.0.0.1:54321` (printed by `supabase start`), not a cloud URL.

## Open items deferred to /speckit-tasks or implementation

These are not unresolved clarifications — they are routine implementer questions that don't need a spec-level decision:

- Exact CSP directive list (connect-src for Supabase URL, img-src for next/image) — choose during middleware implementation.
- Specific Playwright reporter / CI matrix — choose when wiring CI; not in scope for this feature beyond "tests run and pass locally."
- README updates documenting the admin-provisioning step and required env vars — handled as a quickstart deliverable in Phase 1.
