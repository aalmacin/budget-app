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

**Resolved during implementation — shipped CSP shape (T053, T054)**: The shipped CSP in `lib/supabase/middleware.ts` is:

- `script-src 'self' 'nonce-<n>' 'strict-dynamic' https: 'unsafe-inline'` — plus `'unsafe-eval'` in development. The `'unsafe-inline'` token is overridden by `'strict-dynamic'` on CSP-Level-3 browsers (Chrome 59+, Firefox 58+, Safari 15.4+) and remains as a fallback only for older browsers that don't understand the nonce + strict-dynamic combination. The `'unsafe-eval'` dev-only gate is required by React 19's dev overlay — see "Post-merge addendum" below.
- `style-src 'self' 'nonce-<n>'` — plus `'unsafe-inline'` in development. Production is strict-nonce only. The dev `'unsafe-inline'` mirrors the dev-only `'unsafe-eval'` gate on `script-src` and silences ~17 dev-overlay warnings that would otherwise mask real CSP violations.

This is intentional and not a relaxation of Principle II. CSP Level 3 specifies that when `'strict-dynamic'` is present in `script-src` (or a nonce in `style-src`), browsers MUST ignore `'unsafe-inline'`; the policy is therefore effectively nonce-only for modern browsers. The fallback tokens accept a trade-off on legacy browsers that the constitution allows when documented.

The same pattern is the recommendation in the Next.js security docs (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).

**Post-merge addendum — `'unsafe-eval'` required in dev (T053)**: A user-reported "the page refreshes when I click sign-in" bug was traced to React 19's dev-only `eval()` calls being blocked by CSP. Without `'unsafe-eval'` in `script-src`, the eval throws on page load, hydration aborts, `useActionState` never binds to the sign-in form, and the form's `action=""` falls back to a native browser POST — producing the visible page navigation the user perceived as "a refresh." Next.js's own CSP guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`) calls this out explicitly: *"In development, `'unsafe-eval'` is required because React uses `eval` to provide enhanced debugging information, such as reconstructing server-side error stacks in the browser. `unsafe-eval` is not required for production."* Fix: gate the `'unsafe-eval'` source on `process.env.NODE_ENV === "development"` in `lib/supabase/middleware.ts` so production CSP stays strict. This is the same gating pattern the Next.js example uses.

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

## R10. Grant lockdown for Principle III enforcement (post-implementation addendum)

**Decision**: Revoke all direct table grants from `authenticated` and `anon` on `budget.categories` and `budget.transactions`. Enable `FORCE ROW LEVEL SECURITY` on both tables and re-scope the per-table policies from `TO authenticated` to `TO public`. Implemented in migration `20260522000005_lockdown_budget_grants.sql`; verified by `20260522000006_rls_post_lockdown_test.sql`.

**Rationale**: R8 ("no RPC functions in this feature") and the plan's Principle III note both promised that "the first feature that exposes Category or Transaction CRUD must introduce Postgres functions". With direct grants in place, that promise was a convention enforced by code review — a developer could ship `supabase.from('categories').select()` and bypass it. Revoking the grants makes Principle III non-bypassable at the database layer: any direct table access from the client raises `42501 insufficient_privilege`. The only path that works is `supabase.rpc('<name>')` against a SECURITY DEFINER function we explicitly grant `EXECUTE` to.

The `TO public` policy + `FORCE ROW LEVEL SECURITY` combination is what makes the SECURITY DEFINER pattern safe. SECURITY DEFINER functions run as their definer (typically `postgres`). Without FORCE RLS, the table owner bypasses RLS entirely — so an RPC would see all rows for all users. With FORCE RLS, RLS applies to `postgres` too. Without `TO public`, the policy `TO authenticated` doesn't apply to `postgres` — so RLS denies all rows by default. Both knobs must move together, which is why one migration does both.

This change also closes Supabase Advisor lints `pg_graphql_authenticated_table_exposed` for `budget.categories` and `budget.transactions`. With no SELECT grant to `authenticated`, pg_graphql no longer introspects the tables into the signed-in-user GraphQL schema.

**Alternatives considered**:

- **Leave grants in place; rely on code review and Constitution Principle III** — rejected: convention without enforcement decays. The lockdown costs one migration and one verification migration to make the rule physical.
- **Use a separate `app_internal` role for the SECURITY DEFINER owner** — deferred: would require provisioning a new role and granting it SELECT/INSERT/etc. on `budget.*`. The current `postgres`-as-definer + FORCE RLS approach achieves the same isolation without a new role to manage.
- **Disable pg_graphql entirely for `budget` schema** — rejected: would also affect future features that might want GraphQL introspection of safe views. The grant lockdown is the more targeted fix.

