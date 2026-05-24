# Quickstart: Budget App with Supabase Foundation

**Feature**: 001-setup-supabase
**Date**: 2026-05-22
**Audience**: a developer cloning this repo for the first time after this feature ships.

Goal — measured by SC-004 — is to reach a successful sign-in in **under 15 minutes**, including booting the local Supabase stack and creating your first user.

---

## Prerequisites

- Node 20+ and `npm` (already implied by Next.js 16).
- Docker (or OrbStack) running locally — the Supabase CLI needs it to boot a local stack.

This feature targets **local Supabase only**. A dedicated cloud Supabase project for the Budget app will be added in a later feature (see `research.md` R9). You do **not** need cloud credentials, an admin in a cloud dashboard, or a service-role key.

---

## One-time setup (≈ 10 minutes)

1. **Clone and install** (≈ 1 min):

   ```sh
   git clone <repo-url>
   cd budget
   npm install
   ```

2. **Boot the local Supabase stack and apply migrations** (≈ 3 min on first run):

   ```sh
   npm run db:start    # boots Postgres + GoTrue + PostgREST + Studio in Docker
   npm run db:reset    # applies all four migrations + runs the RLS test
   ```

   `db:start` prints the local URLs and the anon key — copy them; you'll need them in the next step. The default URL is `http://127.0.0.1:54321`. It also brings up the **Supabase Studio web console** at `http://127.0.0.1:54323` (see step 3).

3. **Create a test user in the local stack** (≈ 1 min):

   - Open Supabase Studio at `http://127.0.0.1:54323`. (Studio is the local web console that ships with `npm run db:start` — use it for all admin tasks: creating users, browsing the `budget` schema, running ad-hoc SQL.)
   - Authentication → Users → Add user → enable "Auto-confirm user".
   - Note the email and password you set; you'll use them to sign in.

4. **Configure environment variables** (≈ 2 min):

   - Copy the example file: `cp .env.local.example .env.local`
   - Fill in:
     - `NEXT_PUBLIC_SUPABASE_URL` — the local API URL printed by `supabase start` (`http://127.0.0.1:54321`).
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon key printed by `supabase start`.
     - `E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD` — credentials of the user you created in step 3. Add a second user (`B`) too if you plan to run the multi-tab tests.
   - Do not commit `.env.local`. It is already in `.gitignore`.

---

## Run the app

```sh
npm run dev
```

The app starts on `http://localhost:3023` (see `package.json`).

---

## Verify the success criteria

These map 1-to-1 to the spec's User Stories:

### US1 — Returning user signs in (SC-001, SC-003)

1. Visit `http://localhost:3023/`.
2. You are redirected to `/login`.
3. Submit the email and password of the user you created in Studio.
4. You land on the authenticated home page, which greets you with your email.
5. Refresh the page — you stay signed in.

**Expected timing**: under 5 seconds for step 3 → step 4.

### US2 — Data isolation (SC-002, SC-005)

Open the Supabase SQL editor (or `psql`) and run:

```sql
-- Confirm tables live in budget schema and have RLS enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'budget'
  AND tablename IN ('categories', 'transactions');
-- Expected: 2 rows, rowsecurity = true for both.

-- Confirm policies exist
SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'budget';
-- Expected: categories_owner, transactions_owner.
```

The deeper isolation assertions run automatically when `supabase db reset` executes the `20260522000003_rls_test.sql` migration; a failure there will abort the reset.

### US3 — Sign out (SC-006)

1. While signed in, click the **Sign out** button in the header.
2. You are redirected to `/login`.
3. Manually navigate to `http://localhost:3023/`.
4. You are redirected back to `/login`.

---

## Run the critical-path tests

```sh
npm run test:e2e
```

This runs the Playwright auth suite. It requires:

- `E2E_USER_A_EMAIL` / `E2E_USER_A_PASSWORD` (and `_B_` pair) set in `.env.local` or your shell.
- Test users with those credentials already created in the Supabase dashboard for the target environment.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Redirected to `/login` immediately after a successful sign-in | Cookies not being set — middleware misconfigured for your environment | Confirm `proxy.ts` is in repo root, not under `app/`. Check `cookies()` is awaited. |
| `relation "budget.categories" does not exist` | Schema not exposed via PostgREST | Confirm `supabase/config.toml` lists `budget` under `[api].schemas` and that migrations have run. |
| `permission denied for schema budget` | Missing `GRANT USAGE` | Re-run migrations; the first migration (`*_budget_schema.sql`) grants `USAGE` to `anon, authenticated`. |
| Sign-in works but the header is blank | `getCurrentUser()` returned null in the layout | Check that the server Supabase client uses `cookies()` from `next/headers`, not a cached client. |
| CSP errors in the browser console | Inline script/style without the request nonce | Confirm `proxy.ts` emits the CSP header and that the layout reads the nonce from headers. |

---

## What this quickstart does **not** cover

- Creating categories or transactions through the UI — no UI ships for them in this feature (clarified in Q4).
- Password reset, MFA, social sign-in — out of scope (clarified in Assumptions).
- Cloud deployment — out of scope for this feature. A dedicated paid Supabase project for the Budget app will be added in a later feature (see `research.md` R9).
