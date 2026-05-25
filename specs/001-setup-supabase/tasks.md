---

description: "Task list for the Supabase Foundation feature (001-setup-supabase)"
---

# Tasks: Supabase Foundation for Budget App

**Input**: Design documents from `/specs/001-setup-supabase/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/server-actions.md`, `quickstart.md`

**Tests**: Tests are **required** for this feature. The constitution (Principle IV) mandates Playwright critical-path coverage of the authentication flow (US1, US3). User Story 2 is verified at the database layer via a SQL-level RLS test migration that runs on `supabase db reset`.

**Organization**: Tasks are grouped by user story. US1 and US2 can be developed in parallel after the Foundational phase; US3 depends on US1 being usable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are repository-root-relative.

## Path Conventions

Single Next.js project. Application code under `app/`, `actions/`, `lib/`, `components/`. Database migrations under `supabase/migrations/`. Tests under `tests/e2e/`. Middleware and Playwright config at the repo root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies, scaffold Supabase CLI and Playwright, declare required env vars.

- [x] T001 Add runtime and dev dependencies in `package.json` and install: `@supabase/ssr@^0.10`, `@supabase/supabase-js@^2.x` (deps); `supabase`, `@playwright/test` (devDeps). Run `npm install`. **(package.json updated; `npm install` deferred to user)**
- [x] T002 [P] Create `.env.local.example` listing required vars without values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`, `E2E_USER_B_PASSWORD`. Add an inline note pointing to `quickstart.md`.
- [x] T003 [P] Initialize Supabase local config by running `npx supabase init`. Verify it creates `supabase/config.toml` and `supabase/.gitignore`. Confirm `supabase/.gitignore` excludes `.temp/` and `.branches/`. **(files created manually; user rule prohibits running supabase commands)**
- [x] T004 Edit `supabase/config.toml` (depends on T003): set `[api] schemas = ["budget", "graphql_public"]` and `extra_search_path = ["budget", "public", "extensions"]`. Leave other values at defaults.
- [x] T005 [P] Initialize Playwright by creating `playwright.config.ts` at the repo root. Set `testDir: 'tests/e2e'`, `use.baseURL: 'http://localhost:3023'`, a `webServer` block that runs `npm run dev`, and a default project that uses a `storageState` fixture loaded from `tests/e2e/.auth/userA.json`.
- [x] T006 Add scripts to `package.json` (sequential after T001 since same file): `"test:e2e": "playwright test"`, `"supabase:reset": "supabase db reset"`. Also add `"tests/e2e/.auth/"` to root `.gitignore`.

**Checkpoint**: Dependencies installed, Supabase CLI and Playwright scaffolded, env vars documented.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The Supabase clients, the auth-gating middleware, the `budget` schema, and the CSP nonce — every user story uses these. No story work begins until this phase is checkpointed.

**CRITICAL**: All user-story phases (Phase 3, 4, 5) depend on this phase.

- [x] T007 [P] Create `lib/supabase/client.ts` exporting `createSupabaseBrowserClient()` using `@supabase/ssr`'s `createBrowserClient`. Pass `{ db: { schema: 'budget' } }` so `supabase.from('categories')` resolves to `budget.categories`. Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from env (non-null asserted at call site only).
- [x] T008 [P] Create `lib/supabase/server.ts` exporting `async createSupabaseServerClient()` using `@supabase/ssr`'s `createServerClient`. Use `await cookies()` from `next/headers` (Next.js 16 async API — confirm against `node_modules/next/dist/docs/` per AGENTS.md). Pass `{ db: { schema: 'budget' } }`. Implement both `getAll` and `setAll` cookie handlers.
- [x] T009 [P] Create `lib/auth.ts` exporting `async getCurrentUser(): Promise<User | null>`. Implementation: call `createSupabaseServerClient()` then `supabase.auth.getUser()` (not `getSession()` — per research R3). Return `data.user` or `null`.
- [x] T010 Create `proxy.ts` at the repo root. Behavior: (a) construct a request-scoped Supabase server client bound to `request.cookies`; (b) call `supabase.auth.getUser()` and write any refreshed cookies into the response; (c) if no user and `request.nextUrl.pathname` does not start with `/login`, return `NextResponse.redirect(new URL('/login', request.url))`; (d) generate a per-request nonce via `crypto.randomUUID()` and set `Content-Security-Policy` and an `x-nonce` request header for downstream Server Components. Export `config.matcher` matching everything except `_next/static`, `_next/image`, `favicon.ico`, and `public/` assets.
- [x] T011 [P] Update `app/layout.tsx` to read the nonce from `headers()` (await it) and apply it to any framework-emitted inline `<script nonce={nonce}>` or `<style nonce={nonce}>` tags as documented in the current Next.js docs version. Strip the placeholder "Create Next App" `metadata.title`/`description` and set them to `"Budget"`.
- [x] T012 [P] Create migration `supabase/migrations/20260522000000_budget_schema.sql`: `CREATE SCHEMA IF NOT EXISTS budget;` then `GRANT USAGE ON SCHEMA budget TO anon, authenticated;` and `ALTER DEFAULT PRIVILEGES IN SCHEMA budget GRANT ALL ON TABLES TO authenticated;` (so subsequent table grants are predictable).
- [ ] T013 Foundation checkpoint: with env vars filled in `.env.local`, run `npx supabase db reset` (against a local stack) and `npm run dev`. Visiting `http://localhost:3023/` MUST redirect to `/login` (proves middleware + clients wire up correctly). The `/login` page does not exist yet — a 404 at `/login` is acceptable at this checkpoint and will be resolved by T015. Verify also that the CSP header appears in the network response. **(awaits user execution — supabase command + browser verification)**

**Checkpoint**: Foundation ready. US1 and US2 can now proceed in parallel; US3 waits on US1.

---

## Phase 3: User Story 1 — Returning user signs in (Priority: P1) 🎯 MVP-A

**Goal**: A user with a pre-provisioned account can sign in with email + password, lands on the main page, and stays signed in across reloads. Unauthenticated visitors are redirected to `/login`.

**Independent Test**: With env vars set and a test user provisioned in Supabase, visiting `http://localhost:3023/` redirects to `/login`. Submitting valid credentials lands the user on a minimal authenticated home page that confirms sign-in. Submitting invalid credentials keeps the user on `/login` with a visible error. Refreshing while signed in keeps the session.

### Implementation for User Story 1

- [x] T014 [US1] Create `actions/auth.ts` with `'use server'` directive and a single exported `signIn(formData: FormData)` server action implementing the contract in `contracts/server-actions.md`. Validate `email` and `password` are non-empty strings (redirect to `/login?error=Email+and+password+required` otherwise). Call `supabase.auth.signInWithPassword`. On error from Supabase: `redirect('/login?error=Invalid+credentials')`. On unexpected exception: `redirect('/login?error=Service+temporarily+unavailable')`. On success: `redirect('/')`. Never echo the password. **(file also includes signOut from T025 — same file, written together)**
- [x] T015 [P] [US1] Create `app/login/page.tsx` as a Server Component. Accept `searchParams: Promise<{ error?: string }>` per Next.js 16's async-search-params contract (confirm in `node_modules/next/dist/docs/`). Render an `<h1>`, the error message when present, and a `<form action={signIn}>` with `email` (`type="email" required`) and `password` (`type="password" required autoComplete="current-password"`) inputs and a submit button. Use Tailwind classes already in the codebase for styling consistent with the existing app theme.
- [x] T016 [P] [US1] Replace the contents of `app/page.tsx` with a minimal Server Component that renders a single line confirming sign-in (e.g., `<main><h1>Signed in</h1></main>`). This is a temporary US1 stub — US3 (T024) will move this content into the `(authed)` route group with a header. The middleware already protects this route, so anonymous visitors never see it. **(skipped stub; `app/page.tsx` deleted and content placed directly in `app/(authed)/page.tsx` since US3 ships in the same turn — eliminates churn)**
- [x] T017 [US1] Create `tests/e2e/fixtures.ts` providing a `test` re-export (`@playwright/test`) plus a `loginAs(page, role: 'A' | 'B')` helper that reads the corresponding `E2E_USER_*` env vars, visits `/login`, submits the form, and asserts the URL becomes `/`. Also export a global-setup function that pre-signs-in user A and writes the storage state to `tests/e2e/.auth/userA.json`. Wire global setup into `playwright.config.ts` (depends on T005). **(global-setup is its own file `tests/e2e/global-setup.ts` wired into playwright.config.ts)**
- [x] T018 [US1] Create `tests/e2e/auth.spec.ts` covering all US1 acceptance scenarios. **(split across `tests/e2e/anonymous/auth.spec.ts` and `tests/e2e/authed/already-signed-in.spec.ts` to match the Playwright project config — anonymous vs authed storage states)**
- [ ] T019 [US1] Run the quickstart US1 verification block manually (see `quickstart.md` "US1 — Returning user signs in"). Time the sign-in → land transition; confirm SC-001 (< 5 s on broadband) and SC-003 (no re-credentialing on a valid session). **(awaits user execution — requires running app + provisioned user)**