**Forward implication for the next feature**: every Category/Transaction RPC must be `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''` with `GRANT EXECUTE ON FUNCTION budget.<name>(...) TO authenticated;`. The RPC body schema-qualifies every table reference (`budget.categories`, not `categories`) since `search_path = ''` disables the default search path.

**Validation gap acknowledged**: An earlier draft of `20260522000006_rls_post_lockdown_test.sql` tried to validate the SECURITY DEFINER + FORCE RLS + `TO public` combination by creating a test helper inside the migration. It failed on first run with `SECURITY DEFINER helper returned 2 categories for user A (expected 1)`. The cause is a hard PostgreSQL rule: **superusers always bypass RLS, regardless of `FORCE ROW LEVEL SECURITY`**. Any function defined in a migration is owned by the migration role (`postgres`, a superuser) and therefore returns unfiltered rows — not because the policy or FORCE RLS is wrong, but because the definer is privileged. The production-correct pattern is to own the function with a non-superuser role that has explicit table grants (the standard Supabase pattern; e.g., create `budget_function_owner NOLOGIN`, grant it SELECT/INSERT/etc. on `budget.*`, and `ALTER FUNCTION ... OWNER TO budget_function_owner`). Introducing that role here would add scope without exercising any real call path, so the first CRUD feature owns both the role provisioning AND the RPC-pattern test. This migration now verifies only the lockdown property (direct DML from `authenticated` is rejected with `42501`); the RPC pattern is validated when there's a real RPC to test it with.

## R11. Email auth provider toggle vs. signup toggle (post-implementation addendum)

**Decision**: In `supabase/config.toml`, keep `[auth].enable_signup = false` (the master signup gate, FR-012a) and set `[auth.email].enable_signup = true`. Public signup remains blocked via the master gate; email/password sign-in is enabled via the per-provider gate.

**Rationale**: A post-merge bug ("login does not work using my credentials") was traced to `[auth.email].enable_signup = false`, which had been set to satisfy the admin-provisioning clarification (Q3 of `spec.md` and FR-012a). GoTrue logs showed every `POST /token` returning `422 email_provider_disabled` and `docker exec supabase_auth_budget env` showed `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`. The Supabase CLI source (`apps/cli-go/internal/start/start.go:1304`) maps that env var directly to `[auth.email].enable_signup`:

```go
fmt.Sprintf("GOTRUE_EXTERNAL_EMAIL_ENABLED=%v", utils.Config.Auth.Email.EnableSignup)
```

That is, the same TOML key controls **both** "can users sign up via the email provider" **and** "is the email provider live for any operation at all, including `signInWithPassword`." Disabling it to block signups also disabled password logins, which is what produced the bug.

The correct knob for "no public signup" is `[auth].enable_signup = false`, which the CLI maps to `GOTRUE_DISABLE_SIGNUP=true` (a distinct env var, the master switch over every provider). That flag blocks the public `/signup` route while leaving `signInWithPassword` and the admin API (used by Studio's "Add user") fully functional.

**Alternatives considered**:

- **Leave `[auth.email].enable_signup = false`; rely on a different mechanism to allow password sign-in** — not viable: there is no separate "enable email provider for login only" key in `[auth.email]`. The CLI does not expose one.
- **Disable the email provider entirely and use only the admin API for everything** — rejected: clients still need `signInWithPassword` to authenticate, and that path goes through the email provider. Disabling it is incompatible with the sign-in user story (US1).
- **Switch to magic-link or OTP sign-in** — out of scope per Assumptions ("Email + password is the chosen sign-in method").

**Implications recorded in spec/quickstart**:

- `quickstart.md` Troubleshooting now lists "Sign-in always returns 'Email or password is incorrect'" → check `[auth.email].enable_signup`.
- The admin-provisioning model (FR-012a, Q3) is unchanged; only the implementation-level config flag changed.

**Related secondary finding (tracked as task T052, not closed by this decision)**: `lib/validators/auth.ts` enforces ≥1 digit + ≥1 symbol on the *sign-in* form, but `supabase/config.toml` has `password_requirements = ""` (no enforcement). A Studio-created password without a digit/symbol is accepted by Supabase but rejected by the form, yielding the same generic "Email or password is incorrect" error. The comment in `auth.ts:9` references a nonexistent task `T042a` that was supposed to align them. Recommended resolution: drop the digit/symbol checks from the sign-in validator (sign-in does not create passwords; Supabase is the source of truth for what passwords are valid).

---

## R12. Household ownership model (Phase 7)

**Decision**: For household-scoped data (categories, transactions, subscriptions, members), ownership is the calling user's *active household membership*, not `auth.uid()`. RLS predicates read from `budget.auth_user_household_ids()` (ported from legacy `0001_init.sql:36–47`) which returns the household ids the caller is an active member of. Cross-household isolation is enforced at the database; cross-member isolation within the same household is intentionally NOT enforced (members share their household's data).

