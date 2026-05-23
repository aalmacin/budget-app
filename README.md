# Budget

A personal budgeting app built on Next.js (App Router) and Supabase.

The data layer lives in the `budget` Postgres schema on a Supabase instance that is **shared with other apps** — this project must never write to `public`.

## First-time setup

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Get credentials from an administrator**

   - A working email + password account in the target Supabase project.
   - The project URL and anon public key.

   This app intentionally has no public signup — see `specs/001-setup-supabase/spec.md`. Administrators create accounts in the Supabase dashboard (Authentication → Users → Add user, with "Auto-confirm user" enabled).

3. **Configure environment variables**

   ```sh
   cp .env.local.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (only if you intend to run E2E tests) the four `E2E_USER_*` values.

   `.env.local` is git-ignored; never commit real values.

## Run the app

```sh
npm run dev
```

Open `http://localhost:3023` — you will be redirected to `/login`. After signing in, you land on the authenticated home page that confirms your email.

## Database / migrations

The Supabase CLI is a dev dependency.

```sh
npx supabase start          # boots local Supabase (only needed for offline work)
npm run supabase:reset      # alias for `supabase db reset` — applies all migrations + runs the RLS test
```

Migrations live in `supabase/migrations/`. Every table is created in the `budget` schema with Row Level Security and explicit owner policies. The final migration (`*_rls_test.sql`) is a self-checking SQL block that asserts user A cannot read, modify, or delete user B's data — a failure there aborts `db reset` so the schema can never ship without isolation.

## Tests

End-to-end tests (Playwright) cover the critical auth flow (Constitution Principle IV).

```sh
npm run test:e2e
```

The test runner starts the dev server automatically. Tests require valid `E2E_USER_A_*` and `E2E_USER_B_*` credentials in `.env.local`, with both users pre-provisioned in the target Supabase project.

## Project structure

```text
app/                      # Next.js App Router
├── login/                # Public sign-in page
└── (authed)/             # Authenticated route group (layout, error & loading boundaries, home)
actions/                  # Server Actions (signIn, signOut)
components/               # Shared UI: AppHeader, SignOutButton
lib/
├── auth.ts               # getCurrentUser()
└── supabase/             # Browser + server Supabase clients
middleware.ts             # Session refresh + auth gate + CSP nonce
supabase/
├── config.toml           # Local Supabase CLI config — exposes only `budget` schema
└── migrations/           # Versioned schema (categories, transactions, RLS test)
tests/e2e/                # Playwright critical-path tests
```

See `specs/001-setup-supabase/` for the full spec, plan, and design artifacts.