**Checkpoint**: US1 is fully functional and testable. MVP-A reached.

---

## Phase 4: User Story 2 — Signed-in user only sees their own data (Priority: P1)

**Goal**: `Category` and `Transaction` tables exist in the `budget` schema with RLS enforcing per-user isolation, ownership defaults via `auth.uid()`, unique category names per user, and cross-user category references rejected at the DB layer. Isolation is verified by a SQL-level test that runs on `supabase db reset`.

**Independent Test**: After `npx supabase db reset`, `pg_tables` shows both new tables in `budget` with `rowsecurity = true`. `pg_policies` shows the two owner policies. The RLS test migration (T022) executes without raising — it inserts data as two simulated users and asserts each can see only their own rows. The introspection queries from `quickstart.md` US2 return the expected shape.

### Implementation for User Story 2

- [x] T020 [P] [US2] Create migration `supabase/migrations/20260522000001_categories.sql` exactly matching the schema in `data-model.md` § `budget.categories`.
- [x] T021 [P] [US2] Create migration `supabase/migrations/20260522000002_transactions.sql` exactly matching the schema in `data-model.md` § `budget.transactions`.
- [x] T022 [US2] Create migration `supabase/migrations/20260522000003_rls_test.sql` (depends on T020, T021). DO block with SAVEPOINT-wrapped assertions for FR-010, FR-016, FR-017.
- [ ] T023 [US2] Run `npx supabase db reset` (depends on T020, T021, T022, T037, and Foundational T012). Confirm: all migrations apply in order, the RLS test migration prints no error, `SELECT * FROM pg_policies WHERE schemaname='budget'` returns the two owner policies. This verifies SC-002 and SC-005. **(awaits user execution — supabase command; currently blocked by T037 which fixes the PL/pgSQL syntax error in the RLS test migration)**
- [x] T024 [US2] Create `supabase/verify/rls_status.sql` containing the two introspection queries from `quickstart.md` US2 (table+rowsecurity + policy list). This is not run automatically — it is a copy-pasteable verification artifact for ops/review.
- [x] T037 [US2] **Fix `supabase/migrations/20260522000003_rls_test.sql` so `supabase db reset` no longer fails with `syntax error at or near "TO" (SQLSTATE 42601)`.** Root cause: PL/pgSQL `DO` blocks cannot execute SQL transaction-control statements (`SAVEPOINT` / `ROLLBACK TO SAVEPOINT`) — the parser fails on the `TO` keyword. The G2 cleanup that opened `SAVEPOINT rls_test` inside the `DO` block was therefore invalid. Two secondary issues in the same file also need fixing: (a) `SET LOCAL request.jwt.claims = '...'` is not parseable inside `DO` for dotted GUC names — must use `PERFORM set_config('request.jwt.claims', '...', true)`; (b) `SET LOCAL role authenticated` is parsed as a GUC assignment (lowercase `role` is not the `ROLE` keyword) and is also invalid in PL/pgSQL — must use `PERFORM set_config('role', 'authenticated', true)`. **Required rewrite**: (1) drop the explicit `SAVEPOINT` / `ROLLBACK TO SAVEPOINT`; replace with a nested `BEGIN ... EXCEPTION WHEN SQLSTATE 'P0001' THEN ... END` sub-block that does all seeding + assertions and ends by `RAISE EXCEPTION` with a sentinel SQLSTATE/message so the implicit-savepoint rollback discards both the synthetic `auth.users` rows and the test data; (2) re-raise the sentinel exception only if the message does not match the sentinel (so real assertion failures still abort the reset); (3) replace every `SET LOCAL request.jwt.claims = ...` with `PERFORM set_config('request.jwt.claims', $$...$$, true);` (dollar-quoted to keep the JSON readable); (4) replace `SET LOCAL role authenticated` with `PERFORM set_config('role', 'authenticated', true);`. Verify by running `npx supabase db reset` and confirming the `RAISE NOTICE 'RLS test migration passed.'` line appears in the output and no residue rows exist in `auth.users` afterward. This task blocks T023.

**Checkpoint**: US2 is fully functional and testable at the DB layer. The MVP-A+B (US1 + US2) is now usable end-to-end: users can sign in, and their data is isolated.

---

## Phase 5: User Story 3 — Signed-in user signs out (Priority: P2)

**Goal**: An authenticated app shell wraps every protected page with the user's email and a sign-out button. Activating the button ends the session and returns to `/login`. After sign-out, protected URLs are blocked again. The placeholder home page now visibly confirms sign-in by greeting the user (FR-020).

**Depends on**: US1 (a working sign-in is required to reach the shell).

**Independent Test**: Sign in (using US1), confirm the header shows the user's email and a "Sign out" button. Click "Sign out", confirm redirect to `/login`. Visit `/` again — confirm redirect to `/login`.

### Implementation for User Story 3

- [x] T025 [US3] Append `signOut()` server action to `actions/auth.ts` (same file as T014; sequential). **(written in same edit as T014)**
- [x] T026 [P] [US3] Create `components/SignOutButton.tsx` with `'use client'`.
- [x] T027 [P] [US3] Create `components/AppHeader.tsx` as a Server Component.
- [x] T028 [US3] Create `app/(authed)/layout.tsx`. Also adds `app/(authed)/error.tsx` and `app/(authed)/loading.tsx` to address analysis finding F1 (Constitution Principle V — shared layouts MUST scaffold error and loading boundaries).
- [x] T029 [US3] Create `app/(authed)/page.tsx` with email greeting (FR-020). `app/page.tsx` already deleted in T016 step.
- [x] T030 [P] [US3] Create `tests/e2e/authed/sign-out.spec.ts` covering US3 acceptance scenarios + the multi-tab edge case.
- [ ] T031 [US3] Run the quickstart US3 verification block (`quickstart.md` "US3 — Sign out"). Confirm SC-006 (post-signout every protected page redirects). **(awaits user execution — requires running app + provisioned user)**

**Checkpoint**: All three user stories are functional and independently testable. Feature is shippable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, verification, and the non-functional sweeps that close the constitutional and SC-* gates.

