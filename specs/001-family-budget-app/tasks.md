---

description: "Task list for Family Budget App (Canadian PWA)"
---

# Tasks: Family Budget App (Canadian PWA)

**Input**: Design documents from `/specs/001-family-budget-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Constitution Principle IV mandates Playwright coverage for the 8 critical flows enumerated in `plan.md`; Vitest covers pure helpers.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. P1 stories (US1, US2) constitute the MVP slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user stories from spec.md (US1…US9)
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at repository root: `app/`, `components/`, `lib/`, `store/`, `supabase/`, `tests/`. Paths reflect the structure decided in `plan.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Add runtime dependencies to `package.json`: `@supabase/supabase-js`, `@supabase/ssr`, `@reduxjs/toolkit`, `react-redux`, `zod`, `recharts`, `date-fns`, `date-fns-tz`, `@serwist/next`
- [ ] T002 [P] Add dev dependencies to `package.json`: `vitest`, `@vitest/ui`, `@playwright/test`, `@testing-library/react`, `jsdom`, `supabase` (CLI)
- [ ] T003 [P] Add npm scripts to `package.json`: `test:unit` (vitest), `test:e2e` (playwright), `typecheck` (tsc --noEmit)
- [ ] T004 [P] Create `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` (the last is read by migration tooling, never by app code)
- [ ] T005 [P] Update `.gitignore` to add `.env.local`, `.env*.local`, `playwright-report/`, `test-results/`, `coverage/`
- [ ] T006 Create directory scaffolding per plan structure: `app/(auth)/`, `app/(app)/`, `components/{ui,layout,transactions,reports,family,budget}/`, `lib/{supabase,validators,pwa,canadian-tax,formatters}/`, `store/slices/`, `supabase/{migrations,policies,functions}/`, `tests/{e2e,unit}/`
- [ ] T007 [P] Add `vitest.config.ts` at repo root with jsdom env, path alias to match `tsconfig.json`
- [ ] T008 [P] Add `playwright.config.ts` at repo root targeting `http://localhost:3023`, with `webServer: { command: 'npm run dev', port: 3023 }`, Chromium + WebKit projects, mobile viewport `375x812` default
- [ ] T009 [P] Tighten `eslint.config.mjs` with `@typescript-eslint/no-explicit-any: 'error'` and ban `@ts-ignore` / `@ts-nocheck`
- [ ] T010 Initialize Supabase local config at `supabase/config.toml` and add `supabase/migrations/` placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T011 Migration `supabase/migrations/0001_init.sql`: enable `pgcrypto`, `citext`, `pg_cron` extensions; create `update_timestamp()` trigger function used by every table; create shared helper `auth_user_household_ids()` returning the set of household ids the calling `auth.uid()` belongs to (used by every RLS policy)
- [ ] T012 [P] Supabase server client (App Router-compatible, cookie-aware) in `lib/supabase/server.ts`
- [ ] T013 [P] Supabase browser client in `lib/supabase/client.ts`
- [ ] T014 Supabase request middleware (session refresh + per-request CSP nonce) in `lib/supabase/middleware.ts`, wired through `middleware.ts` at repo root
- [ ] T015 [P] Root layout with `next/font`, CSP nonce header, viewport meta `width=device-width,initial-scale=1`, themed `<html>` in `app/layout.tsx`
- [ ] T016 [P] PWA manifest (name, short_name, theme color from spec palette, 192/512 icons) in `app/manifest.ts`
- [ ] T017 [P] Serwist service worker entry in `app/sw.ts` (app-shell precache + stale-while-revalidate for static, network-first for routes)
- [ ] T018 [P] Auth route group layout (minimal shell, no drawer) in `app/(auth)/layout.tsx`
- [ ] T019 Authenticated route group layout in `app/(app)/layout.tsx`: gates unauthenticated users to `/login`, mounts hamburger drawer, opens realtime subscription
- [ ] T020 [P] Hamburger drawer component in `components/layout/AppDrawer.tsx` (links: Dashboard, Add, Transactions, Budget, Family, Reports, Subscriptions, Taxes, Settings, Sign out)
- [ ] T021 [P] Shared UI primitives (Button, Input, NumberInput, Chip, Modal/Sheet, Toast, EmptyState, ErrorState, Skeleton) in `components/ui/`
- [ ] T022 [P] Money helpers (cents↔dollars, `formatCAD`, integer math for split) in `lib/money.ts`
- [ ] T023 [P] Pure income-split helper mirroring the SQL `compute_income_split` for UI previews in `lib/split.ts`
- [ ] T024 [P] Base Zod schemas (uuid, money_cents, percent_0_100, province_enum, cadence_enum) in `lib/validators/index.ts`
- [ ] T025 [P] Redux store skeleton + drawer slice in `store/index.ts` and `store/slices/drawer.ts`; Provider wired in `app/(app)/layout.tsx`
- [ ] T026 [P] Canadian-tax module skeleton (province codes, CRA quarterly dates Mar/Jun/Sep/Dec 15, filing deadlines Apr 30 / Jun 15) anchored to `America/Toronto` in `lib/canadian-tax/dates.ts` and `lib/canadian-tax/index.ts`
- [ ] T027 [P] Offline outbox scaffolding (IndexedDB store + enqueue/replay API) in `lib/pwa/outbox.ts` and `store/slices/outbox.ts`
- [ ] T028 [P] Realtime channel hook `useHouseholdRealtime(householdId)` in `lib/supabase/realtime.ts` that triggers `revalidateTag('household:<id>')` on incoming INSERT/UPDATE/DELETE
- [ ] T029 Root index page redirect — signed-in users to `/dashboard`, anonymous to `/login` — in `app/page.tsx`

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Secure household account access (Priority: P1) 🎯 MVP

