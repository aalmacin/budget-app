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

### Phase 7 — Household onboarding (US4) and family (US5)

After signing in for the first time, the `(app)` layout calls `budget.get_current_household` and, finding no membership, redirects you to `/onboarding/create-household` (FR-021).

1. **Onboarding (US4)**: enter a household name (e.g. "The Almacins") and submit. `budget.create_household` runs as a SECURITY DEFINER RPC owned by `budget_function_owner`, inserts a `budget.household` row, and inserts you as the first adult member. You are redirected to `/dashboard`.
2. **Family management (US5)**: visit `/family`. You see yourself as the household's first adult. From here:
   - **Add adult**: enter the email of another existing Supabase user. `budget.add_adult_by_email` looks up the user; if found, inserts them as `role='adult'`. The 3rd active adult is rejected with `Households are limited to 2 adults` (FR-027).
   - **Add kid**: enter a display name and age (0–25, FR-027). No cap on kids.
   - **Update an adult's income**: edit the income inline. `budget.update_member_income` persists it. This feeds the per-adult ratio in `/settings` (US8 income split).
   - **Remove a member**: soft-deletes them. Historical transactions still resolve their `display_name` (FR-028).

**Expected timing**: under 5 seconds for sign-up → first household → `/dashboard`.

### Phase 7 — Subscriptions auto-materialize (US7)

1. Register a subscription at `/subscriptions` with `next_renewal_at = today`.
2. Either wait up to 1 hour (`pg_cron` runs `subscriptions-hourly`) or manually trigger: in Studio's SQL editor, run `SELECT budget.materialize_due_subscriptions(true);`.
3. A new transaction appears in `/transactions` (and `/dashboard`) with the subscription's amount, category, and merchant. `next_renewal_at` advances by one cadence step. Re-running the trigger inserts nothing new — the partial unique index on `(subscription_id, occurrence_date)` enforces idempotency (FR-032).

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
| Sign-in always returns "Email or password is incorrect" even with correct credentials, and `docker logs supabase_auth_budget` shows `422 email_provider_disabled` on every `POST /token` | Email auth provider disabled. The Supabase CLI maps `[auth.email].enable_signup` to `GOTRUE_EXTERNAL_EMAIL_ENABLED`, so setting it `false` disables logins as well as signups. | In `supabase/config.toml`, set `[auth.email].enable_signup = true`. Public signup remains blocked by `[auth].enable_signup = false` (a separate flag that maps to `GOTRUE_DISABLE_SIGNUP`). Restart with `npx supabase stop && npm run db:start`. See `research.md` R11. |
| The login page does a full reload when you click **Sign in** (even with empty fields), instead of showing the validation error inline. Browser console shows `Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script`. | CSP missing `'unsafe-eval'` in dev. React 19 uses `eval()` to reconstruct server stacks for the dev overlay; without it, hydration aborts, `useActionState` never binds, and the form falls back to native browser POST. | Add `'unsafe-eval'` to `script-src` in dev only — gated on `process.env.NODE_ENV === "development"` in `lib/supabase/middleware.ts`. Not required in production. See `research.md` R4 ("Post-merge addendum") and tasks `T053`. |
| Redirected to `/login` immediately after a successful sign-in | Cookies not being set — middleware misconfigured for your environment | Confirm `proxy.ts` is in repo root, not under `app/`. Check `cookies()` is awaited. |
| `relation "budget.categories" does not exist` | Schema not exposed via PostgREST | Confirm `supabase/config.toml` lists `budget` under `[api].schemas` and that migrations have run. |
| `permission denied for schema budget` | Missing `GRANT USAGE` | Re-run migrations; the first migration (`*_budget_schema.sql`) grants `USAGE` to `anon, authenticated`. |
| Sign-in works but the header is blank | `getCurrentUser()` returned null in the layout | Check that the server Supabase client uses `cookies()` from `next/headers`, not a cached client. |
| CSP errors in the browser console | Inline script/style without the request nonce | Confirm `proxy.ts` emits the CSP header and that the layout reads the nonce from headers. |
| `Could not find the function budget.create_household(p_name) in the schema cache` (or any other `budget.*` RPC missing) | You're on a database that hasn't applied the Phase 7 migrations yet | Run `npm run db:reset`. After it completes, restart the dev server so Supabase's PostgREST schema cache reloads (or wait ~10 seconds for the auto-refresh). |
| `Households are limited to 2 adults` when adding an adult | Expected — the household already has 2 active adults (FR-027) | Remove an existing adult (soft-delete in `/family`) before adding a new one. |
| `for_member_id does not belong to this household` when logging a transaction | The deferred constraint trigger working as designed (FR-029) | Re-pick the member from the same household; mismatched member ids are rejected at commit time. |
| `infinite recursion detected in policy for relation "household_member"` | The `auth_user_household_ids()` helper reverted to `SECURITY INVOKER` somehow | Confirm migration `20260524000016_helper_security_definer_fix.sql` is present and applied. The helper MUST be SECURITY DEFINER to break the policy/helper recursion cycle. |

---

## What this quickstart does **not** cover

- Creating categories or transactions through the UI — no UI ships for them in this feature (clarified in Q4).
- Password reset, MFA, social sign-in — out of scope (clarified in Assumptions).
- Cloud deployment — out of scope for this feature. A dedicated paid Supabase project for the Budget app will be added in a later feature (see `research.md` R9).