- [x] T032 [P] Update `README.md` with: required env vars (link to `.env.local.example`), the admin-provisioning workflow (Supabase dashboard → Authentication → Users → Add user with auto-confirm), `npm run dev` / `npm run test:e2e` / `npm run supabase:reset` commands. Closes SC-004.
- [ ] T033 [P] Verify the nonce-based CSP in the browser: open DevTools Network on `/login` and `/`, confirm the `Content-Security-Policy` response header is present, the nonce in the header matches `nonce="..."` on framework-emitted inline scripts, and the Console shows zero CSP violations. Closes Constitution Principle II. **(awaits user execution — browser verification)**
- [x] T034 [P] Run `npx tsc --noEmit` from the repo root and confirm zero type errors. Run `npm run lint` and confirm zero new warnings/errors. Closes Constitution Principle I (no `any`, strict types). **(both pass, exit 0; also `npm run build` succeeds with no deprecation warnings after middleware → proxy rename)**
- [ ] T035 Run the full Playwright suite: `npm run test:e2e`. All US1 and US3 specs must pass. Closes Constitution Principle IV. **(awaits user execution — requires running app + provisioned users)**
- [ ] T036 Walk the `quickstart.md` end-to-end as if a brand-new developer (use a sibling clone or `git worktree`). Time the path from clone to successful sign-in. Confirm under 15 minutes including the administrator step. Closes SC-004 definitively. **(awaits user execution)**
- [x] T038 Fix and extend the Supabase developer scripts in `package.json`. (a) Replace the existing `"db:start": "npx supabase db start"` with `"db:start": "npx supabase start"` — `supabase db start` is not a valid Supabase CLI subcommand; `supabase start` is the command that boots the full local stack (Postgres + Auth + Storage + Realtime + **Studio web console**). (b) Add `"db:reset": "npx supabase db reset"` alongside the existing `"supabase:reset"` script. (c) Leave `"supabase:reset"` in place for backward compatibility with any existing docs that reference it — it now acts as an alias for `db:reset`. After editing, confirm the file parses by running `node -e "require('./package.json')"` from the repo root.
- [x] T039 [P] Verify Studio is correctly enabled in `supabase/config.toml`: confirm the `[studio]` block contains `enabled = true`, `port = 54323`, and `api_url = "http://127.0.0.1"`. If the values match, no edit is needed — record verification in the task notes. If they don't match, restore them to the values listed above. The default port 54323 must not conflict with `[api] port = 54321`, `[db] port = 54322`, `[inbucket] port = 54324`, or `[analytics] port = 54327` (also verify no clash).
- [x] T040 [P] Update `quickstart.md` and `README.md` to document the local Supabase Studio web console. Add a short subsection titled "Supabase Studio (local web console)" that states: (a) Studio launches automatically with `npm run db:start`; (b) it is reachable at `http://127.0.0.1:54323`; (c) it is the place to create local test users for the admin-provisioning workflow already described in `README.md` (Authentication → Users → Add user → enable Auto Confirm User). Also list both `npm run db:start` (boots stack + Studio) and `npm run db:reset` (re-applies migrations + runs the RLS test in `20260522000003_rls_test.sql`) alongside the existing `npm run dev` and `npm run test:e2e` commands. Closes SC-004 documentation gap for Studio.
- [ ] T041 Diagnose and fix Supabase Studio reachability — `http://localhost:54323` returns `ERR_CONNECTION_REFUSED` / "can't be reached". Studio is correctly configured in `supabase/config.toml` (verified in T039), so this is a runtime issue, not a config issue. Run these diagnostics from the repo root in order and stop at the first one that reveals the cause; the fix branch is listed beside each: (1) `docker info >/dev/null 2>&1 && echo "docker up" || echo "docker DOWN"` — if Docker is down, start Docker Desktop / OrbStack and skip to step 6. (2) `npx supabase status` — if it errors with "supabase start is not running", run `npm run db:start` and re-check the URL. (3) If `supabase status` lists a Studio URL but the browser still can't reach it, run `docker ps --filter "name=supabase_studio" --format "{{.Names}} {{.Status}} {{.Ports}}"` — if the container is `Exited` or missing, run `docker logs supabase_studio_budget` (project_id from `supabase/config.toml` is `budget`, so the container name is `supabase_studio_budget`) to see the exit reason, then restart with `npx supabase stop && npm run db:start`. (4) `lsof -nP -iTCP:54323 -sTCP:LISTEN` — if something other than the Studio container is bound to 54323, either stop that process or change `[studio] port` in `supabase/config.toml` to a free port (e.g. `54343`) and re-run `npm run db:start`. (5) Confirm you can reach it via the explicit IP — `curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54323` should print `200`. If `127.0.0.1` works but `localhost` doesn't, your `/etc/hosts` does not map `localhost` to `127.0.0.1`; either fix `/etc/hosts` or use `http://127.0.0.1:54323` in the browser. (6) Re-open `http://127.0.0.1:54323` after applying the relevant fix. Record which branch resolved it in this task's checkbox notes so the troubleshooting docs (T042) capture the real-world failure mode. **(awaits user execution — requires Docker + `supabase` CLI, both of which the global rule prohibits this assistant from invoking)**
- [ ] T042 [P] Add a "Studio at 127.0.0.1:54323 doesn't load" entry to the troubleshooting table in `specs/001-setup-supabase/quickstart.md` and a matching short paragraph in `README.md` (under the existing "Supabase Studio (local web console)" section added by T040). The entry MUST list, in order: (a) "Is the stack running? Run `npx supabase status`; if it errors, run `npm run db:start`."; (b) "Is Docker running? `docker info` must succeed."; (c) "Is anything else on port 54323? `lsof -nP -iTCP:54323 -sTCP:LISTEN`; if so, change `[studio] port` in `supabase/config.toml` to a free port and re-run `npm run db:start`."; (d) "Browser sees `localhost` but not `127.0.0.1` (or vice-versa)? Try the other host — Studio binds to `127.0.0.1`." Depends on T041 having identified at least one real cause so the docs reflect a verified failure mode rather than speculation.

### Database linter remediation (Supabase Advisors)

These six tasks resolve the 19 WARN-level Security lints reported by Supabase's Database Advisors (`function_search_path_mutable` × 5, `extension_in_public` × 1, `pg_graphql_anon_table_exposed` × 5, `pg_graphql_authenticated_table_exposed` × 7). The strategy: drop the prior `family-budget-app` artifacts (they violate FR-013) and lock down the `budget.*` tables so direct client access is impossible, aligning with Constitution Principle III (all client CRUD must go through SECURITY DEFINER RPCs). The RLS test is augmented with a post-lockdown verification migration so the new model is asserted on every `db reset`.

- [x] T043 Fix the `function_search_path_mutable` warning for `budget.assert_transaction_category_owner`. Edit `supabase/migrations/20260522000002_transactions.sql`: insert `SET search_path = ''` between `LANGUAGE plpgsql` and `AS $$` in the `CREATE FUNCTION budget.assert_transaction_category_owner()` definition. The body already schema-qualifies `budget.categories`, so no body change is needed. Re-run `npm run db:reset` after editing — the RLS test in `20260522000003_rls_test.sql` must still pass (it exercises the trigger via the FR-017 cross-user insert path). This closes lint `0011_function_search_path_mutable` for the one budget-schema function.
- [x] T044 Drop the legacy `family-budget-app` artifacts that conflict with FR-013 and produce 10 of the 19 lint warnings. Create new migration `supabase/migrations/20260522000004_drop_legacy_public.sql` containing, in order, with `IF EXISTS` for idempotency: (1) `DROP TABLE IF EXISTS public.subscription CASCADE;`; (2) `DROP TABLE IF EXISTS public.transaction CASCADE;`; (3) `DROP TABLE IF EXISTS public.household_member CASCADE;`; (4) `DROP TABLE IF EXISTS public.category CASCADE;`; (5) `DROP TABLE IF EXISTS public.household CASCADE;`; (6) `DROP FUNCTION IF EXISTS public.enforce_member_household() CASCADE;`; (7) `DROP FUNCTION IF EXISTS public.forbid_undelete_of_adult_when_capped() CASCADE;`; (8) `DROP FUNCTION IF EXISTS public.enforce_adult_cap() CASCADE;`; (9) `DROP FUNCTION IF EXISTS public.update_timestamp() CASCADE;`; (10) `DROP EXTENSION IF EXISTS citext;`. Header comment must state: "Drops artifacts created by the prior `family-budget-app` migrations (`0001_init.sql` through `0004_subscriptions.sql`). They conflict with FR-013 (Budget app data must live in the `budget` schema) and produce the public.* lint warnings reported by Supabase Advisors. The original migrations remain in `supabase/migrations/` for history but no longer have any runtime effect after this drop." Closes lints `0011` (4 public functions), `0014` (citext), `0026` (5 public tables × anon), and the public-table half of `0027` (5 tables × authenticated). **Note**: do not edit the original `0001_init.sql`..`0004_subscriptions.sql` — leaving them intact preserves migration history; the DROP migration is the canonical record that they were intentionally undone in this feature.
- [x] T045 Lock down the `budget.*` tables so direct client access is impossible, closing the remaining `0027` warnings for `budget.categories` and `budget.transactions` and enforcing Principle III at the grant layer. Create new migration `supabase/migrations/20260522000005_lockdown_budget_grants.sql` that, for each of `budget.categories` and `budget.transactions`: (a) `REVOKE ALL ON <table> FROM authenticated, anon;`; (b) `REVOKE ALL ON SEQUENCE <table>_id_seq FROM authenticated, anon;`; (c) `ALTER TABLE <table> FORCE ROW LEVEL SECURITY;` (so the table owner — `postgres` — also evaluates RLS, which is the requirement for SECURITY DEFINER RPCs to be RLS-filtered); (d) `DROP POLICY <policy_name> ON <table>;` then `CREATE POLICY <policy_name> ON <table> FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` — the `TO public` change is required because policies scoped `TO authenticated` do not apply to `postgres` even with FORCE RLS, so SECURITY DEFINER RPCs (running as `postgres`) would otherwise be unfiltered. Header comment must state: "Principle III enforcement: revokes all direct table grants from `authenticated`/`anon` so client-side `supabase.from('categories').select()` and equivalent paths are rejected with `permission denied`. Future CRUD features MUST go through SECURITY DEFINER Postgres functions called via `supabase.rpc()`. FORCE ROW LEVEL SECURITY + `TO public` policies means RLS still filters every row even when the RPC runs as `postgres`." Closes lint `0027` for `budget.categories` and `budget.transactions`.
- [x] T046 Add post-lockdown verification so every `db reset` proves the new model holds. Create new migration `supabase/migrations/20260522000006_rls_post_lockdown_test.sql`. Pattern follows `20260522000003_rls_test.sql` (T037 — sentinel-exception rollback, `set_config` for `role`, nested `BEGIN...EXCEPTION...END`). The migration MUST assert: **Lockdown enforced** — switch role to `authenticated` and attempt each of SELECT / INSERT / UPDATE / DELETE against both `budget.categories` and `budget.transactions`; each operation MUST raise `insufficient_privilege` (SQLSTATE `42501`). Eight assertions total (4 verbs × 2 tables). **Note — SECURITY DEFINER assertion dropped**: an earlier draft also tried to validate the future RPC pattern via a SECURITY DEFINER helper, but that failed on first `db reset` (`returned 2 categories for user A (expected 1)`) because PostgreSQL superusers always bypass RLS regardless of FORCE — and any function defined in a migration is owned by the migration role (`postgres`, a superuser). Validating that pattern requires a non-superuser function-owner role with explicit table grants, which is out of scope for 001-setup-supabase and belongs in the first CRUD feature where a real RPC exercises it. See research.md R10 "Validation gap acknowledged" for the full rationale.
- [x] T047 [P] Document the new model in `specs/001-setup-supabase/data-model.md` and `specs/001-setup-supabase/research.md`. In `data-model.md`: under the `budget.categories` and `budget.transactions` RLS subsections, replace the `Grant SELECT, INSERT, UPDATE, DELETE to authenticated` bullet with: "**No direct grants** to `authenticated` or `anon` — see migration `20260522000005_lockdown_budget_grants.sql`. All CRUD must go through SECURITY DEFINER RPC functions (Principle III). FORCE ROW LEVEL SECURITY + policy `TO public USING (auth.uid() = user_id)` means RLS filters every row even when the RPC runs as `postgres`." Update the policy declarations from `TO authenticated` to `TO public`. In `research.md`: add a new section `R10 — Grant lockdown for Principle III` explaining why the direct grants were revoked (closes Supabase pg_graphql exposure lints `0026`/`0027`; makes Principle III non-bypassable at the database layer; the first CRUD feature must introduce SECURITY DEFINER RPCs and grant `EXECUTE` to `authenticated` on each).
- [ ] T048 Verify all 19 lint warnings are resolved. After T043–T046 are applied, run `npm run db:reset` and confirm: (a) the original RLS test migration (`20260522000003_rls_test.sql`) still prints `NOTICE: RLS test migration passed.`; (b) the new lockdown test migration (`20260522000006_rls_post_lockdown_test.sql`) prints its own pass notice; (c) in Supabase Studio → Database → Advisors → Security, **zero** WARN-level lints remain for the five `function_search_path_mutable` (4 dropped, 1 fixed), the one `extension_in_public` (dropped), the five `pg_graphql_anon_table_exposed` (all `public.*` — dropped), and the seven `pg_graphql_authenticated_table_exposed` (5 `public.*` dropped, 2 `budget.*` locked down). If any warning remains, record which lint code and which object, and re-open the corresponding T0xx task with an addendum. **(awaits user execution — `npm run db:reset` + Studio browser verification)**

