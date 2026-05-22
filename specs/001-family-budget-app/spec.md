# Feature Specification: Family Budget App (Canadian PWA)

**Feature Branch**: `001-family-budget-app`
**Created**: 2026-05-21
**Status**: Draft
**Input**: User description: "Fetch this design file, read its readme, and implement the relevant aspects of the design. https://api.anthropic.com/v1/design/h/i74OmQe-LtGwBb73JCnk7g?open_file=Budget+Wireframes.html — Implement: Budget Wireframes.html"

A calm, minimal mobile-first budgeting app for Canadian couples and families (2 adults + any number of kids) covering household expenses, income, taxes, budgets, transactions, reports, and subscriptions — with family-aware tagging, essential/non-essential breakdowns, and income-proportional cost-sharing between adults.

## Clarifications

### Session 2026-05-21

- Q: When a household member (adult or kid) is removed, what should happen to transactions tagged to that member via `paid_by_member_id` / `for_member_id`? → A: Soft-delete the member (`deleted_at` set). Transactions keep their member FK. Deleted members are hidden from new-transaction selectors, family screen, and "for whom" filter chips, but still appear in historical reports so prior totals remain attributable.
- Q: How should account / household deletion work (PIPEDA right-to-erasure)? → A: Out of scope for v1. Full account or household deletion is handled manually by operations on user request. v1 ships only sign-out and member soft-delete (FR-007a). Self-serve deletion goes on the post-v1 roadmap.
- Q: When an income-proportional split produces fractional cents, how is the residual allocated so shares sum exactly to the transaction amount? → A: Floor each adult's share to whole cents, then assign the residual cent(s) to the higher-earning adult. Shares always sum exactly to the transaction total. For equal-income (or zero-income fallback) splits, the residual goes to Adult A in display order.
- Q: What password strength policy should the signup form enforce? → A: Minimum 8 characters, AND at least one number, AND at least one symbol. Allow paste; max length 64. Enforced both client-side (Zod, immediate feedback) and on the Supabase Auth project config.
- Q: How is the invitation email delivered to the second adult? → A: Hybrid model with three responsibilities:
  - **Account creation** (creating a Supabase `auth.users` row + initial password) is admin-only via the Supabase dashboard — the app has no signup page, no invite tokens, and no email-delivery integration.
  - **Household creation** is user-initiated, in-app. On first sign-in, if the user has no `household_member` row, the app routes them to a "Create your household" screen. Creating the household inserts both the `household` row (caller becomes owner) and the caller's `household_member` row as the first adult.
  - **Adding additional members** is in-app: adults are added on the Family screen by entering their email (must match an existing Supabase auth user, otherwise the action errors). Kids are added by name + age (no email, no auth account).

### Session 2026-05-21 (scope reductions)

- Q: Should v1 ship the Canadian tax tracking surface (CRA instalments, deductions, GST/HST set-aside, tax-bucket auto-aside on income)? → A: No. **All of US8 is removed from v1.** No Taxes screen, no CRA instalment timeline, no deductions tracking, no GST/HST set-aside ledger, no tax-bucket auto-aside on income. Income amounts are entered as **net** (already-tax-handled), so no automatic withholding logic is required. The Canadian-tax terminology surface (T4 / T4A / CCB / etc.) remains only as income *source labels* for reporting context. The Taxes nav entry is removed from the drawer and the design's tax cards on the dashboard are not implemented.
- Q: Should kid weekly allowances be implemented? → A: No. The hi-fi design's per-kid allowance cards (weekly budget, wallet balance, auto-transfer cadence) are **out of scope for v1**. Kids exist only so expenses can be tagged `for_member_id = <kid>`; per-person reports still attribute spending to the kid, and any "kid budget" desire is met by using categories like "Kids · all" with a monthly limit. Kid wallet balances, allowance schedules, and auto-transfer rules are explicitly deferred.
- Q: Does v1 ship the wireframe's "Quick add" screen? → A: Yes. The FAB on the dashboard opens **Quick Add** (not the full Add Expense form directly). Quick Add is a tile grid that lets the user re-log a recent transaction or trigger a manual instance of an active subscription with one tap — copying the source's merchant, amount, category, "for whom", "paid by", essential split, and split rule, and setting today's date. From Quick Add, a "+" affordance opens the full Add Expense form for never-before-seen merchants. Add Income remains a separate menu action.

### Session 2026-05-21 (design v2 alignment)

