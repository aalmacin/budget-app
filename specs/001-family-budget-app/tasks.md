---

description: "Task list for Family Budget App (Canadian PWA)"
---

# Tasks: Family Budget App (Canadian PWA)

**Input**: Design documents from `/specs/001-family-budget-app/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Constitution Principle IV mandates Playwright coverage for the 9 critical flows enumerated in `plan.md`; Vitest covers pure helpers.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. The two P1 stories (US1, US2) plus the P1 Quick Add (US2b) constitute the MVP slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Maps to user stories from spec.md (US1, US2, US2b, US3, US4, US5, US6, US7, US9). US8 was removed in the scope-reduction clarification.
- Include exact file paths in descriptions

## Path Conventions

Single Next.js app at repository root: `app/`, `components/`, `lib/`, `store/`, `supabase/`, `tests/`. Paths reflect the structure decided in `plan.md`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Add runtime dependencies to `package.json`: `@supabase/supabase-js`, `@supabase/ssr`, `@reduxjs/toolkit`, `react-redux`, `zod`, `recharts`, `date-fns`, `@serwist/next` (note: `date-fns-tz` is NOT needed in v1 — US8 removed)
- [X] T002 [P] Add dev dependencies to `package.json`: `vitest`, `@vitest/ui`, `@playwright/test`, `@testing-library/react`, `jsdom`, `supabase` (CLI)
- [X] T003 [P] Add npm scripts to `package.json`: `test:unit` (vitest), `test:e2e` (playwright), `typecheck` (tsc --noEmit)
- [X] T004 [P] Create `.env.example` documenting `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` (last is read by migration tooling, never by app code)
- [X] T005 [P] Update `.gitignore` to add `.env.local`, `.env*.local`, `playwright-report/`, `test-results/`, `coverage/`
- [X] T006 Create directory scaffolding per plan structure: `app/(auth)/`, `app/(app)/`, `components/{ui,layout,transactions,reports,family,budget,quick-add}/`, `lib/{supabase,validators,pwa,formatters}/`, `store/slices/`, `supabase/{migrations,policies,functions}/`, `tests/{e2e,unit}/`
- [X] T007 [P] Add `vitest.config.ts` at repo root with jsdom env and path alias matching `tsconfig.json`
- [X] T008 [P] Add `playwright.config.ts` at repo root targeting `http://localhost:3023`, `webServer: { command: 'npm run dev', port: 3023 }`, Chromium + WebKit projects, mobile viewport 375x812 default
- [X] T009 [P] Tighten `eslint.config.mjs` with `@typescript-eslint/no-explicit-any: 'error'` and ban `@ts-ignore` / `@ts-nocheck`
- [X] T010 Initialize Supabase local config at `supabase/config.toml` and create `supabase/migrations/` placeholder

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T011 Migration `supabase/migrations/0001_init.sql`: enable `pgcrypto`, `citext`, `pg_cron` extensions; create `update_timestamp()` trigger function used by every table; create shared helper `auth_user_household_ids()` returning the set of household ids the calling `auth.uid()` belongs to (active members only, used by every RLS policy)
- [X] T012 [P] Supabase server client (App Router-compatible, cookie-aware) in `lib/supabase/server.ts`
- [X] T013 [P] Supabase browser client in `lib/supabase/client.ts`
- [X] T014 Supabase request middleware (session refresh + per-request CSP nonce) in `lib/supabase/middleware.ts`, wired through `proxy.ts` at repo root (Next.js 16 renamed the `middleware` file convention to `proxy`; the lib/supabase helper retains its name)
- [X] T015 [P] Root layout with `next/font` (Geist + Geist Mono), CSP nonce header, viewport meta `width=device-width,initial-scale=1`, themed `<html>` in `app/layout.tsx`
- [X] T016 [P] PWA manifest (name "Budget", short_name "Budget", theme color `#2a3d33` from HIFI palette, 192/512 icons) in `app/manifest.ts`
- [X] T017 [P] Serwist service worker entry in `app/sw.ts` (app-shell precache + stale-while-revalidate for static, network-first for routes)
- [X] T018 [P] Auth route group layout (minimal shell, no drawer) in `app/(auth)/layout.tsx`
- [X] T019 Authenticated route group layout in `app/(app)/layout.tsx`: gates unauthenticated users to `/login`, redirects users with no active `household_member` row to `/onboarding/create-household`, mounts hamburger drawer, opens realtime subscription
- [X] T020 [P] Hamburger drawer component in `components/layout/AppDrawer.tsx` (links: Dashboard, Quick Add, Transactions, Budget, Family, Reports, Subscriptions, Add Income, Settings, Sign out — note: NO Taxes link in v1)
- [X] T021 [P] Shared UI primitives (Button, IconButton, MenuButton, Input, NumberInput, AmountHero, Chip, ChipsRow, SegControl, Sheet, Modal, Toast, EmptyState, ErrorState, Skeleton, PageTitle, AppBar, FAB) in `components/ui/`
- [X] T022 [P] Shared visual primitives derived from `specs/001-family-budget-app/design/project/hifi-shared.jsx`: `FamilyAvatar.tsx`, `MerchantIcon.tsx`, `Bar.tsx`, `SplitBar.tsx`, `Donut.tsx` in `components/ui/`
- [X] T023 [P] HIFI design tokens lifted from `specs/001-family-budget-app/design/project/hifi-shared.jsx` to `components/tokens.ts` and wired into Tailwind v4's `@theme` block in `app/globals.css`
- [X] T024 [P] Money helpers (cents↔dollars, `formatCAD`, integer math) in `lib/money.ts`
- [X] T025 [P] Pure income-split helper mirroring SQL `compute_income_split` + `apply_split_rule` (including the floor + residual-to-higher-earner rule per spec clarification §3) for UI previews in `lib/split.ts`
- [X] T026 [P] Base Zod schemas (uuid, money_cents, percent_0_100, cadence_enum, split_rule_enum) in `lib/validators/index.ts`
- [X] T027 [P] Redux store skeleton + drawer slice in `store/index.ts` and `store/slices/drawer.ts`; Provider wired in `app/(app)/layout.tsx`
- [X] T028 [P] Offline outbox scaffolding (IndexedDB store + enqueue/replay API keyed by client UUID v7) in `lib/pwa/outbox.ts` and `store/slices/outbox.ts`
- [X] T029 [P] Realtime channel hook `useHouseholdRealtime(householdId)` in `lib/supabase/realtime.ts` that triggers `revalidateTag('household:<id>')` on incoming INSERT/UPDATE/DELETE on `transaction`
- [X] T030 Root index page redirect — signed-in users to `/dashboard`, anonymous to `/login` — in `app/page.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 — Sign-in & household onboarding (Priority: P1) 🎯 MVP

**Goal**: An admin-provisioned user can sign in, create their household on first sign-in, add the second adult by email lookup, add kids by name + age, and soft-delete members.

**Independent Test**: Admin pre-creates `alex@example.com` and `bea@example.com` in Supabase. Sign in as Alex → routed to `/onboarding/create-household` → name household → empty dashboard. Family screen → add Bea by email (success). Add 4 kids. Soft-delete one kid → hidden from selectors but historical attribution intact. Sign in as Bea → directly to the shared dashboard.

### Tests for User Story 1

- [X] T031 [P] [US1] Playwright sign-in + onboarding flow (admin-created user → first sign-in → routed to onboarding → create household → dashboard) in `tests/e2e/signin-onboarding.spec.ts`
- [X] T032 [P] [US1] Playwright existing-member sign-in (user with active membership → direct to dashboard) in `tests/e2e/signin-existing-member.spec.ts`
- [X] T033 [P] [US1] Playwright add-adult-by-email flow (success, `no_account` error, idempotent re-add as `already_member`, 2-adult cap rejection) in `tests/e2e/add-adult-by-email.spec.ts`
- [X] T034 [P] [US1] Playwright soft-delete-member flow (remove member → hidden from family/chips/selectors → historical reports still attribute prior spend) in `tests/e2e/soft-delete-member.spec.ts`

### Implementation for User Story 1

- [X] T035 [US1] Migration `supabase/migrations/0002_household.sql`: `household` (no `province`/`tax_profile`/`gst_hst_registrant`), `household_member` (incl. `deleted_at`); RLS enabled; `<table>_household_isolation` policies filtering on `deleted_at IS NULL`; trigger `enforce_adult_cap` counting only active adults; unique partial index `(household_id, user_id) where user_id is not null`
- [X] T036 [P] [US1] SQL function `create_household(name)` (`security definer`, pinned `search_path`) — inserts `household` + caller's `household_member` row in one tx — in `supabase/functions/create_household.sql`
- [X] T037 [P] [US1] SQL function `add_adult_by_email(email)` (`security definer`) returning `record { status, member_id }` with statuses `inserted | already_member | self_member` and `P0001` errors for `no_account` / `cap_reached` — in `supabase/functions/add_adult_by_email.sql`
- [X] T038 [P] [US1] SQL function `add_kid(display_name, age_years)` (`security invoker`, validates 0..25) in `supabase/functions/add_kid.sql`
- [X] T039 [P] [US1] SQL function `soft_delete_member(member_id)` (idempotent, rejects self-delete when only active adult) in `supabase/functions/soft_delete_member.sql`
- [X] T040 [P] [US1] SQL function `update_member_income(member_id, monthly_income_cents)` rejecting kids and soft-deleted members in `supabase/functions/update_member_income.sql`
- [X] T041 [P] [US1] SQL function `update_household(patch)` (name only in v1; province/tax_profile fields don't exist) in `supabase/functions/update_household.sql`
- [X] T042 [P] [US1] Zod schemas for sign-in (incl. password policy ≥8 + ≥1 digit + ≥1 symbol per FR-001a) and household/member inputs in `lib/validators/auth.ts` and `lib/validators/household.ts`
- [ ] T042a [US1] Configure Supabase Auth project-level password policy to enforce FR-001a (min length 8, ≥1 digit, ≥1 symbol, max length ≥64, paste allowed). Follow the manual steps already documented in `quickstart.md` §3 and verify in the Supabase dashboard → Authentication → Providers → Email. This is the server-side backstop for the Zod client-side rule in T042; without it admin-set / admin-reset passwords could bypass FR-001a. *(Manual operator step — pending user action in Supabase dashboard.)*
- [X] T043 [P] [US1] Login page + server action (`supabase.auth.signInWithPassword`) with generic `Invalid login credentials` error (no enumeration) in `app/(auth)/login/page.tsx`
- [X] T044 [P] [US1] Onboarding "Create your household" page + server action calling `rpc('create_household', { name })` in `app/(auth)/onboarding/create-household/page.tsx`
- [X] T045 [US1] Sign-out server action and drawer affordance in `app/(app)/_actions/signout.ts` (consumed by `AppDrawer`)

**Checkpoint**: US1 fully functional — sign-in, onboarding, add-adult-by-email, add-kid, soft-delete all work end-to-end.

---

## Phase 4: User Story 2 — Log expenses & net income; live dashboard (Priority: P1) 🎯 MVP

**Goal**: Either adult can log an expense or net income; the dashboard balance, "left to spend", essential/treats summary, and recent activity reflect changes in real time on both adults' devices.

**Independent Test**: Log 5 expenses + 2 net-income entries on Adult A → open app on Adult B → identical balance and recent activity within 5 s (SC-003). Editing/deleting a transaction updates totals.

### Tests for User Story 2

- [ ] T046 [P] [US2] Playwright expense logging + realtime flow (log via full Add form → balance decrements → second device sees it via realtime → edit → delete) in `tests/e2e/log-expense-realtime.spec.ts`

### Implementation for User Story 2

- [ ] T047 [US2] Migration `supabase/migrations/0003_transactions.sql`: `category` table (with system-global seed rows where `household_id IS NULL`), `transaction` table; indexes `(household_id, occurred_on desc)`, `(household_id, category_id, occurred_on)`, GIN on `to_tsvector('simple', notes)`; RLS policies; deferred constraint trigger for `for_member_id` / `paid_by_member_id` household match
- [ ] T048 [P] [US2] SQL function `log_expense(payload)` with category-default `essential_pct` lookup and client-UUID idempotency in `supabase/functions/log_expense.sql`
- [ ] T049 [P] [US2] SQL function `log_income(payload)` — net amount only, no GST/HST set-aside trigger (clarification §6); validates `income_source` against enum `Salary | Contract | Self_employed | Benefit | Refund | Gift` (clarification §9) — in `supabase/functions/log_income.sql`
- [ ] T050 [P] [US2] SQL function `update_transaction(id, patch)` in `supabase/functions/update_transaction.sql`
- [ ] T051 [P] [US2] SQL function `delete_transaction(id)` (idempotent) in `supabase/functions/delete_transaction.sql`
- [ ] T052 [P] [US2] SQL view `transaction_view` (joined with category + member display names; preserves soft-deleted member display names for historical rows) and SQL function `list_transactions(filters)` in `supabase/functions/list_transactions.sql`
- [ ] T053 [P] [US2] SQL function `get_dashboard_summary(year, month)` returning `{ balance_cents, left_to_spend_this_month_cents, essential_spent_cents, treats_spent_cents, recent }` in `supabase/functions/get_dashboard_summary.sql`
- [ ] T054 [P] [US2] Zod schemas for transaction create / update / delete (expense + net income; income_source enum: `Salary | Contract | Self_employed | Benefit | Refund | Gift`) in `lib/validators/transaction.ts`
- [ ] T055 [P] [US2] Full Add Expense page (RSC + server action calling `rpc('log_expense')`) in `app/(app)/add/page.tsx`
- [ ] T056 [P] [US2] Add Income page (RSC + server action calling `rpc('log_income')` with net amount; income_source label only) in `app/(app)/add-income/page.tsx`
- [ ] T057 [US2] Dashboard page (calls `rpc('get_dashboard_summary')`) with sage "Left to spend · <month>" hero, two stat cards (Income with A/B split slim bar + "Saved" card showing month net-income-minus-expense as a % of income, per design v2 — replaces the old Tax bucket card), essential/treats split card, kids strip (month-spent + last-txn per kid; no allowance), recent-activity strip, and FAB navigating to `/quick-add` in `app/(app)/dashboard/page.tsx`
- [ ] T058 [P] [US2] `ActivityRow` and `TxnRow` components in `components/transactions/ActivityRow.tsx` and `components/transactions/TxnRow.tsx`
- [ ] T059 [US2] Edit/delete transaction sheet in `components/transactions/EditTxnSheet.tsx`
- [ ] T060 [US2] Wire realtime subscription in `app/(app)/layout.tsx` to invoke `revalidateTag('household:<id>:transactions')` on incoming changes (depends on T029)
- [ ] T061 [US2] Extend offline outbox in `lib/pwa/outbox.ts` to call `log_expense` / `log_income` with client-supplied UUID, surface a "queued" badge from `store/slices/outbox.ts` (depends on T028)

**Checkpoint**: Core MVP delivered (US1 + US2). Captures money in/out with live dashboard.

---

## Phase 5: User Story 2b — Quick Add by tile (Priority: P1) 🎯 MVP

**Goal**: Dashboard FAB opens Quick Add. Tapping a recent-merchant or active-subscription tile creates a new expense with copied tags and today's date in ≤2 taps (SC-008). A "+" affordance falls through to the full Add Expense form.

**Independent Test**: With ≥1 prior expense and ≥1 active subscription, opening Quick Add shows tiles. Tap one → new transaction created with same tags + today's date → user returned to dashboard with balance updated.

### Tests for User Story 2b

- [ ] T062 [P] [US2b] Playwright Quick Add tile re-log flow (open from FAB → tap Recent tile → balance decrements within 5 s with copied tags + today's date; primary tap on Subs row also re-logs and leaves `occurrence_date` null so cron auto-log isn't blocked; pencil icon on a Subs row navigates to the subscription edit sheet without logging) in `tests/e2e/quick-add-tile-relog.spec.ts`

### Implementation for User Story 2b

- [ ] T063 [P] [US2b] SQL function `list_quick_add_options(p_limit int default 12)` (security invoker) returning a mixed set of unique-merchant recent expenses (last 60 days) and active subscriptions due within 30 days, filtering out options whose `for_member_id` references a soft-deleted member — in `supabase/functions/list_quick_add_options.sql`
- [ ] T064 [P] [US2b] `QuickAddTile` component (one tile: merchant icon + name + amount + for-whom avatar) in `components/quick-add/QuickAddTile.tsx`
- [ ] T065 [P] [US2b] `RecentTilesGrid` (re-log on tap) and `SubscriptionTilesList` (primary tap re-logs; pencil-icon secondary action navigates to `/subscriptions/<id>/edit`) in `components/quick-add/RecentTilesGrid.tsx` and `components/quick-add/SubscriptionTilesList.tsx`
- [ ] T066 [US2b] Quick Add page in `app/(app)/quick-add/page.tsx` — RSC pulls `rpc('list_quick_add_options')`, renders tabs `Recent | Subs` (MVP; `Per kid | Merchants | Categories` are post-MVP UI slicings of the same data per spec clarification §9), primary tile-tap dispatches a server action that copies the source's `merchant/amount/category/for_member/paid_by/essential_pct/split_rule` and calls `rpc('log_expense')` with today's date and a fresh UUID v7. For `source='subscription'`, the payload additionally sets `subscription_id` and leaves `occurrence_date = null`. Pencil-icon clicks on subscription rows bypass log_expense entirely and route to the subscription's edit sheet.
- [ ] T067 [US2b] Wire FAB on Dashboard (T057) and Transactions list (T087) to navigate to `/quick-add` instead of `/add`
- [ ] T068 [US2b] Add a "+" affordance in the Quick Add header that routes to `/add` for full-form entry; ensure all form fields start empty

**Checkpoint**: MVP complete (US1 + US2 + US2b). Re-logging is now one-tap for any frequent merchant.

---

## Phase 6: User Story 3 — Family-aware tagging & essential/treats split (Priority: P2)

**Goal**: Every expense can be tagged "for whom" and split essential/treats with a slider; categories carry default splits; the dashboard and reports reflect both portions.

**Independent Test**: Tag 10 expenses across members + essential states → dashboard shows correct essential-vs-treats totals; per-person summary reflects the tags.

### Tests for User Story 3

- [ ] T069 [P] [US3] Playwright for-whom + split flow (tag expense for kid, slide split 76/24, verify both portions stored and reflected in dashboard and Quick Add tile re-logs) in `tests/e2e/for-whom-and-split.spec.ts`

### Implementation for User Story 3

- [ ] T070 [P] [US3] SQL function `set_category_essential_pct(category_id, pct)` with clone-on-write for system-global categories in `supabase/functions/set_category_essential_pct.sql`
- [ ] T071 [P] [US3] `ForWhomChips` selector (Household chip + Adult chips + Kid chips; hides `deleted_at IS NOT NULL` members) in `components/transactions/ForWhomChips.tsx`
- [ ] T072 [P] [US3] Essential `SplitSlider` (0–100, snaps at 25/50/75/100) in `components/transactions/SplitSlider.tsx`
- [ ] T073 [US3] Wire `ForWhomChips` + `SplitSlider` into the full Add Expense form in `app/(app)/add/page.tsx` (extends T055)
- [ ] T074 [US3] Dashboard "Per-person spending this month" mini-panel powered by `get_dashboard_summary` extension in `app/(app)/dashboard/page.tsx` (extends T057)

**Checkpoint**: US3 functional — family-aware tagging and essential/treats split work end-to-end.

---

## Phase 7: User Story 4 — Members & income-proportional split (Priority: P2)

**Goal**: 2 adults + N kids; logged adult net incomes drive a derived "by income" split rule that uses the floor + residual-to-higher-earner algorithm so shares sum exactly.

**Independent Test**: 2 adults with net incomes $5,800 and $2,485 + 4 kids → Settings shows ~70/30 derived ratio → choose `Split: by income` on a $45.20 expense → Alex owes $31.62, Bea owes $13.58, sum is exactly $45.20 (residual cent on Alex).

### Tests for User Story 4

- [ ] T075 [P] [US4] Playwright split-rule flow covering all four FR-015 chips (`Adult A 100%`, `Adult B 100%`, `50/50`, `by income`): each chip renders correct per-adult shares on a known transaction; for `by income` on an odd amount the residual cent lands on the higher-earning adult and shares sum exactly; zero-income fallback to equal; single-adult degeneracy — in `tests/e2e/by-income-split-residual.spec.ts`

### Implementation for User Story 4

- [ ] T076 [P] [US4] SQL function `compute_income_split(household_id)` returning `(adult_id, ratio, display_order)` for active adults only, with zero-income fallback to equal split, in `supabase/functions/compute_income_split.sql`
- [ ] T077 [P] [US4] SQL function `apply_split_rule(transaction_id)` returning `(adult_id, owed_cents)` with the floor-and-residual algorithm (residual to highest income, ties broken by display_order) — must guarantee `sum(owed_cents) = transaction.amount_cents` — in `supabase/functions/apply_split_rule.sql`
- [ ] T078 [P] [US4] Family screen (sage "Spent on kids · <month>" hero with total month-spend on kids and headcount, segmented period control (All / This week / <month> / YTD) for the hero, member list + add adult by email + add kid + edit income; hides soft-deleted; per-kid cards show spent-this-month + top-category + last-activity-day — **NO per-kid budget bar, NO allowance, NO wallet** per spec clarifications §7 and §9) in `app/(app)/family/page.tsx`
- [ ] T079 [P] [US4] `MemberCard`, `KidGrid` (wraps cleanly at 340 px viewport; per-kid card shows month-spent + most-recent-transaction summary, no allowance, no wallet, no budget), `AddAdultByEmail` (calls `rpc('add_adult_by_email')` and surfaces statuses), `AddKidForm` components in `components/family/`
- [ ] T080 [US4] Income-split rule view in Settings consuming `compute_income_split` live in `app/(app)/settings/page.tsx`
- [ ] T081 [US4] Add the four split-rule chips required by FR-015 — `Adult A 100%`, `Adult B 100%`, `50/50`, `by income` — to the full Add Expense form via a new `<SplitRuleChips>` in `components/transactions/SplitRuleChips.tsx`. Selecting any chip renders the live per-adult share preview via `apply_split_rule`; `by income` uses the floor + residual-to-higher-earner algorithm (FR-015a). Wire into `app/(app)/add/page.tsx` (extends T073).

**Checkpoint**: US4 functional — household scales to N kids; by-income split is derived live with exact-sum guarantee.

---

## Phase 8: User Story 5 — Budget overview by category (Priority: P3)

**Goal**: Set monthly per-category limits; see progress bars; filter All / Essential / Treats.

**Independent Test**: Set 5 category limits + log expenses → budget overview shows accurate progress bars with correct essential/treats split per category and an over-budget visual state.

### Tests for User Story 5

- [ ] T082 [P] [US5] Playwright budget flow: open Budget page → tap the edit-limit affordance on Groceries → save $800 via `rpc('set_category_budget')` → log expenses → verify 75% progress, over-budget visual state, filter All/Essential/Treats; also cover the clear-limit edge case (set to 0/null) in `tests/e2e/budget.spec.ts`

### Implementation for User Story 5

- [ ] T083 [P] [US5] SQL function `set_category_budget(category_id, monthly_budget_cents?)` with clone-on-write in `supabase/functions/set_category_budget.sql`
- [ ] T084 [P] [US5] SQL function `get_budget_progress(year, month, filter)` returning per-category rows in `supabase/functions/get_budget_progress.sql`
- [ ] T085 [P] [US5] `CategoryRow` progress-bar component with over-budget visual variant in `components/budget/CategoryRow.tsx`
- [ ] T086 [P] [US5] Budget page (calls `rpc('get_budget_progress')`) in `app/(app)/budget/page.tsx`
- [ ] T086a [P] [US5] "Edit limit" sheet on each `CategoryRow` calling `rpc('set_category_budget', { category_id, monthly_budget_cents })` (clearing by setting to null); refreshes progress via the realtime revalidate tag — in `components/budget/EditLimitSheet.tsx`, wired into `app/(app)/budget/page.tsx`. Required to fulfil the FR-018 "set a monthly limit per category" verb that T086 alone does not cover.
- [ ] T087 [US5] All / Essential / Treats filter chips backed by a Redux UI slice in `store/slices/filters.ts` consumed by `app/(app)/budget/page.tsx`

**Checkpoint**: US5 functional — budgets visible with live progress.

---

## Phase 9: User Story 6 — Transactions list with filters & search (Priority: P3)

**Goal**: Browse all transactions grouped by date with search, category filter, "for whom" filter, essential/treats filter, and date range.

**Independent Test**: Log 30 mixed transactions → search by merchant, filter by person, filter by essential, combine with date range — each returns the expected subset.

### Implementation for User Story 6

- [ ] T088 [P] [US6] Filters slice extension (search text, chips, date range) in `store/slices/filters.ts` (extends T087)
- [ ] T089 [P] [US6] `FilterChips` and search input components in `components/transactions/FilterChips.tsx`
- [ ] T090 [US6] Transactions list page grouped by `occurred_on desc`, paginated, hits `rpc('list_transactions')` with filter args, FAB navigates to `/quick-add`, in `app/(app)/transactions/page.tsx`

**Checkpoint**: US6 functional — full transaction browsing.

---

## Phase 10: User Story 7 — Reports & visual analytics (Priority: P3)

**Goal**: Four reports — spend-over-time, cashflow KPIs, per-person pie (with "include general expenses" toggle), essentials breakdown — fed by RPC reads, charts dynamic-imported per route.

**Independent Test**: Populate a month of transactions; open each report; numbers and visuals match underlying data; per-person pie recomposes within 500 ms (SC-006) when the toggle flips.

### Implementation for User Story 7

- [ ] T091 [P] [US7] SQL function `spend_over_time(range)` in `supabase/functions/spend_over_time.sql`
- [ ] T092 [P] [US7] SQL function `cashflow_kpis(range)` including server-formatted `insights[]` strings in `supabase/functions/cashflow_kpis.sql`
- [ ] T093 [P] [US7] SQL function `per_person_breakdown(year, month, include_general)` (when toggle on: consumes `compute_income_split` so adults absorb income-proportional share of general expenses; kids' share stays 0) in `supabase/functions/per_person_breakdown.sql`
- [ ] T094 [P] [US7] SQL function `essentials_breakdown(year, month)` returning overall donut + recurring essential/treats subscription lists in `supabase/functions/essentials_breakdown.sql`
- [ ] T095 [US7] Reports layout (tab strip across the 4 reports) in `app/(app)/reports/layout.tsx`
- [ ] T096 [P] [US7] Recharts dynamic-import wrapper (lazy via `next/dynamic({ ssr: false })`) in `components/reports/charts.tsx`
- [ ] T097 [P] [US7] Spend-over-time page in `app/(app)/reports/spend-over-time/page.tsx`
- [ ] T098 [P] [US7] Cashflow KPIs page in `app/(app)/reports/cashflow/page.tsx`
- [ ] T099 [P] [US7] Per-person pie page with the include-general-expenses toggle in `app/(app)/reports/per-person/page.tsx`
- [ ] T100 [P] [US7] Essentials breakdown page (overall donut + recurring lists + treats percent) in `app/(app)/reports/essentials/page.tsx`

**Checkpoint**: US7 functional — all four reports render correctly.

---

## Phase 11: User Story 9 — Subscriptions & recurring expenses (Priority: P3)

**Goal**: Register recurring expenses with cadence and renewal; subscriptions auto-log via hourly cron; overlapping subs flagged for savings. Manual Quick-Add of a subscription leaves `occurrence_date = null` so it doesn't collide with the future cron auto-log.

**Independent Test**: Add 5 subscriptions with different cadences; advance the renewal dates past today; verify each auto-logs a transaction with correct tags; re-running the cron is idempotent.

### Tests for User Story 9

- [ ] T101 [P] [US9] Playwright subscription auto-log flow (register $19.99 monthly Netflix tagged Household/Treats, force-run `materialize_due_subscriptions`, verify auto-logged transaction with correct tags + idempotency on re-run; also verify a Quick-Add manual tap on the same sub does not block the next cron tick) in `tests/e2e/subscription-auto-log.spec.ts`

### Implementation for User Story 9

- [ ] T102 [US9] Migration `supabase/migrations/0004_subscriptions.sql`: `subscription` table; unique idempotent index `(subscription_id, occurrence_date) where subscription_id is not null` on `transaction`; schedule `select cron.schedule('subscriptions-hourly', '0 * * * *', $$select materialize_due_subscriptions();$$);`
- [ ] T103 [P] [US9] SQL function `register_subscription(payload)` in `supabase/functions/register_subscription.sql`
- [ ] T104 [P] [US9] SQL functions `update_subscription`, `pause_subscription`, `resume_subscription` in `supabase/functions/subscription_lifecycle.sql`
- [ ] T105 [P] [US9] SQL function `materialize_due_subscriptions()` (`security definer`, advances `next_renewal_at` by cadence; sets `occurrence_date = next_renewal_at` for idempotency) in `supabase/functions/materialize_due_subscriptions.sql`
- [ ] T106 [P] [US9] SQL function `list_overlapping_subscriptions()` returning cluster rows in `supabase/functions/list_overlapping_subscriptions.sql`
- [ ] T107 [P] [US9] Subscriptions page (list + add + pause/resume + overlap callout) in `app/(app)/subscriptions/page.tsx`
- [ ] T108 [US9] "Overlapping subs · review to save $X/mo" callout integrated into the essentials breakdown report in `app/(app)/reports/essentials/page.tsx` (extends T100)

**Checkpoint**: US9 functional — subscriptions register and auto-log idempotently; savings callout surfaces; Quick-Add manual taps coexist with cron auto-logs.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Finish constitution-mandated quality gates and run the quickstart validation

- [ ] T109 [P] Playwright offline-replay flow (turn off network, log expense, badge shows "queued", reconnect, badge clears, row persists) in `tests/e2e/offline-replay.spec.ts`
- [ ] T110 [P] Vitest unit tests for `lib/money.ts` (cents↔dollars, CAD format, sub-dollar edge case) in `tests/unit/money.test.ts`
- [ ] T111 [P] Vitest unit tests for `lib/split.ts` (ratio derivation, zero-income fallback, single-adult degenerate case, residual-cent allocation invariant) in `tests/unit/split.test.ts`
- [ ] T112 [P] 340 px-viewport visual sweep across every authenticated screen (Dashboard, Quick Add, Add, Add Income, Transactions, Budget, Family, Reports tabs, Subscriptions, Settings) with 0, 2, 6, 8 kids; recorded as a manual checklist in `tests/manual/viewport-sweep.md`
- [ ] T113 Run quickstart.md 12-step validation end-to-end against a fresh Supabase project
- [ ] T114 [P] Document deployment + env setup in `README.md` (replaces the Vercel boilerplate)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phases 3–11)**: All depend on Foundational completion
  - US1 → US2 → US2b ordering recommended (US2b reads transactions written by US2; US2 uses households created by US1)
  - US3 → US4 ordering recommended within P2 (US3's split slider is used by US4's by-income display)
  - US5–US9 are independent and may run in any order or in parallel
- **Polish (Phase 12)**: Depends on US1 + US2 at minimum; offline-replay test depends on US2

### User Story Dependencies

- **US1 (P1)**: Independent — first
- **US2 (P1)**: Depends only on US1's `household` table existing (Phase 3 migration)
- **US2b (P1)**: Depends on US2's `log_expense` RPC and `transaction_view`; reuses US1's soft-delete filter rule
- **US3 (P2)**: Depends on US2's transaction tables
- **US4 (P2)**: Depends on US2's transaction tables; reuses US3's split slider
- **US5 (P3)**: Depends on US2's transactions + categories
- **US6 (P3)**: Depends on US2's transactions + optionally US3's tags for the filter UI
- **US7 (P3)**: Depends on US2; per-person report depends on US4's `compute_income_split`
- **US9 (P3)**: Depends on US2's transaction table (for the auto-log insert)

### Within Each User Story

- Tests written first, expected to FAIL before implementation
- Migrations before SQL functions (functions depend on tables)
- SQL functions and components marked [P] can run in parallel
- Server actions / page wiring last, after the RPCs they call exist

### Parallel Opportunities

- All [P] tasks within Phase 1 (Setup) — about 7 of them
- All [P] tasks within Phase 2 (Foundational) — about 14 of them
- After Phase 2, US1 + US2 + US2b can be staffed independently (different file sets except where US2b consumes US2's `log_expense` RPC)
- Within US2: the 6 SQL functions (T048–T053), the validators (T054), the two Add pages (T055/T056), and the components (T058) are largely parallelizable
- Within US7: all 4 SQL functions (T091–T094) and all 4 report pages (T097–T100) are parallelizable

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

# In parallel, the UI components and tests that don't yet need wiring:
Task: "ActivityRow + TxnRow components in components/transactions/"
Task: "Zod transaction schemas in lib/validators/transaction.ts"
Task: "Playwright log-expense-realtime.spec.ts in tests/e2e/"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US2b)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — sign-in + onboarding + add-adult-by-email + soft-delete
4. Complete Phase 4: US2 — log expense/income (net) + dashboard + realtime
5. Complete Phase 5: US2b — Quick Add tile re-log
6. **STOP and VALIDATE**: Run the sign-in + onboarding + add-adult + log-expense + quick-add Playwright suites against a fresh Supabase project. Both adults can sign in, capture money in/out, re-log frequent items in one tap, and see each other's activity within 5 s. This is the MVP demo.

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. + US1 + US2 + US2b → MVP (ship-able to friends-and-family)
3. + US3 + US4 → "Family-aware budgeting" milestone (the spec's core differentiator)
4. + US5 → Budget overview
5. + US6 → Search + filter
6. + US7 → Reports
7. + US9 → Subscriptions auto-log
8. Polish phase → Offline replay test + viewport sweep + quickstart validation

### Parallel Team Strategy

With multiple developers post-foundation:

1. Dev A: US1 → US2 → US2b (P1 path)
2. Dev B: US3 → US4 (P2 path, after US2 migrations land)
3. Dev C: Picks one of US5 / US6 / US7 / US9 per sprint (P3)
4. The polish phase is shared

---

## Notes

- Every SQL function is invoked via `rpc(<fn_name>, args)` from server actions or RSCs — never via a bespoke REST handler. Constitution Principle III.
- Every table created across phases must enable RLS in the same migration. Constitution Principle II.
- Each Playwright spec corresponds to one of the 9 constitution-required critical flows in `plan.md`. Constitution Principle IV.
- [P] markers indicate file-level disjointness; tasks that touch the same file (e.g., `app/(app)/settings/page.tsx` gets extended across T080 → T087 etc.) are sequenced, not parallel.
- Commit after each task or coherent group; descriptive imperative messages per constitution.
- **US8 (Canadian tax tracking) is NOT in this task list** — removed per spec clarification §6. No `lib/canadian-tax/`, no `deduction` or `gst_hst_setaside` tables, no `/taxes` route, no `0005_tax.sql` migration.
- **Kid weekly allowance is NOT in this task list** — removed per spec clarification §7. Kids exist solely so expenses can be tagged `for_member_id`; no wallet, no auto-transfer, no per-week budget allocation.