**Rationale**: The product is a *family* budget app. Sharing across the household is a feature, not a leak — both adults of a household need to see and edit the same transactions, dashboard, subscriptions, etc. Membership-based RLS expresses this cleanly: a member's `auth.uid()` resolves to a (possibly empty) set of household ids via `household_member`, and every household-scoped row is filtered to that set. The Phase 4 model (`auth.uid() = user_id` direct) doesn't compose: it would require duplicating every record per member, or a brittle "any-of" check in policies.

**Alternatives considered**:

- **Direct `auth.uid()` on every row + a `share_with` array** — rejected: explodes write complexity (every insert needs the array), can't express "added a new adult to an existing household".
- **Per-table `household_id` with no membership table; resolve household via `auth.users.raw_app_meta_data->>'household_id'`** — rejected: stores authorization data outside the database, breaks the "single source of truth" property; also forces re-issuing the JWT every time a user joins or leaves a household.
- **Schema-per-household** — rejected: doesn't scale, breaks reporting across the system seeds.

**Constitution interaction**: FR-013 (`budget` schema) is preserved — every Phase 7 table lives in `budget`. Principle III (Postgres functions for backend logic) is preserved AND tightened — Phase 7 introduces the SECURITY DEFINER RPC pattern at scale, with the lockdown extended to the new tables (R14 below).

---

## R13. Schema migration strategy for the Phase 4 user-owned tables

**Decision**: Drop `budget.transactions` and `budget.categories` (the user-owned tables created by T020/T021) and recreate them under the household-scoped shape (T058–T061). Safe because Phase 4 shipped without any UI for these tables — there are no production rows to preserve.

**Rationale**: An additive migration (`ALTER TABLE ... ADD COLUMN household_id`, then a column-rename, then a policy swap) would require backfilling NULL `household_id` from the `user_id` via a `(user_id → first_household_membership)` lookup. That lookup doesn't exist yet (the household model itself doesn't exist yet), so the migration would need a multi-step bootstrap. Drop-and-recreate is the simpler operation when the source data is empty.

**Operational gate**: T058's migration header MUST state explicitly that the drop is conditional on "no production data exists". The first time Phase 7 ships to a cloud project that has accumulated data, this assumption must be re-verified — if the assumption breaks, the migration becomes a multi-step backfill instead.

**Alternatives considered**:

- **Additive migration with backfill** — rejected for the reason above. Worth reconsidering if a later environment has real data when Phase 7 ships there.
- **Leave the Phase 4 tables in place under different names (e.g. `budget.user_categories`, `budget.user_transactions`) and let both schemas coexist** — rejected: two parallel data models double the surface area for almost no upside.

---

## R14. RPC API surface (Phase 7)

**Decision**: Author ~25 SECURITY DEFINER RPCs in the `budget` schema, one per write path + one per direct-read replacement, grouped into 6 feature-area migration files (`20260524000009_rpc_household.sql` through `20260524000015_rpc_reports.sql`). Every function:

1. Is `LANGUAGE plpgsql` (or `sql` where pure).
2. Has `SECURITY DEFINER`.
3. Has `SET search_path = ''`; every table reference inside the body is schema-qualified (`budget.household`, not `household`).
4. Is `OWNER TO budget_function_owner` — a non-superuser role (`NOLOGIN`) created in T055. **This is the critical bit that R10's "Validation gap" called out**: postgres-owned definers bypass RLS regardless of `FORCE ROW LEVEL SECURITY`, so the function owner must be a non-superuser with explicit grants on the relevant tables.
5. Grants `EXECUTE ... TO authenticated` so the client can call it via `supabase.rpc()`.

The cron-invoked `materialize_due_subscriptions` is a special case: it operates across households on behalf of the system, so the function takes a `bypass_rls boolean DEFAULT false` parameter; only the cron schedule invocation passes `true`, and the body sets `row_security = off` only on that branch. Documented in the function comment.