- Q: After the design was updated to match the scope reductions, do any spec details need to follow? → A: Yes, three small refinements:
  - **Income source labels** switch from CRA-flavored (`T4 employment, T4A · contract, CCB`) to consumer-friendly (`Salary, Contract, Benefit`). Final enum: `Salary | Contract | Self_employed | Benefit | Refund | Gift`. Labels remain descriptive metadata only — no tax behavior is keyed off them.
  - **Quick Add subscription tile** behavior is dual-action: the primary tap re-logs a manual instance (same as Recent tiles), and a secondary pencil icon on the row opens the edit/pause sheet for that subscription. Primary tap on a Recent tile re-logs and dismisses Quick Add.
  - **Family screen** shows monthly **spent-per-kid** only (no per-kid budget bar). Per-kid budgeting is post-v1. The hero shows total spent on kids this month; the per-kid cards show spend + most-recent transaction. This avoids introducing a `household_member.monthly_budget_cents` column for v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure household sign-in and onboarding (Priority: P1)

A family member signs in with admin-provisioned credentials. On first sign-in (or any sign-in while not yet in a household), the app routes them to a "Create your household" screen where they name the household and become its first adult/owner. Subsequent adults are added in-app by email lookup; kids by name + age.

**Why this priority**: Without authentication and a household, no other feature is usable. This is the entry point. v1 has no self-service signup — admins create the `auth.users` row — but household creation, member addition, and all subsequent app behavior are user-driven.

**Independent Test**: Admin pre-creates two Supabase user accounts (Alex and Bea). Sign in as Alex → land on "Create your household" → enter a name → land on empty dashboard → open Family screen → add Bea by email → sign out → sign in as Bea → land directly on the same dashboard (no creation prompt, since Bea is now a member).

**Acceptance Scenarios**:

1. **Given** an admin-provisioned user with no household membership, **When** they sign in for the first time, **Then** they are routed to a "Create your household" screen and cannot reach the dashboard until they create one.
2. **Given** the "Create your household" screen, **When** the user enters a household name and submits, **Then** a new household is created with the caller as owner and first adult, and the user is routed to the empty dashboard.
3. **Given** an admin-provisioned user, **When** they enter incorrect credentials on the sign-in screen, **Then** they see a clear error and remain on the sign-in screen.
4. **Given** Alex is signed in with an existing household and Bea has an admin-created Supabase account, **When** Alex enters Bea's email on the Family screen, **Then** Bea is attached to Alex's household as the second adult; Bea sees the same shared data after she signs in.
5. **Given** Alex enters an email on the Family screen that does NOT match any Supabase auth account, **When** they submit, **Then** the action fails with a clear "No account exists for that email — ask the admin to create one first" message and no member row is created.
6. **Given** a signed-in user, **When** they sign out, **Then** subsequent visits require re-authentication.
7. **Given** a visitor who is not an admin-provisioned user, **When** they reach the app, **Then** the only available action is sign-in — no signup form is present and no public registration path exists.

---

### User Story 2 - Log expenses and income, see the household balance (Priority: P1)

Either adult can quickly log an expense (amount, category, notes) or income, and the dashboard reflects the new running balance and recent activity in real time across both adults' devices. Income amounts are entered as **net** (post-tax) — v1 does no automatic tax withholding or set-aside.

**Why this priority**: Capturing money in/out is the core job of a budgeting app. Without it the product has no value.

**Independent Test**: Can be tested by logging 5 expenses and 2 income entries on one device, then opening the app on the second adult's device and seeing the same balance, the same transactions, and a correctly updated dashboard.

**Acceptance Scenarios**:

1. **Given** an empty household, **When** an adult logs an expense of $45.20 in "Groceries", **Then** the dashboard balance decreases by $45.20 and the transaction appears at the top of recent activity.
2. **Given** an income of $2,400 net logged as "Salary" source, **When** the user saves it, **Then** the dashboard balance increases by $2,400 (no automatic tax-bucket deduction) and the income appears in the transactions list.
3. **Given** a transaction was logged on Adult A's device, **When** Adult B opens the app, **Then** the same transaction is visible without manual sync.
4. **Given** a transaction with an incorrect amount, **When** the user edits or deletes it, **Then** balances and lists update accordingly.

---

### User Story 2b - Quick Add by tile (Priority: P1)

