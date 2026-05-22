# Auth contracts

Supabase Auth handles signup/signin/signout directly via its JS client. There are no custom RPCs for these; we only call the supplied client methods.

## Sign up

```ts
await supabase.auth.signUp({ email, password });
```
- Sends Supabase confirmation email (project setting: required = true).
- Maps to FR-001.
- On success, the user has a row in `auth.users` but **no `household_member` row yet** — the app then calls `create_household()` to bootstrap a fresh household, OR follows an invite link to call `accept_invite(token)`.

## Sign in

```ts
await supabase.auth.signInWithPassword({ email, password });
```
- Maps to FR-002.
- Wrong password → returns `{ error: { status: 400, message: 'Invalid login credentials' } }`. UI shows the spec-mandated clear error (US1 AC2).

## Sign out

```ts
await supabase.auth.signOut();
```
- Maps to FR-002 (sign-out half).
- Server middleware clears session cookies.

## Current user (server-side reads)

```ts
const { data: { user } } = await supabaseServerClient.auth.getUser();
```

Used in route handlers / layouts to gate `(app)` routes and to populate `auth.uid()` in RLS.

## Errors visible to UI

| Path | Code | UI copy |
|---|---|---|
| signUp | `email_exists` | "An account already exists for that email." |
| signUp | weak password | "Password must be at least 8 characters." |
| signIn | `invalid_credentials` | "Email or password is incorrect." |
| signIn | `email_not_confirmed` | "Confirm your email first — check your inbox." |