**Goal**: A family can sign up, sign in, sign out, and invite a second adult so both share the same household.

**Independent Test**: Sign up Alex → empty dashboard. Sign out. Sign in → same dashboard. Invite Bea by email → Bea accepts the invite link → both adults see the same household state.

### Tests for User Story 1

- [ ] T030 [P] [US1] Playwright auth flow (signup, signin happy path, wrong-password error, signout, session persistence on reload) in `tests/e2e/auth.spec.ts`
- [ ] T031 [P] [US1] Playwright household-invite flow (owner creates invite, second adult signs up and accepts, both adults see shared empty state) in `tests/e2e/household-invite.spec.ts`

### Implementation for User Story 1

- [ ] T032 [US1] Migration `supabase/migrations/0002_household.sql`: `household`, `household_member`, `household_invite` tables; RLS enabled; `<table>_household_isolation` policies; trigger preventing >2 adults per household
- [ ] T033 [P] [US1] SQL function `create_household(name)` (security definer) in `supabase/functions/create_household.sql`
- [ ] T034 [P] [US1] SQL function `create_invite(email)` with 7-day expiry + unique partial index on `(household_id, lower(email))` for unaccepted invites in `supabase/functions/create_invite.sql`
- [ ] T035 [P] [US1] SQL function `accept_invite(token)` (security definer) in `supabase/functions/accept_invite.sql`
- [ ] T036 [P] [US1] SQL function `revoke_invite(invite_id)` in `supabase/functions/revoke_invite.sql`
- [ ] T037 [P] [US1] Zod schemas for signup/signin/invite-email in `lib/validators/auth.ts`
- [ ] T038 [P] [US1] Login page + server action (`supabase.auth.signInWithPassword`) in `app/(auth)/login/page.tsx`
- [ ] T039 [P] [US1] Signup page + server action that calls `auth.signUp` then `rpc('create_household', { name })` in `app/(auth)/signup/page.tsx`
- [ ] T040 [P] [US1] Invite acceptance page that calls `rpc('accept_invite', { token })` after signin/signup in `app/(auth)/invite/[token]/page.tsx`
- [ ] T041 [US1] Sign-out server action and drawer affordance in `app/(app)/_actions/signout.ts` (and consumed by `AppDrawer`)
- [ ] T042 [US1] Settings → household section (rename household, create/list/revoke invites) in `app/(app)/settings/page.tsx`

**Checkpoint**: User Story 1 fully functional — auth + household invite work end-to-end.

---

## Phase 4: User Story 2 - Log expenses and income, see household balance (Priority: P1) 🎯 MVP