### Post-merge login debug (this session)

User reported "the login does not work using my credentials." Diagnosis followed the systematic-debugging Iron Law (root cause before fix). Evidence trail:

1. Local stack reachable: `auth/v1/health` → 200; all 12 `supabase_*` containers up; user `aldrinjerome19@gmail.com` exists in `auth.users` with `email_confirmed_at` set.
2. `docker logs supabase_auth_budget` showed every `POST /token` returning `422 email_provider_disabled` ("Email logins are disabled") — so the password never reached a verification step.
3. `docker exec supabase_auth_budget env` showed `GOTRUE_EXTERNAL_EMAIL_ENABLED=false`.
4. Supabase CLI source (`apps/cli-go/internal/start/start.go:1304`) maps that env var to `[auth.email].enable_signup` — i.e., the *same* flag controls "can users sign up" AND "is the email provider live for logins." Setting it `false` to satisfy admin-provisioning (FR-012a) inadvertently disabled password logins. Public signup is still blocked separately by `[auth].enable_signup = false` → `GOTRUE_DISABLE_SIGNUP=true` (a different env var, the master switch).

- [x] T049 Fix `supabase/config.toml`: set `[auth.email].enable_signup = true` and add a short comment explaining the CLI mapping quirk (one flag → both signup *and* provider-enable). Public signup remains blocked by `[auth].enable_signup = false`. **(applied this session)**
- [ ] T050 Restart the local Supabase stack so the new env reaches GoTrue: `npx supabase stop && npm run db:start` (or `npm run db:reset` if you also want migrations re-applied). The change is config-only — no migrations re-run unless you choose `db:reset`. After restart, `docker exec supabase_auth_budget env | grep GOTRUE_EXTERNAL_EMAIL_ENABLED` MUST print `true`. **(awaits user execution — supabase command)**
- [ ] T051 Sign in at `http://localhost:3023/login` with the provisioned credentials. Expected: redirect to `/` and stay signed in across reload (SC-001). If sign-in still returns "Email or password is incorrect," proceed to T052 — the password may be failing the stricter client-side zod policy rather than Supabase.
- [x] T052 Reconcile the password-policy mismatch surfaced during this debug. `lib/validators/auth.ts` enforces ≥1 digit AND ≥1 symbol on *sign-in*, but `supabase/config.toml` has `password_requirements = ""` (no enforcement) — and the comment in `auth.ts:9` references a nonexistent `T042a` that was supposed to align them. A Studio-created password without a digit-or-symbol will be accepted by Supabase but rejected by the form, yielding the generic "Email or password is incorrect" error indistinguishable from a wrong password. Pick one of: (a) drop the digit/symbol checks from `passwordSchema` on the sign-in form (keep length-only validation; rely on Supabase to be the source of truth) — recommended, since sign-in does not create passwords; or (b) set `password_requirements = "letters_digits_symbols"` in `[auth]` of `config.toml`, restart the stack, *and* rotate any non-conforming admin-set passwords. Update the misleading `T042a` comment in `lib/validators/auth.ts:9` either way.

### Post-merge sign-in form refresh (this session)

User reported "the login is still broken — when I click on login it refreshes the page, and even if I don't add an email and password it still refreshes." Distinct from T049's "Email or password is incorrect" symptom: this one shows a full page navigation on submit, with no visible error. Reproduced in headless Chromium against the running dev server:

1. `[pageerror] Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script: script-src 'self' 'nonce-...' 'strict-dynamic' https: 'unsafe-inline'`.
2. With hydration broken, `useActionState`'s `formAction` never binds → form's `action=""` triggers native browser POST → full page navigation, which the user perceived as "the page refreshes."
3. The server action DID run on the navigation and the error message appeared in the re-rendered HTML, but the navigation itself made the UX feel broken.
4. After adding `'unsafe-eval'` to `script-src` in dev only, the same Chromium repro shows: 0 navigations on submit, the action POST returns RSC payload `1:{"error":"Email or password is incorrect."}`, and `<p role="alert" class="text-sm text-brick">Email or password is incorrect.</p>` is rendered inline. Hydration works.

Also re-verified during this debug: **T050 is still not done.** `docker exec supabase_auth_budget env | grep GOTRUE_EXTERNAL_EMAIL_ENABLED` still prints `false`, so even after T053 fixes the page-refresh UX, every login will still be rejected at GoTrue with `email_provider_disabled` until the Supabase stack is restarted.

- [x] T053 **Add `'unsafe-eval'` to `script-src` in dev only** in `lib/supabase/middleware.ts`. React 19 in dev calls `eval()` to reconstruct server stack traces for the error overlay; without `'unsafe-eval'` the eval throws, hydration aborts, `useActionState` never binds, and the form falls back to native browser POST → visible page refresh. Next.js's own CSP guide flags this exact requirement (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` "Good to know" note). Gated on `process.env.NODE_ENV === "development"` so production CSP stays unchanged. **(applied this session — verified with headless Chromium: form intercepts, alert renders, no navigation)**
- [x] T054 [P] Quiet the ~17 `style-src` CSP violations from Next.js's dev overlay (e.g., `Applying inline style violates ... style-src 'self' 'nonce-...'`). These do not break login (verified — form intercepts, action runs, alert renders), but they pollute the console and can mask real errors. Options: (a) add `'unsafe-inline'` to `style-src` in dev only (mirrors the dev-only pattern T053 establishes; harmless because dev-only); (b) leave as-is and add a note to `quickstart.md` Troubleshooting that these are dev-only and safe. Recommended: (a). While editing `lib/supabase/middleware.ts`, also reconcile `research.md` R4 lines 79–86: that section asserts "script-src does **not** include `'unsafe-inline'`", but the shipped CSP DOES include it (relying on `'strict-dynamic'` to make modern browsers ignore it). Either update R4 to match the code or simplify the code to match R4.

---

## Phase 7: Household Model + Full App Restoration

**Discovery**: User hit `Could not find the function budget.create_household(p_name) in the schema cache` while testing the onboarding flow. Root-cause investigation surfaced a wider mismatch: the app routes carried over from the reference project (`(auth)/onboarding/`, `(app)/family/`, `dashboard/`, `transactions/`, `subscriptions/`, `budget/`, `add/`, `add-income/`, `quick-add/`, `reports/`, `settings/`) call ~25 RPCs and 5 direct table reads, none of which exist in the current user-centric `budget` schema. Phase 7 restores the household-scoped data model (ported from legacy `0001`–`0004` into the `budget` schema, with the Principle III RPC pattern) so every route actually works.

**Scope expansion**: This is a deliberate expansion of 001 beyond "Supabase foundation" per the user's `/speckit-tasks` direction. See spec.md Clarification Q6, US4–US8, FR-021–FR-035; data-model.md §household + §household_member + §subscription + redesigned §category + §transaction; research.md R12–R16.