**Rationale**: The constitution's Principle III says all client-to-backend business logic goes through Postgres functions. Phase 4 had no client UI, so this requirement was deferred. Phase 7 introduces ~10 routes that all need writes — so the RPC pattern has to materialize now, at scale. The `budget_function_owner` choice resolves the open issue R10 left unaddressed.

**Alternatives considered**:

- **Keep direct grants and rely on RLS + Principle III by convention** — rejected: convention without enforcement decays; R10 closed this for the Phase 4 tables and Phase 7 should not regress it.
- **Per-RPC owner roles** — rejected: too much role management overhead for no measurable security gain.
- **Service-role calls from a thin server-only client** — rejected: the service role bypasses RLS entirely, so a bug in one RPC could expose every household's data. The `definer + non-superuser + FORCE RLS + TO public` combination keeps RLS in the loop.

**RPC inventory** (full list in `tasks.md` Phase 7 §7.3): `create_household`, `add_adult_by_email`, `add_kid`, `soft_delete_member`, `update_member_income`, `list_household_members`, `get_current_household`, `list_kid_month_summary`, `list_transactions`, `log_expense`, `log_income`, `update_transaction`, `delete_transaction`, `list_quick_add_options`, `get_dashboard_summary`, `set_category_essential_pct`, `set_category_budget`, `get_budget_progress`, `compute_income_split`, `list_categories`, `register_subscription`, `pause_subscription`, `resume_subscription`, `list_subscriptions`, `list_overlapping_subscriptions`, `materialize_due_subscriptions`, `cashflow_kpis`, `essentials_breakdown`, `spend_over_time`, `per_person_breakdown`.

---

## R15. Subscription materialization cron (Phase 7)

**Decision**: Re-introduce `pg_cron` (which T044 dropped from `public`), but install it in the `extensions` schema (per Supabase recommended practice) so the `extension_in_public` lint stays closed. Schedule `subscriptions-hourly` at `0 * * * *` to call `budget.materialize_due_subscriptions(true)`. Idempotency is enforced physically by the unique index on `budget.transaction (subscription_id, occurrence_date)` (FR-032), so a missed cron run that gets retried doesn't double-post.

**Rationale**: An hourly cadence satisfies SC-008 ("95% within 1 hour"). Idempotency at the table level means we don't need to track cron run state — the index simply rejects the duplicate insert if the materialization happens twice. The `extensions` schema placement matches Supabase's own convention for shared extensions and keeps the Advisor clean.

**Alternatives considered**:

- **Run materialization from the application layer on every dashboard render** — rejected: the cron path is the only thing that works when no one is signed in; "user opened the app" is not a guarantee for a budgeting tool used monthly.
- **A separate worker process** — rejected: introduces a deployable that doesn't otherwise exist, for no win over `pg_cron`.

---

## R16. PWA offline outbox interaction (Phase 7)

**Decision**: The existing `lib/pwa/outbox.ts` IndexedDB outbox and `lib/pwa/dispatch.ts` dispatcher continue to work unchanged. The two RPCs they target (`log_expense`, `log_income`) both take a single `p jsonb` parameter that includes a client-supplied `id` (UUID v7, minted by `dispatchOrEnqueue`); FR-031 enshrines this contract on the database side by making `budget.transaction.id` accept the client value rather than defaulting it. Optionally, `register_subscription` joins the `OutboxRpc` union (T095) so subscription registration also works offline.

**Rationale**: The offline outbox already exists and is well-tested. The only contract requirement on the database side is "the RPC accepts the client-supplied id" — which is what UUID v7 idempotency replay needs. If the cron-materialized `subscription_id, occurrence_date` index from T061 ever sees a conflicting `id` from a replay, the insert silently no-ops (the user already submitted that transaction; replay just confirms it).

**Alternatives considered**:

- **Server-side ids only** — rejected: would force the outbox dispatcher to fetch a server id before the user is online (impossible) or generate ids server-side after replay (breaks idempotency on retry storms).

---

## Open items deferred to /speckit-tasks or implementation

These are not unresolved clarifications — they are routine implementer questions that don't need a spec-level decision:

- Exact CSP directive list (connect-src for Supabase URL, img-src for next/image) — choose during middleware implementation.
- Specific Playwright reporter / CI matrix — choose when wiring CI; not in scope for this feature beyond "tests run and pass locally."
- README updates documenting the admin-provisioning step and required env vars — handled as a quickstart deliverable in Phase 1.
- Exact SQL of every Phase 7 RPC body — derivable from the app code call sites (the parameter names and return shapes are fixed by the existing client); written per-migration during implementation.