Tapping the dashboard FAB opens a Quick Add screen instead of the full Add Expense form. The screen shows the household's most recent and recurring transactions as tiles; tapping a tile logs a new transaction that copies the source's merchant, amount, category, "for whom", "paid by", essential split, and split rule, and sets today's date. A "+" in the corner falls through to the full Add Expense form for never-before-seen merchants.

**Why this priority**: Most family spending is repeat (groceries, daycare, music lessons, the same gas station). One-tap re-logging meets SC-002's "no more than 4 taps" goal and replaces full-form entry as the default path.

**Independent Test**: With a household of 4 prior transactions and 3 active subscriptions, opening Quick Add shows ≥7 tiles. Tapping the "Whole Foods · $142.30" tile creates a new transaction with the same tags as the original and today's date; balances and recent activity update; one tap suffices.

**Acceptance Scenarios**:

1. **Given** at least one prior expense exists, **When** the user opens Quick Add from the dashboard FAB, **Then** the most-recent unique merchants appear as tiles in the "Recent" tab.
2. **Given** active subscriptions exist, **When** the user opens the "Subs" tab, **Then** each active subscription is shown with its next-renewal date and the "who-for" attribution.
3. **Given** a Recent tile or a Subs row primary-tap, **When** the action completes, **Then** the dashboard balance reflects the new transaction within 5 s and the user is returned to the dashboard.
4. **Given** the user taps the pencil icon on a Subs row, **When** the action completes, **Then** the subscription's edit sheet opens (no transaction is logged).
5. **Given** the user taps "+" on Quick Add, **When** the full Add Expense form opens, **Then** all fields are empty (a normal first-time entry).

---

### User Story 3 - Family-aware expense tagging (for whom + essential/non-essential) (Priority: P2)

Every expense can be tagged with the person it was for (the whole household, a specific adult, or a specific kid) and marked as essential, non-essential, or split between the two (e.g. a $142 grocery run = $108 essential + $34 treats). Reports and budgets reflect these tags.

**Why this priority**: This is the core differentiator from generic budget apps — it lets families understand where money goes per person and per "needs vs wants" category. Depends on US2 being in place.

**Independent Test**: Can be tested by tagging 10 expenses across household members and essential states, then verifying the dashboard shows correct essential vs treats totals and a per-person breakdown without further configuration.

**Acceptance Scenarios**:

1. **Given** the user is adding an expense, **When** they tap a "For" chip for one of their kids, **Then** the transaction is recorded as being for that kid and appears under that kid's spending in reports.
2. **Given** a single transaction with a mixed essential/non-essential nature, **When** the user splits it (e.g. 76% essential / 24% treats with a slider), **Then** both portions are stored and reflected separately in totals.
3. **Given** a category default rule (e.g. "Groceries default 80% essential"), **When** a new expense is logged in that category without manual override, **Then** the split is applied automatically.
4. **Given** transactions tagged for different family members, **When** the user opens reports, **Then** they can see a per-person breakdown of spending.

---

### User Story 4 - Household members & income-proportional cost split (Priority: P2)

The household can include 2 adults plus any number of children (each with name and age). Logged adult incomes feed an automatic "income-proportional" cost-split rule so shared expenses can be attributed to each adult by the ratio of their incomes (e.g. if Alex earns 70% and Bea 30% of household income, "by income" splits a $142 expense $99.61 / $42.69). The split percentage is always derived from current incomes, never a fixed number.

**Why this priority**: Required for fair household accounting between adults with different incomes and to scale the experience to real families with multiple kids.

**Independent Test**: Can be tested by adding 2 adults with different stated incomes and 4 kids, then logging a shared expense and choosing the "by income" split — the system computes each adult's share from current incomes and the UI lists all 4 kids on the dashboard, family tab, and reports.

**Acceptance Scenarios**:

1. **Given** an empty household, **When** the user adds 2 adults and 4 kids (with names and ages), **Then** all of them are visible across dashboard, family screen, "For" chip selectors, and reports without further configuration.
2. **Given** Adult A has $5,800/mo income and Adult B has $2,485/mo, **When** the user views the income-split rule, **Then** the displayed ratio reflects ~70/30 derived from current incomes and updates when incomes change.
3. **Given** a shared expense, **When** the user chooses "Split: by income" on it, **Then** each adult's owed share is computed and shown immediately.
4. **Given** a household scales from 2 kids to 6 kids, **When** the user views the family screen, **Then** all kids are displayed legibly (grid wraps; no truncation or overflow).

