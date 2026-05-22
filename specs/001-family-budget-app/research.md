# Phase 0 Research — Family Budget App

This document resolves every NEEDS CLARIFICATION carried out of the spec and locks in the technical decisions referenced from `plan.md`. Each decision has a rationale and the alternatives that were considered. Decisions reflect all clarifications recorded in `spec.md §Clarifications` (session 2026-05-21), including the scope reductions that removed US8 (Canadian tax tracking) and kid allowances, switched income to net amounts, and added the Quick Add screen.

---

## 1. Authentication provider

- **Decision**: Supabase Auth, email + password. Session managed via `@supabase/ssr` cookies in the Next.js App Router. **No signup UI exists in v1** — Supabase `auth.users` rows are created by an administrator directly in the Supabase dashboard (FR-001, clarification §5 "Account creation").
- **Rationale**: Constitution mandates Supabase; using Supabase Auth keeps RLS policies trivial (`auth.uid()` is always available) and avoids a second identity system. Email/password matches FR-001/FR-002. Removing self-service signup matches the spec's admin-provisioning model and eliminates a whole class of abuse vectors (spam accounts, throwaway invites).
- **Alternatives**:
  - **NextAuth/Auth.js + Supabase DB** — introduces a parallel session model and complicates RLS; rejected.
  - **OAuth/social providers** — spec assumption explicitly defers these to post-v1; not adopted now.
  - **Magic-link only** — spec FR-001 calls for password explicitly.

## 2. Password strength policy

- **Decision**: Minimum 8 characters AND at least one digit (0–9) AND at least one symbol (non-alphanumeric printable). Paste allowed. Max length 64+. Enforced **both** client-side via Zod for instant feedback AND in Supabase Auth project config so admin-set and admin-reset passwords carry the same guarantee (FR-001a, clarification §4).
- **Rationale**: Matches the clarification verbatim. Dual enforcement is necessary because the in-app sign-in form never sees passwords during admin reset — only the Supabase project config protects that path.
- **Implementation**: Zod schema `passwordSchema` lives in `lib/validators/auth.ts` and is also exported as the regex used to configure Supabase Auth `password_min_length` + `password_requirements`. Sign-in errors do NOT distinguish weak-password from wrong-password to avoid user-enumeration.

## 3. Household creation & second-adult addition (no invitations)

- **Decision**: Three responsibilities, per clarification §5:
  1. **Account creation** — admin-only in Supabase dashboard. App has no signup page, no invite tokens, no email-delivery integration.
  2. **Household creation** — user-initiated, in-app. On sign-in, if `auth.uid()` has no `household_member` row, the `(app)/layout.tsx` route guard redirects to `/onboarding/create-household`. Submitting that form calls `rpc('create_household', { name })` which inserts both the `household` row (caller becomes `owner_user_id`) and the caller's `household_member` row (`role='adult'`) inside a single transaction.
  3. **Adding additional members** — in-app via the Family screen. Adults are added via `rpc('add_adult_by_email', { email })`, which looks up the email in `auth.users` and inserts a `household_member` row on success, or returns a structured error (`no_account`, `already_member` no-op, `cap_reached`) on failure. Kids are added via `rpc('add_kid', { name, age_years })` and have `user_id = null`.
- **Rationale**: Matches the clarification's hybrid model precisely. Single-use opaque-token invites are entirely removed because they add operational surface (email delivery, token storage, expiry handling, revocation UI) for zero v1 benefit when admins already create accounts.
- **Alternatives rejected**:
  - **Email-delivered invitations with token** (previous decision) — superseded by clarification §5.
  - **Share a household ID** — anyone with the ID joins; insecure.

## 4. Member soft-delete

- **Decision**: Member removal sets `household_member.deleted_at = now()`. Transactions referencing the member via `paid_by_member_id` / `for_member_id` are unchanged. Three behaviors flow from the soft-delete:
  - **Hide**: Family screen, new-transaction "paid by" / "for whom" selectors, and "for whom" filter chips all add `where deleted_at is null`.
  - **Preserve**: Historical reports (`per_person_breakdown`, transactions list) still resolve the member's display name from the soft-deleted row so prior totals remain attributable.
  - **Free the cap**: The 2-adult cap (FR-005) counts only rows where `role='adult' AND deleted_at IS NULL`, so a replacement adult can be added after a soft-delete.
