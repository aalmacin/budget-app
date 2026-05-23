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
- [x] T010 Create `middleware.ts` at the repo root. Behavior: (a) construct a request-scoped Supabase server client bound to `request.cookies`; (b) call `supabase.auth.getUser()` and write any refreshed cookies into the response; (c) if no user and `request.nextUrl.pathname` does not start with `/login`, return `NextResponse.redirect(new URL('/login', request.url))`; (d) generate a per-request nonce via `crypto.randomUUID()` and set `Content-Security-Policy` and an `x-nonce` request header for downstream Server Components. Export `config.matcher` matching everything except `_next/static`, `_next/image`, `favicon.ico`, and `public/` assets.
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
- [ ] T023 [US2] Run `npx supabase db reset` (depends on T020, T021, T022, and Foundational T012). Confirm: all migrations apply in order, the RLS test migration prints no error, `SELECT * FROM pg_policies WHERE schemaname='budget'` returns the two owner policies. This verifies SC-002 and SC-005. **(awaits user execution — supabase command)**
- [x] T024 [US2] Create `supabase/verify/rls_status.sql` containing the two introspection queries from `quickstart.md` US2 (table+rowsecurity + policy list). This is not run automatically — it is a copy-pasteable verification artifact for ops/review.

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
- [ ] T034 [P] Run `npx tsc --noEmit` from the repo root and confirm zero type errors. Run `npm run lint` and confirm zero new warnings/errors. Closes Constitution Principle I (no `any`, strict types). **(awaits user execution — requires `npm install` first)**
- [ ] T035 Run the full Playwright suite: `npm run test:e2e`. All US1 and US3 specs must pass. Closes Constitution Principle IV. **(awaits user execution — requires running app + provisioned users)**
- [ ] T036 Walk the `quickstart.md` end-to-end as if a brand-new developer (use a sibling clone or `git worktree`). Time the path from clone to successful sign-in. Confirm under 15 minutes including the administrator step. Closes SC-004 definitively. **(awaits user execution)**

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
- **AGENTS.md reminder**: Next.js 16.2.6 has APIs that may differ from training data (`cookies()` is async, `searchParams` is a `Promise`, middleware CSP-nonce wiring is version-specific). When in doubt, read `node_modules/next/dist/docs/` before writing the relevant code in T008, T010, T011, and T015.
- No `git commit` is included in any task — per the user-level rule and the constitution's "no unsolicited commits", the user owns commit timing.
- The optional after-phase `/speckit-git-commit` hook may be invoked manually between phases if desired; nothing in this task list does so automatically.