---

### User Story 5 - Budget overview by category with progress (Priority: P3)

Users can set a monthly limit per category (groceries, utilities, transport, kids, etc.) and see real-time progress bars showing how much has been spent vs the limit, with an essential/non-essential breakdown per category.

**Why this priority**: Enables proactive budgeting rather than passive tracking, but is not required to start using the app.

**Independent Test**: Can be tested by setting limits on 5 categories, logging expenses against each, and confirming the budget overview shows accurate progress bars with the correct essential/treats split per category.

**Acceptance Scenarios**:

1. **Given** a category limit of $800 for Groceries, **When** $600 has been logged, **Then** the budget overview shows 75% progress for that category.
2. **Given** a category limit is exceeded, **When** the user views the budget overview, **Then** the over-budget state is visually distinct from on-track categories.
3. **Given** a category contains both essential and treats portions, **When** the user filters by "Essential" or "Treats", **Then** only the matching portion of each category's spending counts.

---

### User Story 6 - Transactions list with filters and search (Priority: P3)

Users can browse all transactions in a single list grouped by date, search by merchant or note, and filter by category, person ("for whom"), essential/treats, and date range.

**Why this priority**: Supports auditing and answering common day-to-day questions ("what did we spend on Mia last month?"). Not required for the first useful slice.

**Independent Test**: Can be tested by logging 30 mixed transactions and verifying that searching, person-filtering, essential-filtering, and date filtering each return the expected subset.

**Acceptance Scenarios**:

1. **Given** transactions across 30 days, **When** the user opens the transactions list, **Then** entries are grouped by date with the newest day first.
2. **Given** the user types "Loblaws" in search, **When** matching transactions exist, **Then** only those transactions remain visible.
3. **Given** the user applies the "for Mia" chip filter, **When** combined with "Essential", **Then** only essential transactions tagged for Mia are shown.

---

### User Story 7 - Reports & visual analytics (Priority: P3)