- **Rationale**: Matches clarification §1. Hard-delete with FK SET NULL would destroy per-person history; the spec explicitly requires history to survive. A `deleted_at` timestamp is the simplest unambiguous implementation and is friendly to future "undo delete" if it's ever needed.
- **Account/household self-deletion**: Out of scope for v1 per clarification §2 (PIPEDA right-to-erasure handled manually by operations). Sign-out is the only auth-side action; soft-delete is the only data-side action.

## 5. Residual-cents allocation in splits

- **Decision**: When a split rule (50/50, by-income) produces fractional cents:
  1. Floor each adult's share to whole cents (`floor(amount * ratio)`).
  2. Compute residual = `amount_cents - sum(floored_shares)`.
  3. Assign the residual cent(s) to the **higher-earning adult**; if incomes are equal (or both zero, which falls back to 50/50), assign to **Adult A in display order** (the lower `created_at` `household_member` row).
  4. Shares always sum exactly to `transaction.amount_cents`.
- **Rationale**: Matches clarification §3 exactly. Implemented in SQL (`apply_split_rule`) so the database is the single source of truth; the JS mirror in `lib/split.ts` follows the same algorithm for UI previews.
- **Tested by**: `tests/unit/split.test.ts` plus a Playwright assertion in `by-income-split-residual.spec.ts` that sums to the transaction total on a deliberately-odd amount.

## 6. PWA installability + offline writes

- **Decision**: `@serwist/next` for service-worker tooling. The SW pre-caches the app shell and routes `app/*` through network-first with stale-while-revalidate fallback for static assets. Offline transaction writes go through an IndexedDB outbox keyed by client-generated UUID v7; on reconnect, the outbox replays through the same RPC entry points. Inserts are idempotent because each row's primary key is the client UUID.
- **Rationale**: Next.js 16 does not ship a built-in service worker; Serwist is the maintained successor to `next-pwa` and supports App Router. The outbox is a thin layer in `lib/pwa/` and a `store/slices/outbox.ts` mirror so the UI can show queued-but-unsynced state. Idempotent inserts come for free from client-chosen UUIDs.
- **Alternatives**:
  - **next-pwa** — unmaintained for App Router; rejected.
  - **Bespoke SW** — more code, no upside.
  - **Background Sync API only** — not supported in Safari/iOS PWAs; we use it when available and fall back to an `online` event listener.

## 7. Conflict policy for offline replay

- **Decision**: Last-write-wins per row, scoped to the client UUID. Spec edge case "both adults log the same expense within seconds" persists both rows — the spec asks us to make duplicates easy to spot, not to block. Updates retain the most-recent `updated_at` wall-clock.
- **Rationale**: Spec assumption explicitly defers conflict resolution beyond last-write-wins to post-v1.

## 8. Money precision

- **Decision**: All amounts stored as `bigint` cents (CAD subunits). Format at the edges via `lib/money.ts`. Postgres column type is `bigint` (not `numeric`) — operations are integer arithmetic, no rounding drift, and the residual-cents rule (Decision §5) is exact.
- **Rationale**: Floating-point dollars accumulate error across thousands of operations (split calculations, ratios applied repeatedly). Integer cents is the industry-standard fix.
- **Alternatives**:
  - **`numeric(12,2)`** — correct but slower; forces decimal libraries in JS land.
  - **Float dollars** — drift; rejected.

## 9. Income-proportional split derivation

- **Decision**: SQL function `compute_income_split(p_household_id uuid) returns table(adult_id uuid, ratio numeric(10,8))` computes each adult's share of current incomes. The "by income" rule calls this inline. Ratios are never persisted; only the rule keyword (`adult_a` / `adult_b` / `50_50` / `by_income`) is stored on the transaction.
- **Rationale**: Spec is explicit (FR-012, assumption 7): the ratio must follow current incomes. Storing it would let it drift the moment income changes.
- **Edge cases**: Both incomes zero → equal split fallback (50/50 for a 2-adult household). Single-adult household degenerates to 100/0. Both edge cases are unit-tested in `tests/unit/split.test.ts`.

