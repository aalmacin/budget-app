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

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No prior deps — starts immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. Blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2.
- **US2 (Phase 4)**: Depends on Foundational. Independent of US1 and US3.
- **US3 (Phase 5)**: Depends on US1 (US3's tests sign in first).
- **Polish (Phase 6)**: Depends on US1, US2, US3.

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
