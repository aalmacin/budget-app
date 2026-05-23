# Server Action Contracts: Supabase Foundation for Budget App

**Feature**: 001-setup-supabase
**Date**: 2026-05-22

This feature exposes two interface surfaces to the outside world:

1. **Server Actions** invoked from the sign-in form and the sign-out button.
2. **HTTP routes** (pages and middleware redirects) defined by the App Router.

There are **no Postgres RPC functions in this feature** — see `research.md` R8 for the constitutional rationale.

---

## Server Action: `signIn(formData: FormData)` — `actions/auth.ts`

**Purpose**: Authenticate a user by email + password (FR-002, FR-003, FR-004).

**Contract**:

```ts
'use server';

export async function signIn(formData: FormData): Promise<never>;
```

| Aspect | Behavior |
|---|---|
| Caller | The sign-in form on `/login` (`<form action={signIn}>`) |
| Input | `formData.get('email')` — non-empty string; `formData.get('password')` — non-empty string |
| Side effect on success | Establishes a session cookie via `@supabase/ssr` server client → calls `redirect('/')` |
| Side effect on failure | `redirect('/login?error=Invalid+credentials')` (or a more specific URL-safe message for non-credential failures) |
| Return | Never returns — always throws a redirect |
| Errors surfaced to client | None directly — the user sees the error via the `?error=` query param on `/login` (read by `app/login/page.tsx`) |

**Invariants**:

- The action MUST validate that both fields are present before calling Supabase, returning to `/login?error=Email+and+password+required` if not (matches the empty-field edge case in the spec).
- The action MUST NOT echo the submitted password back into the redirect URL or any log.
- On any thrown exception other than a Supabase auth failure, the action redirects to `/login?error=Service+temporarily+unavailable` (covers the "auth provider unreachable" edge case).

**Mapped FRs / Acceptance Scenarios**: FR-002, FR-003, FR-004; US1 scenarios 2 and 3.

---

## Server Action: `signOut()` — `actions/auth.ts`

**Purpose**: End the user's session (FR-006).

**Contract**:

```ts
'use server';

export async function signOut(): Promise<never>;
```

| Aspect | Behavior |
|---|---|
| Caller | The `<SignOutButton />` inside the app shell (header), via `<form action={signOut}>` |
| Input | None (no FormData expected) |
| Side effect | Calls `supabase.auth.signOut()` on the server client, clearing session cookies → `redirect('/login')` |
| Return | Never returns — always throws a redirect |

**Invariants**:

- The action MUST clear the session even if `supabase.auth.signOut()` rejects (best-effort cookie clear), then redirect.
- The action MUST NOT require any input or CSRF token beyond Next.js's built-in Server Action protection.

**Mapped FRs / Acceptance Scenarios**: FR-006, FR-019; US3 scenarios 1 and 2.

---

## Server Helper: `getCurrentUser()` — `lib/auth.ts`

**Purpose**: Resolve the current authenticated user on the server, for use in protected layouts and pages (FR-007).

**Contract**:

```ts
import type { User } from '@supabase/supabase-js';

export async function getCurrentUser(): Promise<User | null>;
```

| Aspect | Behavior |
|---|---|
| Caller | `app/(authed)/layout.tsx` (to render header) and any future Server Component that needs the user |
| Input | None — reads cookies via the server Supabase client |
| Return | The `User` object from `auth.users` (id + email + metadata) when a valid session exists, otherwise `null` |
| Side effect | None |
| Failure mode | Returns `null` rather than throwing on missing/expired session; callers must handle `null` (typically by redirecting, though middleware should already have redirected) |

**Invariants**:

- MUST use `supabase.auth.getUser()` (verifies the JWT against the auth server) rather than `getSession()` (which trusts the cookie). This is the `@supabase/ssr` documented best practice.

---

## HTTP Routes

| Method | Path | Behavior |
|---|---|---|
| GET | `/login` | Renders the sign-in page (Server Component). Reads `?error=` from search params to display the error. |
| GET | `/` | Authenticated home — placeholder content confirming sign-in (FR-020). Unauthenticated visitors are redirected by middleware. |
| any | `/*` (other) | Middleware redirects unauthenticated requests to `/login`. |

No JSON API surface is exposed by this feature.

---

## Middleware Contract — `middleware.ts`

| Aspect | Behavior |
|---|---|
| Triggers on | All routes except Next.js statics (`_next/*`, `favicon.ico`, etc.) — `matcher` mirrors the reference project |
| Behavior 1 | Refreshes the Supabase session by calling `supabase.auth.getUser()` and writing any rotated cookies into the response (FR-005) |
| Behavior 2 | If no user and path does not start with `/login`, returns `NextResponse.redirect('/login')` (FR-001) |
| Behavior 3 | Generates a per-request CSP nonce and sets a `Content-Security-Policy` header allowing only that nonce for `script-src` / `style-src` (Constitution Principle II) |
| Behavior 4 | Forwards the nonce to Server Components via a request header (`x-nonce`) so `app/layout.tsx` can apply it |

---

## Failure-mode contract summary

| Edge case (from spec) | Where handled |
|---|---|
| Session expired mid-use | Middleware: `getUser()` returns null → redirect to `/login`. |
| Auth provider unreachable | `signIn` catches the error and redirects to `/login?error=...`. |
| Multi-tab sign-out | Next request from another tab hits middleware → no user → redirect. |
| Already signed in, navigates to `/login` | `/login` page is reachable; if already signed in, the page still renders (does not error). A later iteration can add a redirect to `/` if desired. |
| Empty email or password | Client-side `required` attribute prevents submission; `signIn` also rejects empty values defensively. |

These match the Edge Cases section of `spec.md`.