## 10. State management boundary

- **Decision**: Redux Toolkit holds **only** transient client UI state:
  - Drawer open/closed (`store/slices/drawer.ts`)
  - Transaction-list filter chips + search input + date range (`store/slices/filters.ts`)
  - Offline outbox mirror for the "queued" badge (`store/slices/outbox.ts`)
- All server data is read via React Server Components calling Supabase RPCs (or `transaction_view` selects under RLS). Mutations are Server Actions that call RPCs and then `revalidateTag('household:<id>')`.
- **Rationale**: Constitution mandates Redux Toolkit but also "Server Components default + Server Actions for mutations". The boundary rule: if reload should re-fetch the value, it lives in RSC; if it's transient UI, it lives in Redux.
- **Alternatives rejected**:
  - **RTK Query for everything** — duplicates the cache RSC gives us; balloons the bundle.
  - **No Redux** — drawer/filters would scatter as URL params or component state; fine in isolation but spreads UI state across the tree.

## 11. Real-time fan-out for shared dashboards (SC-003)

- **Decision**: Supabase Realtime "Postgres Changes" subscription, channel keyed by household. `(app)/layout.tsx` subscribes once on mount and calls `revalidateTag('household:<id>')` on incoming INSERT/UPDATE/DELETE for `transaction`. RLS is applied to realtime payloads by Supabase, so cross-household leakage is impossible.
- **Rationale**: Sub-5 s update target (SC-003). Polling would be wasteful and slow. Realtime works with RLS and is a managed Supabase primitive.
- **Alternatives**:
  - **Polling every N seconds** — wasteful bandwidth/battery.
  - **Bespoke SSE endpoint** — re-implements what Realtime already gives us.

## 12. Charts library for reports

- **Decision**: **Recharts** for all four reports, loaded only on `app/(app)/reports/*` routes via `next/dynamic({ ssr: false })` so charts never land on the cold-load dashboard bundle.
- **Rationale**: Mature, declarative, works with strict TS, supports the toggle-recompose pattern needed by the per-person pie (SC-006). Bundle is acceptable because routes are scoped.
- **Alternatives**:
  - **visx / d3** — too low-level for the timeline.
  - **Chart.js** — imperative, harder to test, larger bundle.
  - **Hand-rolled SVG** — fine for donuts (we actually keep the dashboard donut as inline SVG, per `HFDonut` in the designs), painful for time-series.

## 13. Subscription auto-logging cadence

- **Decision**: Supabase `pg_cron` job runs every hour: `select cron.schedule('subscriptions-hourly', '0 * * * *', $$select materialize_due_subscriptions();$$);`. The function iterates active subscriptions where `next_renewal_at <= now()`, inserts one transaction per occurrence (idempotent via `unique (subscription_id, occurrence_date) where subscription_id is not null`), then advances `next_renewal_at` by the cadence.
- **Rationale**: `pg_cron` is enabled on Supabase, lives next to the data, requires no external scheduler, and is idempotent by construction. Hourly cadence comfortably hits the 24-hour SLA (SC-007).
- **Alternatives**:
  - **Edge Function on schedule** — extra runtime for no benefit.
  - **Client-side trigger on app open** — silently fails if no adult opens the app for days; violates SC-007.

## 14. ~~Province-specific tax data~~ (REMOVED in scope reduction)

US8 was removed in the scope-reduction clarifications. `lib/canadian-tax/` is not built. Income source labels (T4, T4A, CCB, etc.) survive only as descriptive metadata on the income form — they no longer drive deadline math, marginal-rate display, or auto-aside logic.

## 15. Form validation

- **Decision**: **Zod**. One schema per write operation, consumed by:
  - Server Action that validates input before invoking the RPC.
  - Client form for instant feedback (`zodResolver` with `react-hook-form` or `useFormState`).
- **Rationale**: One schema, two consumers — type safety end-to-end without duplicating rules. Zod is the canonical pick for `@supabase/ssr` examples.

## 16. CSP / nonce wiring