**Goal**: Either adult can log an expense or income; the dashboard balance, recent activity, and essential/treats summary reflect the change in real time.

**Independent Test**: Log 5 expenses + 2 incomes on Adult A's device → open app on Adult B's device → identical balance, identical recent activity, dashboard correct, within 5 s (SC-003).

### Tests for User Story 2

- [ ] T043 [P] [US2] Playwright expense-logging flow (log expense, balance decrements, second device sees it via realtime, edit, delete) in `tests/e2e/log-expense.spec.ts`

### Implementation for User Story 2

- [ ] T044 [US2] Migration `supabase/migrations/0003_transactions.sql`: `category` (with system-global seed rows where `household_id is null`), `transaction` tables; indexes `(household_id, occurred_on desc)`, `(household_id, category_id, occurred_on)`, GIN on `to_tsvector('simple', notes)`; RLS policies
- [ ] T045 [P] [US2] SQL function `log_expense(payload)` with category-default essential_pct lookup and idempotent client UUID in `supabase/functions/log_expense.sql`
- [ ] T046 [P] [US2] SQL function `log_income(payload)` + trigger that inserts a `gst_hst_setaside` row when income source is GST/HST-applicable in `supabase/functions/log_income.sql`
- [ ] T047 [P] [US2] SQL function `update_transaction(id, patch)` in `supabase/functions/update_transaction.sql`
- [ ] T048 [P] [US2] SQL function `delete_transaction(id)` in `supabase/functions/delete_transaction.sql`
- [ ] T049 [P] [US2] SQL view `transaction_view` (joined with category + member display names) and SQL function `list_transactions(filters)` in `supabase/functions/list_transactions.sql`
- [ ] T050 [P] [US2] SQL function `get_dashboard_summary(year, month)` returning `{ balance_cents, left_to_spend_this_month_cents, essential_spent_cents, treats_spent_cents, recent }` in `supabase/functions/get_dashboard_summary.sql`
- [ ] T051 [P] [US2] Zod schemas for transaction create / update / delete in `lib/validators/transaction.ts`
- [ ] T052 [P] [US2] Add-transaction page (RSC + server action that calls `rpc('log_expense' | 'log_income')`) in `app/(app)/add/page.tsx`
- [ ] T053 [US2] Dashboard page (calls `rpc('get_dashboard_summary')`) with balance, "left to spend", essential/treats summary, recent activity strip in `app/(app)/dashboard/page.tsx`
- [ ] T054 [P] [US2] `TxnRow` component in `components/transactions/TxnRow.tsx`
- [ ] T055 [US2] Edit/delete transaction sheet in `components/transactions/EditTxnSheet.tsx`
- [ ] T056 [US2] Wire realtime subscription in `app/(app)/layout.tsx` to invoke `revalidateTag('household:<id>:transactions')` on incoming changes (depends on T028)
- [ ] T057 [US2] Extend offline outbox in `lib/pwa/outbox.ts` to call `log_expense`/`log_income` with client-supplied UUID, surface a "queued" badge from `store/slices/outbox.ts` (depends on T027)

**Checkpoint**: MVP complete (US1 + US2). The app delivers core value: shared household + capturing money in/out + live dashboard.

---

## Phase 5: User Story 3 - Family-aware expense tagging (Priority: P2)

**Goal**: Every expense can be tagged with "for whom" and split essential/treats; categories carry default splits; reports reflect both portions.

**Independent Test**: Tag 10 expenses across members + essential states → dashboard shows correct essential-vs-treats totals; per-person summary on dashboard reflects the tags.

### Tests for User Story 3

- [ ] T058 [P] [US3] Playwright "for whom" + split flow (tag expense for kid, slide split 76/24, verify both portions stored and reflected) in `tests/e2e/for-whom-and-split.spec.ts`

### Implementation for User Story 3

- [ ] T059 [P] [US3] SQL function `set_category_essential_pct(category_id, pct)` with clone-on-write for system-global categories in `supabase/functions/set_category_essential_pct.sql`
- [ ] T060 [P] [US3] "For whom" chip selector (Household + Adult chips + Kid chips) in `components/transactions/ForWhomChips.tsx`
- [ ] T061 [P] [US3] Essential split slider (0–100, snaps at 25/50/75/100) in `components/transactions/SplitSlider.tsx`
- [ ] T062 [US3] Wire `ForWhomChips` + `SplitSlider` into the add-transaction form in `app/(app)/add/page.tsx` (extends T052)
- [ ] T063 [US3] Dashboard "Per-person spending this month" mini-panel powered by `get_dashboard_summary` extension in `app/(app)/dashboard/page.tsx` (extends T053)

