# Phase 0 Research — Family Budget App

This document resolves every NEEDS CLARIFICATION carried out of the spec and locks in the technical decisions referenced from `plan.md`. Each decision has a rationale and the alternatives that were considered.

---

## 1. Authentication provider

- **Decision**: Supabase Auth, email + password. Session managed via `@supabase/ssr` cookies in the Next.js App Router.
- **Rationale**: Constitution mandates Supabase for backend; using Supabase Auth keeps RLS policies trivial (`auth.uid()` is available in every policy) and avoids a second user-identity system. Email/password matches spec FR-001/FR-002. Sign-in cookies are HTTP-only and refreshed by `lib/supabase/middleware.ts`, which also injects the per-request CSP nonce.
- **Alternatives**:
  - **NextAuth/Auth.js + Supabase DB** — introduces a parallel session model and complicates RLS (`auth.uid()` no longer reliable); rejected.
  - **OAuth/social providers** — spec assumption explicitly defers these to post-v1; not adopted now.
  - **Magic-link only** — convenient but spec calls for email/password explicitly (FR-001).

## 2. Household membership & invitations

- **Decision**: A `household_invite` table stores a single-use opaque token + invited email + `expires_at`. The owner calls `rpc('create_invite', { email })`; the invitee follows the resulting URL `/invite/[token]`, signs up or signs in, then calls `rpc('accept_invite', { token })` which inserts a `household_member` row and revokes the token.
- **Rationale**: Single-use opaque tokens avoid email-spoofing exploits; expiry caps the blast radius if a link leaks. Keeping the join step behind an RPC keeps the multi-table write (household_member insert + token revoke) atomic and RLS-safe.
- **Alternatives**:
  - **Share a household ID** — anyone with the ID joins; rejected as insecure.
  - **Email-domain auto-join** — too narrow for a consumer app.

## 3. PWA installability + offline writes