- **Decision**: `lib/supabase/middleware.ts` (which already runs on every request to refresh the Supabase session) also generates a per-request `nonce`, attaches it to a request header, and sets a `Content-Security-Policy` response header that whitelists `'nonce-...'` for `script-src` and `style-src`. The root `app/layout.tsx` reads the nonce via `next/headers` and forwards it to `<NextScript nonce>` and any inline style block. No `unsafe-inline` anywhere.
- **Rationale**: Matches Next.js's official nonce-CSP recipe and satisfies Constitution principle II.
- **Alternatives rejected**:
  - **`unsafe-inline`** — loses XSS protection outright.
  - **Hash-based CSP** — brittle under Tailwind v4's runtime CSS vars.

## 17. Test runner choices

- **Decision**:
  - **Playwright** — the 8 critical flows enumerated in `plan.md` (Constitution IV).
  - **Vitest** — pure-function unit tests (`money.ts`, `split.ts`, `canadian-tax/dates.ts`). Fast, ESM-native, no Jest config.
- **Rationale**: Constitution mandates Playwright for critical flows and unit/integration for the rest. Vitest is the lightweight pick that won't drag in Babel.

## 18. Currency display

- **Decision**: All amounts formatted by `Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Sub-dollar values always display two decimals (FR-037 + edge case).
- **Rationale**: Platform-native, locale-correct (`CA$1,234.56` on en-CA), zero extra dependencies.

## 19. Quick Add architecture (FR-011a)

- **Decision**: New RPC `list_quick_add_options(p_limit int default 12)` returns up to 12 rows mixing the household's most recent unique-merchant expenses and the active subscriptions due in the next 30 days. Shape: `{ source: 'recent'|'subscription', source_id uuid, merchant text, amount_cents bigint, category_id uuid, category_name text, for_member_id uuid?, paid_by_member_id uuid?, essential_pct smallint, split_rule text?, last_occurred date }`. **Primary tap** on either source dispatches the same `log_expense` RPC the full form uses, copying every field from the source and setting `occurred_on = current_date` and a fresh client-generated `id` (UUID v7). For `source='subscription'`, the row additionally renders a **secondary pencil icon** that navigates to `/subscriptions/<source_id>/edit` (no log). The "+" affordance in the header routes to `/add` for never-before-seen merchants.
- **Rationale**: Reusing `log_expense` keeps the write path single-sourced; idempotency, RLS, realtime broadcast all come for free. Pre-aggregating "recent + subs" in one RPC keeps the cold load to one round-trip. Returning the *source* member ids (not denormalized copies) means tiles automatically reflect renames or income updates without a stale-data refresh. The dual-action subs row (log + edit) was added in spec clarification §9 (design v2 alignment) so users can both log a one-off occurrence and tweak the renewal/amount from the same screen.
- **Edge cases**:
  - If the source's `for_member_id` references a soft-deleted member, `list_quick_add_options` filters it out (the tag would surface a deleted person in a new entry, which the UI hides everywhere else).
  - Tapping a subscription tile manually creates a one-off transaction tagged with that subscription's `subscription_id` but with `occurrence_date = null`, so the unique idempotency index on `(subscription_id, occurrence_date)` does not collide with a future cron-driven auto-log.
- **Filter chips**: The hi-fi design v2 shows five chips on Quick Add — `Recent | Subs | Per kid | Merchants | Categories`. Only `Recent` and `Subs` are MVP (they correspond to the two content sections). `Per kid / Merchants / Categories` are non-normative client-side slicings of the same `list_quick_add_options` result set and may be added later without changing the RPC contract.
- **Alternatives rejected**:
  - **Two separate RPCs** (`list_recent_merchants` + `list_due_subscriptions`) — two round-trips on the cold load for no architectural gain.
  - **Client-side aggregation from `list_transactions` + `list_subscriptions`** — pulls more rows over the wire than needed and forces dedup logic into the browser.

## 20. Net-income simplification (income surface)

- **Decision**: `transaction.amount_cents` for `type='income'` is the **net (post-tax)** amount the user actually received. The `income_source` column (`Salary | Contract | Self_employed | Benefit | Refund | Gift`) is descriptive metadata only — it does NOT trigger GST/HST set-aside, withholding calculations, or any auto-aside transaction. The `gst_hst_setaside` table and `gst_hst_running_total` RPC are removed.
- **Label choice**: Friendlier labels (`Salary` etc.) replace the CRA-flavored `T4 / T4A / CCB` per spec clarification §9 because there is no Canadian-tax surface left in v1 to justify the jargon. Final enum: `Salary | Contract | Self_employed | Benefit | Refund | Gift`.
- **Rationale**: Matches the scope-reduction clarifications §6 and §9. Net-income entry mirrors what users see on their pay stub, removes a class of "did the app double-count taxes?" bugs, and lets us delete an entire subsystem (deductions, marginal rates, instalment calendars). The household's true tax obligation is handled outside the app in v1.
- **Migration note**: `0005_views_and_functions.sql` does NOT install the previous `log_income` trigger that inserted `gst_hst_setaside` rows.

## 21. Visual design system & token source

- **Decision**: The HIFI palette and typography in `specs/001-family-budget-app/design/project/hifi-shared.jsx` are the visual contract. They are lifted into the codebase as TypeScript constants in `components/tokens.ts` and wired into Tailwind v4's `@theme` block so they are usable as utility classes. Fonts are loaded via `next/font` (Geist + Geist Mono). The shared primitives (`FamilyAvatar`, `MerchantIcon`, `HFBar`, `HFSplitBar`, `HFDonut`, `AppBar`, `ChipsRow`, `SegControl`, `FAB`) are re-implemented as typed React components in `components/ui/`.
- **Rationale**: The design folder is a read-only handoff bundle (per its README — JSX prototypes, not production code). Copying tokens into the app insulates us from the design files moving or being deleted. The original spec assumption named JetBrains Mono + Inter; the hi-fi designs land on Geist + Geist Mono — the design supersedes the spec assumption for typography.
- **Out-of-spec content visible in designs** (not implemented in v1 unless added to spec): named bank accounts (RBC / EQ Bank / Questrade / Wealthsimple), "approval over $500" rule, "auto-categorize" rule, and (now confirmed out by clarification) per-kid wallet balances and weekly allowance auto-transfers. The Taxes hero, KPI trio, CRA instalment timeline, and deductions list visible in `hifi-screens-2.jsx → ScreenTaxes` are also not implemented in v1. These appear in the design as illustrative copy; v1 ships the spec's feature set with the design's visual treatment.

---

## Cross-cutting summary

| Concern | Decision |
|---|---|
| Auth provider | Supabase Auth, email+password, admin-provisioned users (no in-app signup) |
| Password policy | ≥8 chars + ≥1 digit + ≥1 symbol; Zod client + Supabase project config |
| Household creation | In-app on first sign-in via `create_household` RPC |
| Adding members | `add_adult_by_email` (lookup `auth.users`); `add_kid` (no auth account) |
| Member removal | Soft-delete via `deleted_at`; cap counts only non-deleted adults |
| Money type | `bigint` cents |
| Split residual | Floor + assign residual to higher-earning adult (Adult A on tie) |
| Backend comms | Supabase RPC into Postgres functions (Constitution III) |
| State management | Redux Toolkit — UI state only |
| Realtime | Supabase Realtime, channel per household |
| PWA | `@serwist/next` + IndexedDB outbox keyed by client UUID v7 |
| Charts | Recharts, dynamic-imported per report route |
| Recurring subs | `pg_cron` hourly `materialize_due_subscriptions()` |
| Canadian tax tracking | **Out of scope for v1** (US8 removed) |
| Income amount semantics | Net (post-tax); no auto tax/GST set-aside |
| Quick Add | `list_quick_add_options` RPC + tile-tap dispatches `log_expense` with copied tags + today's date |
| Validation | Zod, shared client+server |
| CSP | Nonce-based, generated in `lib/supabase/middleware.ts` |
| E2E tests | Playwright on the 9 critical flows in `plan.md` |
| Unit tests | Vitest for pure helpers |
| Visual design | HIFI tokens from `specs/001-family-budget-app/design/project/hifi-shared.jsx` → `components/tokens.ts` + Tailwind theme; Geist + Geist Mono via `next/font` |

All NEEDS CLARIFICATION markers are resolved.
