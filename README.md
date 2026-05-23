# Budget

A personal budgeting app built on Next.js (App Router) and Supabase.

The data layer lives in the `budget` Postgres schema with Row Level Security on every table. This feature ships against a **local Supabase stack only** — a dedicated paid cloud Supabase project for the Budget app will be added in a later feature (see `specs/001-setup-supabase/research.md` § R9).

## First-time setup

You need Node 20+, npm, and Docker (or OrbStack) running.

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Boot the local Supabase stack and apply migrations**

   ```sh
   npx supabase start       # boots Postgres + GoTrue + PostgREST in Docker
   npm run supabase:reset   # applies all migrations + the RLS self-check
   ```

   `supabase start` prints the local API URL (default `http://127.0.0.1:54321`) and the anon key — you'll paste them into `.env.local`.

3. **Create a test user in the local stack**

   Open Supabase Studio at `http://127.0.0.1:54323`, go to Authentication → Users → Add user, enable "Auto-confirm user", and remember the email/password. There is no public signup in the app by design.

4. **Configure environment variables**

   ```sh
   cp .env.local.example .env.local
   ```

   Fill in:

   - `NEXT_PUBLIC_SUPABASE_URL` — local API URL from `supabase start`.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key from `supabase start`.
   - `E2E_USER_A_*` (and `E2E_USER_B_*` if you want the multi-tab tests) — the credentials of the user(s) you created in Studio.

   `.env.local` is git-ignored; never commit real values.

## Run the app

```sh
npm run dev
```

Open `http://localhost:3023` — you will be redirected to `/login`. After signing in, you land on the authenticated home page that confirms your email.

## Database / migrations

```sh
npm run supabase:reset      # alias for `supabase db reset`
```

Migrations live in `supabase/migrations/`. Every table is created in the `budget` schema with Row Level Security and explicit owner policies. The final migration (`*_rls_test.sql`) is a self-checking SQL block that asserts user A cannot read, modify, or delete user B's data — a failure there aborts `db reset`, so the schema can never ship without isolation.

When the Budget app gets its own cloud Supabase project (later feature), the same migration directory will be pushed via `supabase db push`. No app code changes are expected.

## Tests

End-to-end tests (Playwright) cover the critical auth flow (Constitution Principle IV).

```sh
npm run test:e2e
```

The test runner starts the dev server automatically. Tests require valid `E2E_USER_A_*` and (for the multi-tab test) `E2E_USER_B_*` credentials in `.env.local`, with both users created in your local Supabase Studio.

## Project structure

```text
app/                      # Next.js App Router
├── login/                # Public sign-in page
└── (authed)/             # Authenticated route group (layout, error & loading boundaries, home)
actions/                  # Server Actions (signIn, signOut)
components/
├── AppHeader.tsx
├── SignOutButton.tsx
└── ui/                   # Shared primitives (Button, TextInput)
lib/
├── auth.ts               # getCurrentUser()
└── supabase/             # Browser + server Supabase clients
proxy.ts                  # Next.js 16 proxy: session refresh + auth gate + CSP nonce
supabase/
├── config.toml           # Local Supabase CLI config — exposes only `budget` schema
└── migrations/           # Versioned schema (categories, transactions, RLS test)
tests/e2e/                # Playwright critical-path tests (anonymous + authed projects)
```

See `specs/001-setup-supabase/` for the full spec, plan, and design artifacts.
