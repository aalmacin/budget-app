# Auth contracts

Authentication is Supabase Auth, email + password. There are no custom auth RPCs and **no in-app signup** in v1 — user accounts are created by an administrator directly in the Supabase dashboard (FR-001, spec clarification §5). The app only exposes sign-in, sign-out, and current-user lookups.

## Sign in

```ts
await supabase.auth.signInWithPassword({ email, password });
```

- Maps to FR-002.
- Password must meet FR-001a (≥8 chars + ≥1 digit + ≥1 symbol), enforced by `passwordSchema` in `lib/validators/auth.ts` for instant client feedback. The Supabase project config enforces the same minimums so admin-created and admin-reset passwords cannot bypass them.
- On success, the calling middleware sets the session cookies.
- On wrong credentials: returns `{ error: { status: 400, message: 'Invalid login credentials' } }`. UI shows a single generic error (US1 AC3) — we deliberately do **not** distinguish wrong-email from wrong-password to avoid account enumeration.
- After sign-in, the `(app)` layout checks for an active `household_member` row (`role='adult' AND deleted_at IS NULL`). If none, it redirects to `/onboarding/create-household` (FR-003).

## Sign out

```ts
await supabase.auth.signOut();
```

- Maps to FR-002 (sign-out half).
- Server middleware clears session cookies; next request to any `(app)` route 302s to `/login`.

## Current user (server-side reads)

```ts
const { data: { user } } = await supabaseServerClient.auth.getUser();
```

Used in route handlers / layouts to gate `(app)` routes and to populate `auth.uid()` in RLS.

## What is explicitly NOT in this contract

- **`supabase.auth.signUp(...)`** is never called from app code in v1. There is no signup page, no public registration endpoint, no email-delivered invitation, and no invite-token system. Attempting to introduce any of these requires an amendment to spec clarification §5.
- **Account deletion / right-to-erasure** is out of scope for v1 per spec clarification §2; handled manually by operations on user request.

## Errors visible to UI

| Path | Code | UI copy |
|---|---|---|
| signIn | `invalid_credentials` | "Email or password is incorrect." |
| signIn | `email_not_confirmed` | "Confirm your email first — ask the admin to resend confirmation." |
| signIn (network) | any | "Couldn't reach Budget. Check your connection and try again." |