Users can view four reports: (a) spend over time, (b) cashflow KPIs with insights, (c) per-person pie chart with an "include general expenses" toggle (off shows only personally-tagged spending; on adds each adult's income-proportional share of shared bills), (d) essentials breakdown — overall essential vs treats donut, plus recurring essential vs recurring treats split with itemized subscription lists.

**Why this priority**: Enables periodic review and decision-making. Most valuable after several weeks of data.

**Independent Test**: Can be tested by populating a month of transactions and opening each report; numbers and visual breakdowns should match the underlying data, and the per-person pie should recompose when the "include general expenses" toggle is flipped.

**Acceptance Scenarios**:

1. **Given** at least 4 weeks of data, **When** the user opens the spend-over-time report, **Then** they see a time-series chart of spending with selectable time ranges.
2. **Given** the per-person pie with "include general expenses" off, **When** the user toggles it on, **Then** the chart recomposes to add each adult's income-proportional share of shared spending and the legend updates.
3. **Given** at least 3 recurring subscriptions exist, **When** the user opens the essentials breakdown report, **Then** they see an essential vs treats recurring split with itemized lists in each bucket and a "% on treats" figure.

---

### User Story 9 - Subscriptions and recurring expenses (Priority: P3)

Users can register recurring expenses (Netflix, Spotify, Rogers, Bell internet, daycare, music lessons, etc.) with cadence and renewal dates. Each subscription can be tagged "for whom" and as essential or treats. Reports surface recurring totals and overlapping streaming subs to flag savings opportunities.

**Why this priority**: Reduces repetitive data entry and powers the essentials/recurring report. Not required initially, but high-value.

**Independent Test**: Can be tested by adding 5 subscriptions with different cadences, advancing the clock past renewal dates, and verifying each subscription auto-logs a corresponding transaction with correct tags.

**Acceptance Scenarios**:

1. **Given** a $19.99 monthly Netflix subscription tagged for Household / Treats, **When** the renewal date arrives, **Then** a transaction is auto-logged with that amount and those tags.
2. **Given** 4 overlapping streaming subscriptions, **When** the user views the essentials breakdown report, **Then** a callout suggests potential savings (e.g. "4 overlapping streaming subs · review to save $52/mo").

---

### Edge Cases

- A household with 0 kids must display correctly (no empty kid grid) and still allow the full feature set.
- A household with 6+ kids must remain legible (kid grid wraps; no truncation or horizontal overflow on a 340 px-wide phone frame).
- A single-adult household: income-proportional split degenerates to 100% one adult; "by income" chip is shown but not meaningful — the UI should still work.
- Both adults log the same expense within seconds (potential duplicate): the system should not block, but should make duplicates easy to spot and delete.
- A user enters an email on the Family screen that has no matching Supabase auth account: the action errors with a clear message and creates no pending state.
- A user enters their own email on the Family screen: idempotent no-op (silent success).
- A user enters the email of an adult already in this household: idempotent no-op (silent success).
- A user tries to add a third active adult: action is rejected with a clear "Households are limited to 2 adults" message; the user must soft-delete one of the existing adults first.
- A user edits or deletes a transaction that was already counted in a closed budget period: totals recompute correctly.
- Splitting a transaction with a 0% or 100% slider value: stored as fully essential or fully treats.
- Network is offline during expense entry: the entry is queued and syncs when connectivity returns (PWA expectation).
- Income drops to zero for one adult: income-proportional split recalculates without divide-by-zero error; "by income" defaults to "split equally" when both incomes are zero.
- Currency display for amounts with fractional cents (sub-dollar values must always display two decimals in CAD).

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Household**

- **FR-001**: System MUST allow users to sign in with email and password. Self-service signup MUST NOT be exposed in v1; user accounts and household memberships are provisioned by an administrator directly in Supabase. The app MUST NOT render a signup form or any public registration path.
- **FR-001a**: Administrator-set passwords MUST be at least 8 characters long AND contain at least one digit (0–9) AND at least one symbol (any non-alphanumeric printable character), with no character-class beyond those, paste allowed, and a maximum length of at least 64. This policy MUST be enforced at the Supabase Auth project configuration level so it applies to admin-created and admin-reset passwords.
- **FR-002**: System MUST allow users to sign in and sign out, and persist sessions across app reloads until explicit sign-out.
- **FR-003**: System MUST support a household concept where multiple adults share the same financial data. Household *creation* is user-initiated in-app: on sign-in, if the authenticated user has no `household_member` row, the app MUST route them to a "Create your household" screen and MUST prevent access to any other authenticated route until they either create a household (becoming its owner and first adult) or are added to one by another adult.
- **FR-004**: System MUST allow an existing household member to add a second adult through the in-app Family screen by entering the adult's email. If the email matches an existing Supabase auth user, that user MUST be attached to the household as a `household_member` with `role='adult'`. If the email does NOT match any auth user, the operation MUST fail with a clear message ("No account exists for that email — ask the admin to create one first") and MUST NOT create any pending state, invite token, or send any email.
- **FR-004a**: System MUST allow an existing household member to add a kid through the in-app Family screen by entering name and age. Kids do not have an `auth.users` account and are stored as `household_member` rows with `user_id = null`, `role='kid'`.
- **FR-004b**: Adult-add MUST be idempotent: if the entered email matches a user who is already a member of this household, the action MUST be a no-op (silent success). It MUST also enforce the 2-adult cap (FR-005) and reject the action if the household already has 2 active (non-soft-deleted) adults.

**Family**

- **FR-005**: System MUST allow up to 2 adults and any number of children per household.
- **FR-006**: Each member MUST have at minimum a name; kids MUST also have an age.
- **FR-007**: The UI MUST scale to any number of kids without truncation or horizontal overflow on a 340 px-wide mobile viewport.
- **FR-007a**: Removing a household member MUST soft-delete them: the member record persists with a `deleted_at` timestamp, all transactions referencing them remain intact and continue to render in historical reports. Soft-deleted members MUST be hidden from add-transaction selectors, the family screen, and "for whom" filter chips. Soft-deleted adults free the 2-adult cap, allowing a replacement adult to be added or invited.

**Money entry**

- **FR-008**: Users MUST be able to log an expense with at minimum: amount, category, date, notes, "paid by" (which adult), "for whom" (household, adult, or kid), and essential/non-essential tag (or a per-transaction essential split percentage).
- **FR-009**: Users MUST be able to log income with at minimum: a **net (post-tax) amount**, source label (one of `Salary | Contract | Self-employed | Benefit | Refund | Gift` — used as descriptive metadata, NOT to drive any automatic tax or set-aside logic), date, and earner (which adult). v1 MUST NOT compute, withhold, or auto-aside any portion of income for taxes.
- **FR-010**: Users MUST be able to edit and delete any transaction they can see.
- **FR-011**: A single transaction MUST be splittable into an essential portion and a non-essential portion (slider 0–100%) that are stored and reported separately.
- **FR-011a**: System MUST provide a Quick Add screen reached from the dashboard FAB. Quick Add MUST present the household's most recent expenses (as a tile grid) and active subscriptions (as a list); the primary tap on either MUST log a new expense that copies the source's merchant, amount, category, "for whom", "paid by", essential split, and split rule, and MUST set the new transaction's date to today. Subscription rows MUST additionally expose a pencil-icon secondary action that navigates to that subscription's edit sheet. Quick Add MUST also expose a "+" affordance that opens the full Add Expense form for new merchants. Add Income remains reachable from the drawer as a separate action. The filter chips visible in the design (`Recent`, `Subs`, `Per kid`, `Merchants`, `Categories`) are non-normative: only `Recent` and `Subs` are MVP; the other three are post-v1 UI slicings of the same data and MAY be added later without spec change.
- **FR-012**: Logging income MUST update the derived household income-proportional split percentages.

**Categories, defaults, and split rules**

- **FR-013**: System MUST provide sensible default categories (Groceries, Utilities, Transport, Kids, Health, Subscriptions, etc., with Canadian-context examples such as Rogers, Bell, RESP, TFSA).
- **FR-014**: Each category MUST be able to carry a default essential percentage (e.g. Groceries default 80% essential) which applies automatically on new entries unless overridden.
- **FR-015**: System MUST offer at least these split-rule options for shared expenses: "Adult A 100%", "Adult B 100%", "50/50", "by income" — and "by income" MUST be computed from current logged adult incomes, not a hard-coded percentage.
- **FR-015a**: When a split rule produces fractional cents, each adult's share MUST be floored to whole cents and the residual cent(s) MUST be assigned to the higher-earning adult (or to Adult A in display order when incomes are equal or both zero). Shares MUST always sum exactly to the transaction's total amount.

**Dashboard**

- **FR-016**: Dashboard MUST surface the current household balance, "left to spend" for the month, recent activity, and an essential vs treats summary.
- **FR-017**: Dashboard MUST update in real time as transactions are added on any device in the same household.

**Budget**

- **FR-018**: Users MUST be able to set a monthly limit per category and see progress vs that limit.
- **FR-019**: Budget overview MUST display each category's spending split into essential vs treats.
- **FR-020**: Budget overview MUST allow filtering by All / Essential / Treats.

**Transactions**

- **FR-021**: Users MUST be able to view all transactions in a list grouped by date.
- **FR-022**: Transactions list MUST support search by merchant/notes and filter chips for category, "for whom", essential/treats, and date range.

**Reports**

- **FR-023**: System MUST provide a spend-over-time report.
- **FR-024**: System MUST provide a cashflow report with KPIs and insights.
- **FR-025**: System MUST provide a per-person pie chart with a toggle to include or exclude each adult's income-proportional share of shared bills.
- **FR-026**: System MUST provide an essentials breakdown: overall essential vs treats donut, plus a recurring essential vs recurring treats split with itemized subscription lists.

**Subscriptions / recurring**

- **FR-027**: Users MUST be able to register recurring expenses with cadence (weekly, monthly, etc.) and renewal date.
- **FR-028**: System MUST auto-log a transaction on each renewal date with the subscription's saved tags ("for whom", essential/treats, paid-by).
- **FR-029**: Subscription management MUST surface overlapping/duplicative subs (e.g. multiple streaming services) for savings review.

**Canadian tax tracking** *(removed from v1 — see clarification §6)*

> FR-030, FR-031, FR-032, FR-033 — **REMOVED.** No Taxes screen, CRA instalment timeline, deductions tracking, marginal-rate display, GST/HST set-aside, or province-specific tax profile in v1. Canadian-tax terminology survives only as income source labels (T4, T4A, CCB, etc.) used for descriptive metadata in the income form and reports. Re-introduction is a post-v1 roadmap item.

**Settings**

- **FR-034**: Settings MUST include household members management, currency display (CAD), and the income-proportional split rule view.
- **FR-035**: Settings MUST allow editing of an "essential rule" per category.

**Platform & presentation**

- **FR-036**: The app MUST be a mobile-first Progressive Web App, installable to the home screen.
- **FR-037**: All currency MUST be displayed in CAD with two decimal places.
- **FR-038**: Primary navigation MUST be a hamburger drawer reachable from every screen.

### Key Entities *(include if feature involves data)*

- **Household**: A shared financial unit; owns all data below. Has a name, currency (CAD), and an income-proportional split rule derived from member incomes.
- **Member**: A person in a household. Has a role (Adult or Kid), name, age (for kids), optional avatar, (for adults) an associated user account and current monthly **net** income figure used by the split rule, and a nullable `deleted_at` timestamp. A non-null `deleted_at` hides the member from new-entry UI but preserves their references in historical transactions and reports.
- **Account/User**: A login (email + password) attached to one or more household memberships.
- **Category**: A spending classification (e.g. Groceries, Kids · all, Subscriptions). Has a name, default essential percentage, and optional monthly budget limit.
- **Transaction**: A single money movement. Has type (expense/income), amount (net for income), date, category, notes, paid-by (Member), for-whom (Household or Member), essential split (percentage), source label for income (T4, T4A, etc. — metadata only), and optional link to a Subscription.
- **Subscription**: A recurring expense template that auto-creates Transactions. Has merchant, amount, cadence, next renewal date, paid-by, for-whom, essential split, and active/paused state.
- **BudgetLimit**: A monthly cap per category (and optionally per month/year).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After admin provisioning of two adult accounts linked to a household, the household can add their kids and log their first expense in under 5 minutes from first sign-in.
- **SC-002**: Logging a typical expense (amount, category, "for whom", essential split) takes no more than 4 taps after opening the app.
- **SC-003**: When one adult adds a transaction, the other adult sees it on the dashboard within 5 seconds of opening the app.
- **SC-004**: The app renders all screens correctly on a 340 px-wide mobile viewport, with zero horizontal scrolling, for households containing between 0 and 8 kids.
- **SC-005**: At least 90% of test users can correctly identify "how much we spent on Mia this month" and "what is essential vs treats" in under 30 seconds without help.
- **SC-006**: The per-person pie chart's "include general expenses" toggle recomposes the chart and updates the legend in under 500 ms on a mid-range mobile device.
- **SC-007**: 95% of subscription auto-logs are created within 24 hours of their scheduled renewal date.
- **SC-008**: From an open dashboard, re-logging a recent expense via Quick Add takes no more than 2 taps (open Quick Add, tap tile).
- **SC-009**: Editing a single transaction's essential split updates dashboard, budget, and reports figures with no visible inconsistencies.

## Assumptions

- All amounts and budgets are in **CAD**; multi-currency is out of scope for v1.
- Each household has exactly **2 adults** and any number of kids; single-parent households can also be supported (income split degenerates to 100% one adult).
- Authentication is **email + password**, with user accounts (`auth.users` rows) provisioned by an administrator directly in Supabase. The app exposes no signup or public-registration path in v1; OAuth/social providers and self-service signup are out of scope for v1.
- **Household creation** is user-initiated, in-app, on first sign-in when the user has no membership. The admin creates only the Supabase `auth.users` row — never the household. Subsequent adults are attached in-app via email lookup against `auth.users`; kids are added in-app by name + age. Email-delivered invitations are out of scope for v1.
- Data is scoped per-household; a member of one household cannot read or write data belonging to another household.
- "By income" split percentages are **always derived from current logged adult incomes**, never stored as fixed percentages.
- The app targets mobile PWA first; a 340 px-wide phone viewport is the primary design target (matching the wireframe).
- Visual language: tidy boxes-and-labels wireframe style with calm warm-grey palette, calm teal-blue accent, JetBrains Mono for labels and Inter for body text — these are starting defaults to be refined in hi-fi.
- Each screen's design will be **narrowed to one approach** during planning; the three wireframe variations per screen are exploratory inputs, not requirements.
- Kid rewards/chores tracking is **explicitly out of scope** (removed during design iteration in favor of a "compare kids" view).
- The "tabbed wireframe explorer" UI from the design bundle is for review only — the production app uses normal screen-by-screen mobile navigation with a hamburger drawer.
- PWA offline behavior queues writes and syncs on reconnect; full conflict resolution beyond last-write-wins is out of scope for v1.
- Self-serve account / household deletion is **explicitly out of scope for v1**. PIPEDA right-to-erasure requests are handled manually by operations on user request and added to the post-v1 roadmap. The only user-facing deletion action in v1 is per-member soft-delete (FR-007a).