**Checkpoint**: US3 functional — family-aware tagging and split work end-to-end.

---

## Phase 6: User Story 4 - Household members & income-proportional split (Priority: P2)

**Goal**: Manage 2 adults + N kids; logged adult incomes drive a derived "by income" split rule.

**Independent Test**: Add 2 adults with incomes $5,800 and $2,485 + 4 kids → settings shows ~70/30 derived ratio → choose "Split: by income" on a $142 expense → each adult's share is computed and shown immediately; ratio updates when an income changes.

### Tests for User Story 4

- [ ] T064 [P] [US4] Playwright income-split flow (two incomes, scaled household, by-income split derivation, ratio updates after income change, zero-income fallback) in `tests/e2e/income-split.spec.ts`

### Implementation for User Story 4

- [ ] T065 [P] [US4] SQL function `compute_income_split(household_id)` (stable, security invoker, zero-income fallback to equal split) in `supabase/functions/compute_income_split.sql`
- [ ] T066 [P] [US4] SQL function `add_member(role, display_name, age_years?)` enforcing 2-adult cap in `supabase/functions/add_member.sql`
- [ ] T067 [P] [US4] SQL function `update_member_income(member_id, monthly_income_cents)` in `supabase/functions/update_member_income.sql`
- [ ] T068 [P] [US4] SQL function `apply_split_rule(transaction_id)` returning each adult's owed share as a record set in `supabase/functions/apply_split_rule.sql`
- [ ] T069 [P] [US4] Family screen (member list + add adult/kid + edit income) in `app/(app)/family/page.tsx`
- [ ] T070 [P] [US4] `MemberCard` and `KidGrid` (wraps cleanly at 340 px viewport) in `components/family/MemberCard.tsx` and `components/family/KidGrid.tsx`
- [ ] T071 [US4] Income-split rule view in Settings (consumes `compute_income_split` live) in `app/(app)/settings/page.tsx` (extends T042)
- [ ] T072 [US4] Add "Split: by income" chip on the transaction form, showing live per-adult shares via `apply_split_rule` in `app/(app)/add/page.tsx` (extends T062)

**Checkpoint**: US4 functional — household scales to N kids; by-income split is derived live.

---

## Phase 7: User Story 5 - Budget overview by category (Priority: P3)

**Goal**: Set monthly per-category limits; see progress bars; filter All/Essential/Treats.

**Independent Test**: Set 5 category limits + log expenses → budget overview shows accurate progress bars with correct essential/treats split per category.

### Tests for User Story 5

- [ ] T073 [P] [US5] Playwright budget flow (set $800 Groceries limit, log expenses, verify 75% progress, over-budget visual state, filter All/Essential/Treats) in `tests/e2e/budget.spec.ts`

### Implementation for User Story 5

- [ ] T074 [P] [US5] SQL function `set_category_budget(category_id, monthly_budget_cents?)` with clone-on-write in `supabase/functions/set_category_budget.sql`
- [ ] T075 [P] [US5] SQL function `get_budget_progress(year, month, filter)` returning per-category rows in `supabase/functions/get_budget_progress.sql`
- [ ] T076 [P] [US5] `CategoryRow` progress-bar component with over-budget visual variant in `components/budget/CategoryRow.tsx`
- [ ] T077 [P] [US5] Budget page (calls `rpc('get_budget_progress')`) in `app/(app)/budget/page.tsx`
- [ ] T078 [US5] All/Essential/Treats filter chips backed by a Redux UI slice in `store/slices/filters.ts` and consumed by `app/(app)/budget/page.tsx`

**Checkpoint**: US5 functional — budgets visible with live progress.

---

## Phase 8: User Story 6 - Transactions list with filters and search (Priority: P3)

**Goal**: Browse all transactions grouped by date with search, category filter, "for whom" filter, essential/treats filter, and date range.