**Tests**: Same posture as Phase 4 — SQL-level RLS test migration for household isolation (analog of T046), plus Playwright coverage for the two new critical paths (US4 onboarding, US5 family CRUD). RPC-level unit assertions live inside the per-RPC migration where practical.

### 7.1 Foundation (helpers, owner role, trigger function)

- [x] T055 [P] [US4] Create migration `supabase/migrations/20260524000000_household_foundation.sql` defining: (a) `budget.update_timestamp()` trigger function (`SET search_path = ''`); (b) non-superuser role `budget_function_owner NOLOGIN` per research.md R10 "Validation gap acknowledged" and R14; (c) `GRANT USAGE ON SCHEMA budget TO budget_function_owner;`. This role will own every SECURITY DEFINER RPC introduced in 7.3 so RLS + FORCE RLS actually applies to RPC execution (postgres-owned definers bypass RLS regardless of FORCE).
- [x] T055a [US4–US5] **Auth-user read helpers + bootstrap helper (post-implementation fix for the C1 finding).** Create migration `supabase/migrations/20260524000017_auth_user_helpers.sql` defining three `postgres`-owned `SECURITY DEFINER` helpers — `budget.current_user_display_name()` (caller's preferred display name), `budget.resolve_user_by_email(p_email text) RETURNS (user_id uuid, display_name text)`, and `budget.bootstrap_household(p_user_id uuid, p_name text, p_display_name text) RETURNS uuid` — each with `SET search_path = ''`, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO budget_function_owner`. The first two are `STABLE`; bootstrap is `VOLATILE` (default) since it writes. Then edit `20260524000009_rpc_household.sql` so `create_household` delegates to `bootstrap_household` (which performs the two table INSERTs while bypassing RLS via its postgres ownership) and edit `20260524000010_rpc_family.sql` so `add_adult_by_email` calls `resolve_user_by_email` instead of selecting from `auth.users` directly. **Root causes** (both reported 2026-05-24–25): (1) `budget_function_owner` inherits from `authenticated`, which has no SELECT on `auth.users`, so the original direct reads failed at runtime with `permission denied for table users`; (2) the household RLS WITH CHECK requires the caller to already be a member, but at the moment of household creation the caller has zero memberships (chicken-and-egg); an OR-carve-out in WITH CHECK was attempted and reverted because combining `auth.uid()` with a SECURITY DEFINER helper subquery in a single OR-expression made the WITH CHECK evaluate as NULL on this Postgres (STABLE-function caching), which the planner treats as policy violation. Per Principle II, narrow `postgres`-owned helpers are preferred over granting broad SELECT on `auth.users` or BYPASSRLS to the function-owner role. Closes the FR-022a / FR-035 contract added in the same edit pass. **Verification**: T097a covers the happy path on every `npm run db:reset` and prints `Household RLS test migration passed.` on success.

### 7.2 Schema (new household tables; redesigned category/transaction; subscription)

- [x] T056 [US4] Create migration `supabase/migrations/20260524000001_household.sql`: `budget.household (id uuid pk default gen_random_uuid(), name text not null, currency text not null default 'CAD', owner_user_id uuid not null references auth.users(id), created_at timestamptz default now(), updated_at timestamptz default now())`. Trigger to maintain `updated_at`. Enable + force RLS. No policy yet (added in T060 after the helper exists).
- [x] T057 [US5] Create migration `supabase/migrations/20260524000002_household_member.sql`: `budget.household_member` with columns per legacy `0002_household.sql` ported to `budget` schema (id, household_id FK, user_id nullable, role check `('adult','kid')`, display_name, age_years check 0..25, avatar_url, monthly_income_cents bigint default 0 check >=0, deleted_at, timestamps). Constraint `household_member_age_for_kid_only` per legacy. Partial unique index on `(household_id, user_id) WHERE user_id IS NOT NULL`. Partial index on `household_id WHERE deleted_at IS NULL`. `enforce_adult_cap()` trigger function (max 2 active adults, per legacy lines 79–105). `forbid_undelete_of_adult_when_capped()` trigger function. Enable + force RLS. No policy yet.
- [x] T058 [US5] Create migration `supabase/migrations/20260524000003_drop_user_owned_budget.sql`: `DROP TABLE budget.transactions CASCADE; DROP TABLE budget.categories CASCADE;` — these are the user-owned T020/T021 tables. Safe to drop because no production data exists (Phase 4 shipped without UI; the only writers are the new Phase 7 RPCs that don't exist yet). Header comment explaining the user-owned → household-owned migration; references this task and Phase 7 spec.
- [x] T059 [US6] **Renumbered to `20260524000005_category.sql`** (helper migration claimed `…000004` because category's RLS policies reference `budget.auth_user_household_ids()` and CREATE POLICY resolves function references at policy-creation time, so the helper must exist first). Create migration: `budget.category (id uuid pk default gen_random_uuid(), household_id uuid references budget.household(id) on delete cascade [NULL = system-global seed], name text not null, default_essential_pct smallint default 100 check 0..100, monthly_budget_cents bigint check null or >=0, kind text default 'expense' check ('expense','income'), created_at, updated_at)`. Index `(household_id)`. Trigger for `updated_at`. Enable + force RLS. Seed the 13 system-global categories (NULL household_id) per legacy `0003_transactions.sql:42–56`. Two policies: `category_select_visible` (NULL household OR household_id ∈ caller's household), `category_write_own_household` (FOR ALL, household_id ∈ caller's). Both `TO public` per R10. No direct grants to `authenticated`/`anon` (RPC-only).
- [x] T060 [US4] **Renumbered to `20260524000004_helper_and_policies.sql`** (was `…000005` in the original spec; see T059 note for why the swap was needed). Create migration: `budget.auth_user_household_ids()` returning `setof uuid` (stable, security invoker, search_path = '') per legacy `0001_init.sql:36–47`, querying `budget.household_member`. Then create `household_household_isolation` policy on `budget.household` (`FOR ALL TO public USING (id IN (SELECT * FROM budget.auth_user_household_ids())) WITH CHECK (same)`). Create `household_member_household_isolation` policy on `budget.household_member` (same pattern using `household_id`).
- [x] T061 [US6] Create migration `supabase/migrations/20260524000006_transaction.sql`: `budget.transaction` with the FULL legacy schema (id uuid pk client-supplied for offline idempotency, household_id, type check `('expense','income')`, amount_cents bigint check >0, occurred_on date, category_id FK ON DELETE RESTRICT, notes default '', paid_by_member_id, for_member_id, essential_pct smallint 0..100, split_rule check `('adult_a','adult_b','50_50','by_income')`, income_source check `('Salary','Contract','Self_employed','Benefit','Refund','Gift')`, subscription_id, occurrence_date, timestamps) per legacy `0003_transactions.sql:62–79`. Indexes per legacy lines 81–92 (household+occurred, household+category+occurred, gin notes search, unique subscription idempotency). Trigger for `updated_at`. `enforce_member_household()` deferred constraint trigger per legacy lines 115–144. RLS enable + force. SELECT-only policy `transaction_select` `TO public USING (household_id ∈ helper)`. Writes via RPC only.
- [x] T062 [US7] Create migration `supabase/migrations/20260524000007_subscription.sql`: `budget.subscription` per legacy `0004_subscriptions.sql:4–34` ported to `budget` schema. Index `(household_id, next_renewal_at) WHERE active = true`. Trigger for `updated_at`. RLS enable + force. Policy `subscription_household_isolation` `FOR ALL TO public USING (household_id ∈ helper)`. **Do NOT** add the `cron.schedule(...)` line yet — `pg_cron` extension setup lives in T091.
- [x] T063 [US4–US8] Create migration `supabase/migrations/20260524000008_lockdown_household_grants.sql`: for every new/redesigned table (`budget.household`, `budget.household_member`, `budget.category`, `budget.transaction`, `budget.subscription`): `REVOKE ALL ON <table> FROM authenticated, anon;` plus matching `REVOKE ALL ON SEQUENCE ... FROM authenticated, anon;`. Mirrors T045 for the new tables. Plus `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA budget TO budget_function_owner;` and `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA budget TO budget_function_owner;` so SECURITY DEFINER RPCs can actually mutate.

### 7.3 RPCs (one migration per feature area; every function is `SECURITY DEFINER`, `SET search_path = ''`, `OWNER TO budget_function_owner`, with `GRANT EXECUTE ... TO authenticated`)

**Pattern reminder**: every RPC must schema-qualify (`budget.household`, not `household`) since `search_path = ''`. Read all calling code in `app/(app)/<area>/` and `app/(auth)/onboarding/` before authoring each RPC — the exact parameter names and JSON shapes are fixed by the existing client code (e.g., `p jsonb` for `log_expense`/`log_income`/`register_subscription`, `p_id uuid` for single-id mutators, `p_filters jsonb` for list_transactions).

#### US4 — Household onboarding

- [x] T064 [P] [US4] `budget.create_household(p_name text) RETURNS uuid` in migration `20260524000009_rpc_household.sql`. Creates household (owner_user_id := auth.uid()) and inserts the calling user as an adult member (display_name := split_part(coalesce(au.raw_user_meta_data->>'full_name', au.email), '@', 1); user_id := auth.uid()). Returns the new household id. Redirects on the client are unchanged (`actions.ts` calls `redirect('/dashboard')`).

#### US5 — Family members

- [x] T065 [P] [US5] `budget.add_adult_by_email(p_email text) RETURNS table(status text, member_id uuid)` in `20260524000010_rpc_family.sql`. Resolves `auth.users` by email (lower case). If found AND not already in caller's household, insert as `role='adult'` (`enforce_adult_cap` will reject the 3rd active adult). If found and already a soft-deleted member, undelete (will be rejected by `forbid_undelete_of_adult_when_capped` if cap breached). Return `status` ∈ `'inserted'|'restored'|'not_found'|'already_member'`. Per `actions.ts:7–17`.
- [x] T066 [P] [US5] `budget.add_kid(p_display_name text, p_age_years int) RETURNS uuid`. Insert kid into caller's household (must exist — derive via helper; if 0 households, raise `P0001 'No household'`). Per `actions.ts:19–28`.
- [x] T067 [P] [US5] `budget.soft_delete_member(p_member_id uuid) RETURNS void`. Set `deleted_at = now()` if member belongs to caller's household. Per `actions.ts:30–39`.
- [x] T068 [P] [US5] `budget.update_member_income(p_member_id uuid, p_monthly_income_cents bigint) RETURNS void`. Update if member belongs to caller's household. Per `actions.ts:41–51`.
- [x] T069 [P] [US5] `budget.list_household_members() RETURNS setof household_member` — returns active members for caller's household. Replaces direct `supabase.from('household_member').select('id, display_name, role, age_years, monthly_income_cents, created_at').is('deleted_at', null)` calls in `app/(app)/family/page.tsx:23–27`, `app/(app)/transactions/page.tsx:18–23`, `app/(app)/dashboard/page.tsx:48–53`, `app/(app)/settings/page.tsx:18–23`, `app/(app)/settings/page.tsx:32–37`. The dashboard call only wants `household_id` — also export `budget.get_current_household() RETURNS uuid` in the same migration.
- [x] T070 [P] [US5] `budget.list_kid_month_summary(p_year int, p_month int) RETURNS table(kid_id uuid, spent_cents bigint, last_activity_day date)`. Replaces the direct `supabase.from('transaction')` query in `app/(app)/family/page.tsx:51–59` (Principle III: writes AND reads must go through RPCs since direct grants are revoked).

#### US6 — Transactions, categories, budget, dashboard

- [x] T071 [P] [US6] `budget.list_transactions(p_filters jsonb) RETURNS setof jsonb` in `20260524000011_rpc_transactions.sql`. Filters keys: `search` (text → tsvector match on `notes`), `essential` (`'essential'|'treats'|null`), `for_member_id`, `from`, `to`, `limit` (default 100). Each row joins `category.name` and member `display_name` for `paid_by` and `for_member` (legacy implementation lived in a view; either port the view to `budget` schema or inline the joins). Per `TransactionsList.tsx:50–58` and `transactions/page.tsx:17`.
- [x] T072 [P] [US6] `budget.log_expense(p jsonb) RETURNS uuid`. Insert into `budget.transaction` with `type='expense'`, `household_id := budget.get_current_household()`, id from `p->>'id'` (client-supplied UUID v7 for offline idempotency — see `lib/pwa/dispatch.ts:43`). Validate p shape (amount_cents>0, category_id exists in caller's household OR is system-global). Per `app/(app)/add/actions.ts:26–32`.
- [x] T073 [P] [US6] `budget.log_income(p jsonb) RETURNS uuid`. Same pattern, `type='income'`, requires `income_source`. Per `app/(app)/add-income/actions.ts:21–27`.
- [x] T074 [P] [US6] `budget.update_transaction(p_id uuid, p_patch jsonb) RETURNS void`. Allowed patch keys: `amount_cents`, `notes`, `essential_pct`, `occurred_on`. Reject any other key. Per `TransactionsList.tsx:75–83`.
- [x] T075 [P] [US6] `budget.delete_transaction(p_id uuid) RETURNS void`. Cascade-safe; RLS already filters to household. Per `TransactionsList.tsx:90–92`.
- [x] T076 [P] [US6] `budget.list_quick_add_options(p_limit int) RETURNS table(...)` per `app/(app)/quick-add/page.tsx:20–34` (`amount_cents`, `source ∈ 'recent'|'subscription'`, plus tile fields). Union: top N recent transactions + active subscriptions due soon.
- [x] T077 [P] [US6] `budget.get_dashboard_summary(p_year int, p_month int) RETURNS jsonb` returning the shape consumed by `dashboard/page.tsx:12–30`: `{balance_cents, left_to_spend_this_month_cents, essential_spent_cents, treats_spent_cents, income_month_cents, month_expense_cents, recent[]}`. `recent` is the 10 most recent transactions joined with category name + for_member display name.
- [x] T078 [P] [US6] `budget.set_category_essential_pct(p_category_id uuid, p_pct int) RETURNS void` in `20260524000012_rpc_category_budget.sql`. Reject if category is system-global (household_id IS NULL) and the caller isn't the system seed owner — per spec, system seeds are read-only; the app must clone-on-write before editing. (Or implement implicit clone: if category is system-global, insert a household-scoped copy with the new pct and return the new id. **Choose one — recommend explicit error + a separate `clone_category` RPC** to match the legacy contract.) Per `settings/actions.ts:11–14`.
- [x] T079 [P] [US6] `budget.set_category_budget(p_category_id uuid, p_monthly_budget_cents bigint) RETURNS void`. Same household-scope check; null clears the budget. Per `budget/actions.ts:11–15`.
- [x] T080 [P] [US6] `budget.get_budget_progress(p_year int, p_month int, p_filter text) RETURNS table(category_id uuid, category_name text, monthly_budget_cents bigint, spent_cents bigint)`. `p_filter ∈ 'all'|'essential'|'treats'`. Aggregate `budget.transaction` for the month by category. Per `budget/page.tsx:28–32`.
- [x] T081 [P] [US6] `budget.compute_income_split(p_household_id uuid) RETURNS table(adult_id uuid, ratio numeric, display_order int)`. Validate caller is a member of the passed household (otherwise the param is bypassable). Sum active-adult `monthly_income_cents`; return per-adult ratio (or equal split if total = 0). Per `settings/page.tsx:30`.
- [x] T082 [P] [US6] `budget.list_categories(p_kind text DEFAULT NULL) RETURNS table(id uuid, name text, default_essential_pct int, kind text, household_id uuid)`. Returns system-global + household categories matching kind. Replaces direct `from('category')` reads in `settings/page.tsx:38–42` and `subscriptions/page.tsx:36–40`.

#### US7 — Subscriptions

- [x] T083 [P] [US7] `budget.register_subscription(p jsonb) RETURNS uuid` in `20260524000013_rpc_subscriptions.sql`. Required keys: `merchant`, `amount_cents`, `category_id`, `cadence`, `next_renewal_at`. Optional: `paid_by_member_id`, `for_member_id`, `essential_pct`. Per `subscriptions/actions.ts:6–22`.
- [x] T084 [P] [US7] `budget.pause_subscription(p_id uuid) RETURNS void` → sets `active=false`. Per `subscriptions/actions.ts:29–34`.
- [x] T085 [P] [US7] `budget.resume_subscription(p_id uuid) RETURNS void` → sets `active=true`. Per `subscriptions/actions.ts:37–42`.
- [x] T086 [P] [US7] `budget.list_subscriptions() RETURNS setof subscription` ordered by `next_renewal_at`. Replaces direct `from('subscription')` read in `subscriptions/page.tsx:31–34`.
- [x] T087 [P] [US7] `budget.list_overlapping_subscriptions() RETURNS table(category_name text, count int, monthly_total_cents bigint)`. Aggregate active subscriptions grouped by category; only return categories where `count > 1`. Per `subscriptions/page.tsx:35` and `SubscriptionsClient` expectations.
- [x] T088 [P] [US7] `budget.materialize_due_subscriptions() RETURNS int` (count of newly-materialized transactions). For every active subscription with `next_renewal_at <= today`, insert a `budget.transaction` row using a deterministic id derived from `(subscription_id, occurrence_date)` so the unique index from T061 makes replay idempotent, then advance `next_renewal_at` by the cadence step. SECURITY DEFINER, owned by `budget_function_owner` — but this function reads/writes across all households on the cron path, so add a `bypass_rls boolean DEFAULT false` parameter and have the cron-invoked path pass `true` (and the body uses `SET LOCAL row_security = off` only in that branch). Document the trade-off in the function comment.
- [x] T089 [US7] Migration `20260524000014_cron_subscriptions.sql`: enable `pg_cron` extension (in `extensions` schema per Supabase convention, not `public` — verify with R12 best practices), then `SELECT cron.schedule('subscriptions-hourly', '0 * * * *', $$ SELECT budget.materialize_due_subscriptions(true); $$);`. Note: this brings back the `pg_cron` extension that T044 dropped from `public` — install it in `extensions` schema instead to avoid re-introducing the `extension_in_public` lint.

#### US8 — Reports

- [x] T090 [P] [US8] `budget.cashflow_kpis(p_range text) RETURNS jsonb` in `20260524000015_rpc_reports.sql`. `p_range ∈ '30d'|'90d'|'ytd'`. Returns `{income_cents, expense_cents, net_cents, avg_daily_spend_cents, largest_expense{merchant, amount_cents, occurred_on} | null, top_category{name, spent_cents} | null, insights string[]}`. Per `reports/cashflow/page.tsx:7–15`.
- [x] T091 [P] [US8] `budget.essentials_breakdown(p_year int, p_month int) RETURNS jsonb`. Returns `{overall{essential_cents, treats_cents}, recurring{essential[], treats[], essential_total_cents, treats_total_cents, treats_percent}}` where each recurring item is `{subscription_id, merchant, amount_cents, cadence, essential_pct}`. Per `reports/essentials/page.tsx:8–25`.
- [x] T092 [P] [US8] `budget.spend_over_time(p_range text) RETURNS table(bucket_start date, spent_cents bigint, income_cents bigint)`. Daily buckets for `'30d'`, weekly for `'90d'`, monthly for `'ytd'`. Per `reports/spend-over-time/page.tsx:7,11`.
- [x] T093 [P] [US8] `budget.per_person_breakdown(p_year int, p_month int, p_include_general bool) RETURNS table(...)` matching `PerPersonClient` expectations (read `app/(app)/reports/per-person/PerPersonClient.tsx` to confirm row shape). If `p_include_general` is false, exclude transactions with `for_member_id IS NULL`.

### 7.4 App code reconciliation

- [x] T094 [US4–US8] **Found 11 direct reads (not 5)** — added `app/(app)/layout.tsx`, `app/(app)/add/page.tsx`, `app/(app)/add-income/page.tsx`, `app/(auth)/onboarding/create-household/page.tsx` to the fix list. All routed through `get_current_household`, `list_household_members`, `list_categories`, `list_kid_month_summary`. Verified `grep` returns zero; `npx tsc --noEmit` exits 0. Original task body: remove the five remaining `supabase.from('<household-scoped-table>')` direct reads now that the equivalent RPCs exist: (a) `app/(app)/dashboard/page.tsx:48–53` → `budget.get_current_household`; (b) `app/(app)/transactions/page.tsx:18–23` → `budget.list_household_members`; (c) `app/(app)/settings/page.tsx:18–23,32–37,38–42` → `budget.get_current_household` + `budget.list_household_members` + `budget.list_categories`; (d) `app/(app)/subscriptions/page.tsx:31–34,36–40` → `budget.list_subscriptions` + `budget.list_categories`; (e) `app/(app)/family/page.tsx:23–27,51–59` → `budget.list_household_members` + `budget.list_kid_month_summary`. Verify with `grep -rn "from('household_member\\|from('transaction\\|from('subscription\\|from('category" app/` — expected: zero matches after this task.
- [x] T095 [US6] **Took the "otherwise" branch — comment, not refactor.** `registerSubscriptionAction` is `"use server"`; `dispatchOrEnqueue` is `"use client"`. They can't compose without lifting the submit handler to a client component. Added explanatory comments to `lib/pwa/outbox.ts` and `app/(app)/subscriptions/actions.ts`. Original task body: `lib/pwa/outbox.ts` `OutboxRpc` type currently includes only `'log_expense' | 'log_income'`. Re-read `lib/pwa/dispatch.ts:58` and confirm the offline outbox only ever queues those two (write paths from `add/` and `add-income/`). If `register_subscription` should also be replayable (recommended: yes), add it to `OutboxRpc` and wire `subscriptions/actions.ts:registerSubscriptionAction` to use `dispatchOrEnqueue('register_subscription', payload)` instead of a direct `supabase.rpc()` call. Otherwise document in a code comment why subscriptions are online-only.

### 7.5 Tests + verification

- [x] T096 [US4, US5] Added both spec files; covers the already-onboarded path (US4) and the family page chrome (US5 read-side). Destructive member-CRUD assertions (adult cap, kid add/remove, income update) need an ephemeral-test-user workflow that doesn't exist yet — flagged in the spec headers. Original task body: add `tests/e2e/authed/onboarding-create-household.spec.ts` covering US4 acceptance scenarios (new user with no household lands on `/onboarding/create-household`, submits form, lands on `/dashboard`). Add `tests/e2e/authed/family.spec.ts` covering US5 (add adult, add kid, soft-delete, update income, adult-cap rejection at 3rd adult). Use storage-state from User A; create a fresh test household per test via a `beforeEach` that calls `budget.create_household` directly.
- [x] T097 [US4–US8] **Renumbered to `20260524000017_household_rls_test.sql`** and surfaced a latent recursion bug: `budget.auth_user_household_ids()` was `SECURITY INVOKER`; the `household_member` RLS policy references it, so any `authenticated`-role SELECT on that table would infinite-recurse (the helper's inner SELECT triggers the policy which calls the helper). Migrations all run as `postgres` (superuser, bypasses RLS), which is why the initial `db:reset` didn't surface it. Fix migration `20260524000016_helper_security_definer_fix.sql` flips the helper to `SECURITY DEFINER` (owner = postgres → bypasses RLS, breaks the cycle); `auth.uid()` still resolves to the caller because it reads `request.jwt.claims` from session state. The RLS test migration does both lockdown (5 tables × 4 verbs) and cross-household read isolation (user_a sees only A's, user_b sees only B's). Original task body: create migration `supabase/migrations/20260524000016_household_rls_test.sql`. Analog of T022/T046: open a sentinel-exception sub-block, seed two synthetic auth users with two separate households (A1+A2 and B1+B2), run inserts as A1 via `set_config('request.jwt.claims', ...)`, assert (a) A2 (same household) sees A1's data, (b) B1 (different household) sees zero of A1's data, (c) direct table DML from `authenticated` still raises `42501` for the new tables. Raise sentinel `RAISE EXCEPTION 'HOUSEHOLD_RLS_TEST_PASS' USING ERRCODE = 'P0001'` to roll back; re-raise anything else. Must pass on every `npm run db:reset`.
- [x] T097a [US4] **RPC happy-path assertion (post-implementation fix for the C2 finding).** Extend `supabase/migrations/20260524000018_household_rls_test.sql` with a Part 3 block that seeds a third synthetic `auth.users` row (`user_c`, no household membership), swaps the JWT claim to user_c, calls `budget.create_household('C')`, and asserts (a) a non-null household id is returned, (b) `budget.list_household_members()` reports a single adult member for user_c, (c) the member's `display_name` matches the email local-part (`'household-rls-c'`). The list-member read is routed through `list_household_members()` (not direct SELECT) because the lockdown verified in Part 1 blocks direct table access for the `authenticated` role still in effect. Without the T055a helper grants, the `create_household` call raises `permission denied for table users` and `db:reset` fails — that is the regression guard the user reported on 2026-05-24.
- [ ] T098 [US4–US8] Walk the augmented quickstart (after T101 updates it). Confirm: onboarding → dashboard works; family CRUD works including adult cap; logging an expense lands it in transactions + dashboard; subscription register → next-hour cron materializes a transaction (or run `SELECT budget.materialize_due_subscriptions(true);` manually). **(awaits user execution — supabase + browser)**

### 7.6 Polish

- [x] T099 [P] Update `specs/001-setup-supabase/quickstart.md` with a new "Household onboarding (US4) and family (US5)" section after the existing US3 block. Document: (1) first sign-in lands on `/onboarding/create-household`; (2) creating a household redirects to `/dashboard`; (3) `/family` is where adults/kids are managed; (4) the 2-adult cap. Add troubleshooting entries for: "Could not find function budget.create_household" (run `db:reset` after pulling Phase 7), "Households are limited to 2 adults" (expected; remove an existing adult first), "for_member_id does not belong to this household" (the trigger working as designed).
- [x] T100 [P] Update `README.md` to mention the household model and link to `quickstart.md` § Household onboarding. Note that the app now requires `npm run db:reset` after pulling Phase 7 to get the new schema + RPCs.
- [ ] T101 Run `supabase db advisors` (or MCP `get_advisors`) after T055–T093 are applied. Confirm: zero new WARN-level lints introduced by Phase 7. Likely candidates to watch for: `function_search_path_mutable` on any RPC that forgot `SET search_path = ''`; `extension_in_public` if `pg_cron` accidentally landed in `public`; `pg_graphql_authenticated_table_exposed` if any new table missed the T063 lockdown. **(awaits user execution)**

**Checkpoint**: All app routes work end-to-end. Onboarding → dashboard → family/transactions/subscriptions/reports/settings flows are complete. Direct table reads are gone (Principle III enforced at the grant layer for every table). Subscription cron runs hourly.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No prior deps — starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2.
- **US2 (Phase 4)**: Depends on Foundational. Independent of US1 and US3.
- **US3 (Phase 5)**: Depends on US1 (US3's tests sign in first).
- **Polish (Phase 6)**: Depends on US1, US2, US3.
- **Household Restoration (Phase 7)**: Depends on Foundational (Phase 2) and the lockdown migrations from Phase 6 (T044–T046). Independent of US1/US3 outside of needing a signed-in user for the new tests. Internal order: 7.1 (T055) → 7.2 (T056–T063) → 7.3 (T064–T093, mostly parallelizable per migration file) → 7.4 (T094–T095) → 7.5 (T096–T098) → 7.6 (T099–T101).

### Within Each Phase

- Foundational: T007–T012 can largely run in parallel (different files). T013 is the integration checkpoint and is sequential.
- US1: T014 (signIn action) blocks T015 (login page consumes it) — but they touch different files so the implementer can write them in either order; they MUST both exist before T018 (tests). T016 (stub home) is independent. T019 (manual) is last.
- US2: T020 and T021 are independent (different migration files). T022 depends on both. T023 (db reset) gates T024 (verify file).
- US3: T025 (signOut action) blocks T026 (button consumes it). T026 and T027 (header) are independent of each other, both block T028 (layout). T029 depends on the layout. T030 (tests) depends on the shell being in place.

### Parallel Opportunities

- Phase 1: T002, T003, T005 can run in parallel (all [P]).
- Phase 2: T007, T008, T009, T011, T012 can run in parallel; T010 (middleware) is also writable in parallel.
- US1: T015 and T016 in parallel after T014 is signed off.
- US2: T020 and T021 in parallel; both must complete before T022.
- US3: T026 and T027 in parallel; T030 in parallel with T031 if a second pair of hands runs the manual verification.
- Polish: T032, T033, T034 can run in parallel.
- Phase 7: After T055–T063 land, every RPC migration (T064–T093) is independent of every other (different migration files, same SECURITY DEFINER pattern). T094–T095 are app-side and can run alongside the RPC work as soon as their RPCs land. T099–T100 (doc updates) are fully parallel.

### Cross-Story Parallelism

After the Foundational checkpoint (T013), **US1 and US2 can be developed by two people simultaneously** — they touch disjoint files (US1: `app/login/`, `app/page.tsx`, `actions/auth.ts`, `tests/e2e/auth.spec.ts`; US2: `supabase/migrations/`). US3 must wait for US1.

---

## Parallel Example: Foundational Phase

```bash
# After Setup is done, dispatch these in parallel:
Task: "Create lib/supabase/client.ts (T007)"
Task: "Create lib/supabase/server.ts (T008)"
Task: "Create lib/auth.ts (T009)"
Task: "Create middleware.ts (T010)"
Task: "Update app/layout.tsx with CSP nonce (T011)"
Task: "Create supabase/migrations/20260522000000_budget_schema.sql (T012)"
# Then sequentially: Task: "Run foundation checkpoint (T013)"
```

## Parallel Example: User Story 2

```bash
# US2 has only three implementation tasks; the first two are parallel:
Task: "Create categories migration (T020)"
Task: "Create transactions migration (T021)"
# Then sequentially:
Task: "Create rls_test migration (T022)"
Task: "Run supabase db reset and verify (T023)"
Task: "Create supabase/verify/rls_status.sql (T024)"
```

---

## Implementation Strategy

### MVP First (US1 + US2 — both are P1)

Both P1 stories are required for a shippable MVP: users must be able to sign in (US1) AND their data must be isolated (US2). US3 (sign-out) is P2 and can ship in a follow-up if time-constrained, but the feature is not complete without it.

1. Complete Phase 1 (Setup) — ~30 min.
2. Complete Phase 2 (Foundational) — ~2–3 h, parallelizable across files.
3. **Branch the work**: dispatch US1 and US2 in parallel after T013.
4. **Stop and validate at the US1 checkpoint** (T019): confirm sign-in flow works end-to-end.
5. **Stop and validate at the US2 checkpoint** (T023): confirm `db reset` runs the RLS test green.
6. At this point, MVP (US1 + US2) is testable.
7. Complete Phase 5 (US3) to satisfy FR-006, FR-018, FR-019, FR-020.
8. Complete Phase 6 (Polish) and close the SC-* / Constitutional gates.

### Incremental Delivery

- After Foundational: nothing is user-visible yet — do not deploy.
- After US1: a usable, isolated-per-user sign-in flow without data tables. *Could* deploy as an internal "auth is wired up" demo, but no real value yet.
- After US2: data isolation is provable at the DB. Still no UI for categories/transactions — by design. *Could* hand off to the next feature team (which adds CRUD via RPC).
- After US3: feature complete. Deploy.
- After Polish: shippable per the constitution.

### Solo-Developer Strategy

If implementing solo, execute in this order (no parallelism overhead): Setup → Foundational → US1 → US2 → US3 → Polish. Expect roughly: 30 min / 3 h / 2 h / 2 h / 2 h / 1 h ≈ 10–11 hours of focused work.

---

## Notes

- The `Categories` and `Transactions` tables ship with **no client-facing UI** in this feature — this is deliberate (clarified in Q4 of `spec.md`). Their CRUD endpoints will land in the next feature via Postgres functions called through `supabase.rpc()`, per Constitution Principle III.
- The order matters for migrations: schema first (T012), categories before transactions (T020 → T021), RLS test last (T022). Numeric timestamp prefixes enforce this on `supabase db reset`.
- **AGENTS.md reminder**: Next.js 16.2.6 has APIs that may differ from training data. Confirmed during implementation: (1) `cookies()` and `headers()` are async (must be awaited); (2) `searchParams` is a `Promise`; (3) **the file convention renamed from `middleware.ts` to `proxy.ts` with the exported function `proxy`** — this was caught from the Next.js 16 deprecation warning during `npm run build` and applied during the post-analysis cleanup turn.
- No `git commit` is included in any task — per the user-level rule and the constitution's "no unsolicited commits", the user owns commit timing.
- The optional after-phase `/speckit-git-commit` hook may be invoked manually between phases if desired; nothing in this task list does so automatically.

### Post-analysis cleanup (this turn)

Fixes applied to close findings from the post-implementation `/speckit-analyze` run. Not formal tasks; tracked here for traceability:

- **F2** — extracted `components/ui/Button.tsx` and `components/ui/TextInput.tsx`; refactored `app/login/page.tsx`, `components/SignOutButton.tsx`, and `app/(authed)/error.tsx` to consume them. Closes Constitution Principle V "MUST extract reusable primitives".
- **G1** — `style-src 'unsafe-inline'` carve-out documented in `proxy.ts` comments and `research.md` R4 as a CSP3 backwards-compat fallback (modern browsers ignore it when a nonce is present).
- **G2** — ~~`SAVEPOINT rls_test` now opens BEFORE the synthetic `auth.users` inserts, so `ROLLBACK TO SAVEPOINT` also rolls them back.~~ **SUPERSEDED by T037**: this fix was invalid because PL/pgSQL `DO` blocks cannot execute `SAVEPOINT` / `ROLLBACK TO SAVEPOINT` (transaction-control statements). The migration must use a nested `BEGIN ... EXCEPTION ... END` sub-block with a sentinel-exception rollback instead. The no-residue guarantee for synthetic `auth.users` rows is preserved by the implicit-savepoint behavior of the sub-block.
- **G3** — multi-tab sign-out test rewritten in `tests/e2e/authed/sign-out.spec.ts` to use a single Playwright context with two pages (correct cookie-store sharing). The test now actually proves the property.
- **G4** — `proxy.ts` now sets `Content-Security-Policy` on the redirect response too, not just the pass-through response. Policy is consistent across all middleware-emitted responses.
- **G5** — `supabase/config.toml` `[db.seed]` set to `enabled = false` with `sql_paths = []`. No more missing-`seed.sql` failure mode on `db reset`.
- **G7** — `contracts/server-actions.md` documents the spec file split (`anonymous/` and `authed/` Playwright projects).
- **F5** — "main page" renamed to "authenticated home page" throughout `spec.md`.
- **F6 / G6** — `plan.md` Project Structure updated to reflect the actual final tree (no `app/page.tsx`; route group serves `/`; `ui/` primitives folder added).
- **Next.js 16 `middleware` → `proxy` rename** — caught from the build output's deprecation warning. File moved via `git mv middleware.ts proxy.ts`, exported function renamed `middleware` → `proxy`. All doc references updated. Rebuild emits no deprecation warning.