- **Decision**: `@serwist/next` for service-worker tooling. The SW pre-caches the app shell and routes `app/*` through a network-first strategy with a stale-while-revalidate fallback for static assets. Offline transaction writes go through an IndexedDB outbox keyed by client-generated UUID; on reconnect, a background sync replays them through the same RPC entry points (idempotent because each row's PK is the client UUID).
- **Rationale**: Next.js 16 does not ship a built-in service worker; Serwist is the maintained successor to next-pwa and supports App Router. The outbox is a thin layer in `lib/pwa/` and a `store/slices/outbox.ts` mirror so the UI can show queued-but-unsynced state. Idempotent inserts come "for free" because we let the client choose the row UUID.
- **Alternatives**:
  - **next-pwa** — unmaintained for App Router; rejected.
  - **Bespoke service worker** — more code, no upside; rejected.
  - **Background Sync API only** — not supported in Safari/iOS PWAs; rejected. We use Background Sync where available and a simple online-event listener as a fallback.

## 4. Conflict policy for offline replay

- **Decision**: Last-write-wins per row, scoped to the client UUID. If two devices each insert a transaction with the same merchant + amount + date within seconds (spec edge case), both rows are persisted — the spec asks us to make duplicates easy to spot, not to block.
- **Rationale**: Spec assumption explicitly defers conflict-resolution beyond last-write-wins to post-v1; matches user expectation.

## 5. Money precision

- **Decision**: Store all amounts as `bigint` cents (CAD subunits). Format at the edges via `lib/money.ts`. Postgres column type is `bigint` (not `numeric`) — operations are integer arithmetic, no rounding drift.
- **Rationale**: Floating-point dollars accumulate error after thousands of operations (split calculations, income-proportional ratios applied repeatedly). Cents-as-integers is the industry-standard fix.
- **Alternatives**:
  - **`numeric(12,2)`** — correct but slower and forces decimal libraries in JS land; rejected.
  - **Float dollars** — drift; rejected.

## 6. Income-proportional split derivation

- **Decision**: A SQL function `compute_income_split(p_household_id uuid) returns table (adult_id uuid, ratio numeric(10,8))` computes each adult's ratio of current incomes. The "by income" rule on a shared expense calls this function inline. Ratios are never persisted; only the chosen rule keyword (`adult_a` / `adult_b` / `50_50` / `by_income`) is stored.
- **Rationale**: Spec is explicit (FR-012, assumption 7): the ratio must follow current incomes. Storing it would let it drift from reality the moment income changes.
- **Edge case**: When both incomes are zero, the function falls back to equal split (50/50 for a 2-adult household). Single-adult households degenerate to 100%/0%.

## 7. State management boundary

- **Decision**: Redux Toolkit holds **only** genuine client UI state:
  - Drawer open/closed
  - Transaction-list filter chips and search input
  - Offline outbox mirror (for the "queued" badge)
- All server data is read via React Server Components + Supabase RPCs (or direct table selects under RLS). Mutations are Server Actions that call RPCs and then `revalidateTag('household:<id>')`.
- **Rationale**: Constitution mandates Redux Toolkit but also "Server Components default + Server Actions for mutations". The boundary is: if a refresh of the page should re-fetch the value, it lives in RSC. If it is transient UI, it lives in Redux.
- **Alternatives rejected**:
  - **RTK Query for everything** — duplicates the cache RSC already gives us; pulls server data into a client store and balloons the bundle.
  - **Server Components only, no Redux** — drawer/filters become URL params or component state, fine in isolation but spreads UI state across the tree.

## 8. Real-time fan-out for shared dashboards (SC-003)

- **Decision**: Supabase Realtime "Postgres Changes" subscription, channel keyed by household. The authenticated household layout subscribes once on mount and revalidates the relevant tags on incoming INSERT/UPDATE/DELETE for `transactions`. RLS is applied to realtime payloads by Supabase, so cross-household leakage is impossible.
- **Rationale**: Sub-5s update target (SC-003); polling would either be wasteful or slow. Realtime works with RLS and is a managed primitive.
- **Alternatives**:
  - **Pull-every-N-seconds** — wastes bandwidth and battery; rejected.
  - **Server-sent events from custom endpoint** — re-implements what Supabase Realtime already gives us.

## 9. Charts library for reports

- **Decision**: **Recharts** for all four reports. Loaded only on `app/(app)/reports/*` routes via `next/dynamic({ ssr: false })`, so it never lands on the dashboard cold-load bundle.
- **Rationale**: Mature, declarative API, works with our type discipline, supports the toggle-recompose pattern needed by the per-person pie (SC-006). Bundle is acceptable because routes are scoped.
- **Alternatives**:
  - **visx / d3** — too low-level, blows the time budget.
  - **Chart.js** — imperative, harder to test, larger.
  - **Hand-rolled SVG** — fine for the donut, painful for time-series; not worth the inconsistency.

## 10. Subscription auto-logging cadence

- **Decision**: A Supabase **cron job** (`pg_cron`) runs every hour, calling `materialize_due_subscriptions()`. The function iterates active subscriptions whose `next_renewal_at <= now()`, inserts a transaction per occurrence (idempotent via a unique index on `(subscription_id, occurrence_date)`), then advances `next_renewal_at` by the cadence. Hourly cadence comfortably hits the 24-hour SLA (SC-007) with headroom.
- **Rationale**: `pg_cron` is enabled on Supabase; lives inside the database next to the data; no external scheduler needed; idempotent by construction.
- **Alternatives**:
  - **Edge Function on a schedule** — adds an external runtime for no reason.
  - **Client-side trigger on app open** — silently fails if no adult opens the app for days; violates SC-007.

## 11. Province-specific tax data

- **Decision**: Static TypeScript module `lib/canadian-tax/` holding:
  - Province codes + display names
  - CRA quarterly instalment dates (Mar 15 / Jun 15 / Sep 15 / Dec 15) and filing deadlines (Apr 30, Jun 15 self-employed) — computed for the active tax year via `date-fns` to keep them deadline-accurate when the year rolls over
  - Deduction categories with their CRA codes (T2125 home office, T2202 tuition, T4 employment, T4A contract, vehicle business km, private health premiums)
  - Provincial marginal rate ladders for ON/BC/AB/QC at minimum (others may be added later)
- These are content, not code that changes per release; CRA changes get propagated by editing the module.
- **Rationale**: Tax content is small, slow-changing, and read-only on the client. Putting it in the DB just to pull it back over the wire is wasteful and would complicate i18n in the future.

## 12. Form validation

- **Decision**: **Zod**. Single schema per write operation, used by:
  - The Server Action that validates input before invoking the RPC
  - The client form for instant feedback (`zodResolver` with a small `react-hook-form` adapter or `useFormState`)
- **Rationale**: One schema, two consumers — type safety preserved end-to-end without duplicating rules. Zod is already the canonical pick for `@supabase/ssr` examples.
- **Alternatives**:
  - **Yup** — older, fewer TS niceties.
  - **Hand-rolled validators** — invites drift between client and server checks.

## 13. CSP / nonce wiring

- **Decision**: `lib/supabase/middleware.ts` (which runs on every request to refresh the Supabase session) also generates a per-request `nonce`, attaches it to a request header, and sets a `Content-Security-Policy` response header that whitelists `'nonce-...'` for `script-src` and `style-src`. The root `app/layout.tsx` reads the nonce via `next/headers` and forwards it to `<NextScript nonce>` and any inline style block. No `unsafe-inline` anywhere.
- **Rationale**: Matches Next.js's official nonce-CSP recipe and satisfies Constitution principle II.
- **Alternatives rejected**:
  - **`unsafe-inline`** — loses XSS protection; rejected outright.
  - **Hash-based CSP** — brittle under Tailwind v4's runtime CSS-vars; rejected.

## 14. Test runner choices

- **Decision**:
  - **Playwright** — critical user flows enumerated in `plan.md` (Constitution Check, principle IV).
  - **Vitest** — pure-function unit tests (`money.ts`, `split.ts`, `canadian-tax/dates.ts`). Fast feedback, ESM-native, no Jest config.
- **Rationale**: Constitution says "non-critical behavior MUST be covered by unit or integration tests" — Vitest is the lightweight pick that won't drag in Babel. Playwright is mandated for criticals.

## 15. Currency display

- **Decision**: All amounts formatted by `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' })`, always with `minimumFractionDigits: 2`. No display fallback drops the decimals (FR-037 + spec edge case on sub-dollar values).
- **Rationale**: Built into the platform; locale-correct (`CA$1,234.56` style on en-CA) without adding `currency.js` or similar.

---

## Cross-cutting summary

| Concern | Decision |
|---------|----------|
| Auth | Supabase Auth email+password |
| Backend comms | Supabase RPC into Postgres functions (constitution) |
| Storage type for money | `bigint` cents |
| State management | Redux Toolkit, UI state only |
| Realtime | Supabase Realtime channel per household |
| PWA | `@serwist/next` + IndexedDB outbox |
| Charts | Recharts, dynamic-imported per report route |
| Recurring subs | `pg_cron` hourly `materialize_due_subscriptions()` |
| Tax data | Static `lib/canadian-tax/` TS module |
| Validation | Zod, shared client+server |
| CSP | Nonce-based, generated in middleware |
| E2E | Playwright on the 8 critical flows listed in `plan.md` |
| Unit tests | Vitest for pure helpers |

All NEEDS CLARIFICATION markers are resolved.