**Independent Test**: Log 30 mixed transactions → search by merchant, filter by person, filter by essential, combine with date range — each filter returns the expected subset.

### Implementation for User Story 6

- [ ] T079 [P] [US6] Filters slice extension (search text, chips, date range) in `store/slices/filters.ts` (extends T078)
- [ ] T080 [P] [US6] `FilterChips` and search input components in `components/transactions/FilterChips.tsx`
- [ ] T081 [US6] Transactions list page grouped by `occurred_on` desc, paginated, hits `rpc('list_transactions')` with filter args, in `app/(app)/transactions/page.tsx`

**Checkpoint**: US6 functional — full transaction browsing.

---

## Phase 9: User Story 7 - Reports & visual analytics (Priority: P3)

**Goal**: Four reports — spend-over-time, cashflow KPIs, per-person pie with "include general expenses" toggle, essentials breakdown — fed by RPC reads.

**Independent Test**: Populate a month of transactions; open each report; numbers and visuals match underlying data; per-person pie recomposes within 500 ms (SC-006) when toggle flips.

### Implementation for User Story 7

- [ ] T082 [P] [US7] SQL function `spend_over_time(range)` in `supabase/functions/spend_over_time.sql`
- [ ] T083 [P] [US7] SQL function `cashflow_kpis(range)` including server-formatted `insights[]` strings in `supabase/functions/cashflow_kpis.sql`
- [ ] T084 [P] [US7] SQL function `per_person_breakdown(year, month, include_general)` (consumes `compute_income_split` when toggle is on) in `supabase/functions/per_person_breakdown.sql`
- [ ] T085 [P] [US7] SQL function `essentials_breakdown(year, month)` returning overall donut + recurring essential/treats lists in `supabase/functions/essentials_breakdown.sql`
- [ ] T086 [US7] Reports layout (tab strip across the 4 reports) in `app/(app)/reports/layout.tsx`
- [ ] T087 [P] [US7] Recharts dynamic-import wrapper (lazy via `next/dynamic({ ssr: false })`) in `components/reports/charts.tsx`
- [ ] T088 [P] [US7] Spend-over-time page in `app/(app)/reports/spend-over-time/page.tsx`
- [ ] T089 [P] [US7] Cashflow KPIs page in `app/(app)/reports/cashflow/page.tsx`
- [ ] T090 [P] [US7] Per-person pie page with the include-general-expenses toggle in `app/(app)/reports/per-person/page.tsx`
- [ ] T091 [P] [US7] Essentials breakdown page (overall donut + recurring lists + treats percent) in `app/(app)/reports/essentials/page.tsx`

**Checkpoint**: US7 functional — all four reports render correctly.

---

## Phase 10: User Story 8 - Canadian tax tracking (Priority: P3)

**Goal**: Taxes screen surfaces CRA instalment + filing deadlines, marginal rate for the chosen province, categorized deductions, GST/HST set-aside running total.

**Independent Test**: Select Sole Proprietor · ON profile → Taxes screen shows Mar/Jun/Sep/Dec 15 instalment dates + Apr 30 + Jun 15 filing deadlines, Ontario marginal rate, and Canadian deduction categories (T2125, T2202, etc.).

### Implementation for User Story 8

- [ ] T092 [US8] Migration `supabase/migrations/0006_tax.sql`: `deduction`, `gst_hst_setaside` tables + RLS policies
- [ ] T093 [P] [US8] SQL function `set_tax_profile(province, tax_profile, gst_hst_registrant)` in `supabase/functions/set_tax_profile.sql`
- [ ] T094 [P] [US8] SQL function `log_deduction(payload)` in `supabase/functions/log_deduction.sql`
- [ ] T095 [P] [US8] SQL function `list_deductions(tax_year, member_id?)` + `deduction_view` in `supabase/functions/list_deductions.sql`
- [ ] T096 [P] [US8] SQL function `gst_hst_running_total()` in `supabase/functions/gst_hst_running_total.sql`
- [ ] T097 [P] [US8] Provincial marginal-rate tables (ON, BC, AB, QC at minimum) + CRA deduction-category labels in `lib/canadian-tax/data.ts` (extends T026)
- [ ] T098 [P] [US8] Taxes screen (timeline of CRA dates + marginal rate display + deduction list + GST/HST set-aside total) in `app/(app)/taxes/page.tsx`
- [ ] T099 [US8] Tax profile editor (province + filer type + GST/HST registrant flag) in Settings, calling `rpc('set_tax_profile')`, in `app/(app)/settings/page.tsx` (extends T071)

**Checkpoint**: US8 functional — CRA dates, marginal rate, deductions, and GST/HST tracking visible.

---

## Phase 11: User Story 9 - Subscriptions and recurring expenses (Priority: P3)

**Goal**: Register recurring expenses with cadence and renewal; subscriptions auto-log a transaction on renewal; overlapping subs flagged for savings.

**Independent Test**: Add 5 subscriptions with different cadences; advance the renewal dates past today; verify each auto-logs a transaction with correct tags within hourly cadence (test scenario shortens the wait).

### Tests for User Story 9

- [ ] T100 [P] [US9] Playwright subscription-auto-log flow (register $19.99 monthly Netflix tagged Household/Treats, force-run materialize, verify auto-logged transaction with correct tags + idempotency on re-run) in `tests/e2e/subscription-auto-log.spec.ts`

### Implementation for User Story 9

- [ ] T101 [US9] Migration `supabase/migrations/0005_subscriptions.sql`: `subscription` table; unique idempotent index on `transaction(subscription_id, occurrence_date) where subscription_id is not null`; schedule `select cron.schedule('subscriptions-hourly', '0 * * * *', 'select materialize_due_subscriptions();')`
- [ ] T102 [P] [US9] SQL function `register_subscription(payload)` in `supabase/functions/register_subscription.sql`
- [ ] T103 [P] [US9] SQL functions `update_subscription`, `pause_subscription`, `resume_subscription` in `supabase/functions/subscription_lifecycle.sql`
- [ ] T104 [P] [US9] SQL function `materialize_due_subscriptions()` (security definer, advances `next_renewal_at` by cadence) in `supabase/functions/materialize_due_subscriptions.sql`
- [ ] T105 [P] [US9] SQL function `list_overlapping_subscriptions()` returning cluster rows in `supabase/functions/list_overlapping_subscriptions.sql`
- [ ] T106 [P] [US9] Subscriptions page (list + add + pause/resume + overlap callout) in `app/(app)/subscriptions/page.tsx`
- [ ] T107 [US9] "Overlapping subs · review to save $X/mo" callout integrated into the essentials breakdown report in `app/(app)/reports/essentials/page.tsx` (extends T091)

**Checkpoint**: US9 functional — subscriptions register and auto-log idempotently; savings callout surfaces.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Finish constitution-mandated quality gates and run the quickstart validation

- [ ] T108 [P] Playwright offline-replay flow (turn off network, log expense, badge shows "queued", reconnect, badge clears, row persists) in `tests/e2e/offline-replay.spec.ts`
- [ ] T109 [P] Vitest unit tests for `lib/money.ts` (cents↔dollars, CAD format, sub-dollar edge case) in `tests/unit/money.test.ts`
- [ ] T110 [P] Vitest unit tests for `lib/split.ts` (ratio derivation, zero-income fallback, single-adult degenerate case) in `tests/unit/split.test.ts`
- [ ] T111 [P] Vitest unit tests for `lib/canadian-tax/dates.ts` (CRA dates across leap years, ON→QC switch) in `tests/unit/tax-dates.test.ts`
- [ ] T112 [P] 340 px-viewport visual sweep across every authenticated screen with 0, 2, 6, 8 kids (no horizontal scroll, no truncation) — recorded as a manual checklist in `tests/manual/viewport-sweep.md`
- [ ] T113 Run quickstart.md 10-step validation end-to-end against a fresh Supabase project
- [ ] T114 [P] Document deployment + env setup in `README.md` (replaces the Vercel boilerplate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–11)**: All depend on Foundational completion
  - US1 → US2 ordering recommended (US2 uses households created by US1)
  - US3 → US4 ordering recommended within P2 (US3's split slider is used by US4's by-income display)
  - US5–US9 are independent and may run in any order or in parallel
- **Polish (Phase 12)**: Depends on US1 + US2 at minimum; offline-replay test depends on US2

### User Story Dependencies

- **US1 (P1)**: Independent — first.
- **US2 (P1)**: Depends only on US1's `household` table existing (Phase 3 migration).
- **US3 (P2)**: Depends on US2's transaction tables; otherwise independent.
- **US4 (P2)**: Depends on US2's transaction tables (uses `paid_by_member_id` and `for_member_id`); reuses US3's split slider.
- **US5 (P3)**: Depends on US2's transactions + categories.
- **US6 (P3)**: Depends on US2's transactions + (optionally) US3's tags for the filter UI.
- **US7 (P3)**: Depends on US2 minimum; per-person report depends on US4's `compute_income_split`.
- **US8 (P3)**: Depends on US1's household row (for province + tax_profile columns).
- **US9 (P3)**: Depends on US2's transaction table (for the auto-log insert).

### Within Each User Story

- Tests written first, expected to FAIL before implementation
- Migrations before SQL functions (functions depend on tables)
- SQL functions and components marked [P] can run in parallel
- Server actions / page wiring last, after the RPCs they call exist

### Parallel Opportunities

- All [P] tasks within Phase 1 (Setup) — about 7 of them
- All [P] tasks within Phase 2 (Foundational) — about 12 of them
- After Phase 2, US1 + US2 can be staffed independently (different file sets except where US2's transaction migration references the `household` row created by US1's migration)
- Within US2: the 6 SQL functions (T045–T050) plus the form (T052) and components (T054) are largely parallelizable
- Within US7: all 4 SQL functions (T082–T085) and all 4 report pages (T088–T091) are parallelizable

---

## Parallel Example: User Story 2

```bash
# Launch the SQL function tasks together once 0003_transactions.sql is applied:
Task: "SQL function log_expense in supabase/functions/log_expense.sql"
Task: "SQL function log_income in supabase/functions/log_income.sql"
Task: "SQL function update_transaction in supabase/functions/update_transaction.sql"
Task: "SQL function delete_transaction in supabase/functions/delete_transaction.sql"
Task: "SQL function list_transactions in supabase/functions/list_transactions.sql"
Task: "SQL function get_dashboard_summary in supabase/functions/get_dashboard_summary.sql"

# In parallel, the UI components that don't yet need the wiring:
Task: "TxnRow component in components/transactions/TxnRow.tsx"
Task: "Zod transaction schemas in lib/validators/transaction.ts"
Task: "Playwright log-expense.spec.ts in tests/e2e/log-expense.spec.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — auth + household + invite
4. Complete Phase 4: US2 — log expenses/income + dashboard + realtime
5. **STOP and VALIDATE**: Run the auth + log-expense + household-invite Playwright suites against a fresh Supabase project. Both adults can sign in, log money in/out, and see each other's activity within 5 s. This is the MVP demo.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. + US1 + US2 → MVP (ship-able to friends-and-family)
3. + US3 + US4 → "Family-aware budgeting" milestone (the spec's core differentiator)
4. + US5 → Budget overview
5. + US6 → Search + filter
6. + US7 → Reports
7. + US8 → Canadian tax
8. + US9 → Subscriptions auto-log
9. Polish phase → Offline replay test + viewport sweep + quickstart validation

### Parallel Team Strategy

With multiple developers post-foundation:

1. Dev A: US1 → US2 (P1 path)
2. Dev B: US3 → US4 (P2 path, after US2 migrations land)
3. Dev C: Picks one of US5 / US6 / US7 / US8 / US9 per sprint (P3)
4. The polish phase is shared.

---

## Notes

- Every SQL function is invoked via `rpc(<fn_name>, args)` from server actions or RSCs — never via a bespoke REST handler. Constitution Principle III.
- Every table created across phases must enable RLS in the same migration. Constitution Principle II.
- Each Playwright spec is its own task because each maps to one of the 8 constitution-required critical flows in `plan.md`. Constitution Principle IV.
- [P] markers indicate file-level disjointness; tasks that touch the same file (e.g. `app/(app)/settings/page.tsx` gets extended across T042 → T071 → T099) are sequenced, not parallel.
- Commit after each task or coherent group; descriptive imperative messages per constitution.
