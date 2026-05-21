# Feature Specification: Family Budget App (Canadian PWA)

**Feature Branch**: `001-family-budget-app`
**Created**: 2026-05-21
**Status**: Draft
**Input**: User description: "Fetch this design file, read its readme, and implement the relevant aspects of the design. https://api.anthropic.com/v1/design/h/i74OmQe-LtGwBb73JCnk7g?open_file=Budget+Wireframes.html — Implement: Budget Wireframes.html"

A calm, minimal mobile-first budgeting app for Canadian couples and families (2 adults + any number of kids) covering household expenses, income, taxes, budgets, transactions, reports, and subscriptions — with family-aware tagging, essential/non-essential breakdowns, and income-proportional cost-sharing between adults.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure household account access (Priority: P1)

A family member creates an account and signs in so the household can begin tracking shared finances privately. New members can be invited into the same household so both adults see the same data.

**Why this priority**: Without authentication and a household concept, no other feature is usable. This is the entry point.

**Independent Test**: Can be fully tested by signing up with an email/password, signing back out, signing back in, inviting a second adult, and confirming both adults see the same (initially empty) household state.

**Acceptance Scenarios**:

1. **Given** a visitor with no account, **When** they provide email and password and submit signup, **Then** they land in the dashboard of an empty household they own.
2. **Given** an existing user, **When** they enter correct credentials, **Then** they see their household's current dashboard; with incorrect credentials they see a clear error and remain on the login screen.
3. **Given** a household owner, **When** they invite a second adult by email, **Then** that person can join the same household and see all shared data after accepting.
4. **Given** a signed-in user, **When** they sign out, **Then** subsequent visits require re-authentication.

---

### User Story 2 - Log expenses and income, see the household balance (Priority: P1)

Either adult can quickly log an expense (amount, category, notes) or income, and the dashboard reflects the new running balance and recent activity in real time across both adults' devices.

**Why this priority**: Capturing money in/out is the core job of a budgeting app. Without it the product has no value.

**Independent Test**: Can be tested by logging 5 expenses and 2 income entries on one device, then opening the app on the second adult's device and seeing the same balance, the same transactions, and a correctly updated dashboard.

**Acceptance Scenarios**:

1. **Given** an empty household, **When** an adult logs an expense of $45.20 in "Groceries", **Then** the dashboard balance decreases by $45.20 and the transaction appears at the top of recent activity.
2. **Given** an income of $2,400 logged as T4 employment, **When** the user saves it, **Then** the dashboard balance increases by $2,400 and the income appears in the transactions list.
3. **Given** a transaction was logged on Adult A's device, **When** Adult B opens the app, **Then** the same transaction is visible without manual sync.
4. **Given** a transaction with an incorrect amount, **When** the user edits or deletes it, **Then** balances and lists update accordingly.

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

### User Story 8 - Canadian tax tracking (CRA) (Priority: P3)

Self-employed or mixed-income households can track CRA instalments (Mar 15 / Jun 15 / Sep 15 / Dec 15), categorized deductions using Canadian terms (Home office · T2125, Vehicle · business km, Tuition · T2202, Private health premiums), GST/HST set-aside, and key deadlines (T1 personal Apr 30, self-employed Jun 15).

**Why this priority**: Differentiator for the Canadian market and high-value at filing time, but not required for everyday budgeting.

**Independent Test**: Can be tested by selecting a tax profile (e.g. Sole Proprietor · ON), then verifying the timeline shows the right CRA deadlines, the deductions list uses Canadian terminology, and a marginal rate display reflects the chosen province.

**Acceptance Scenarios**:

1. **Given** a Sole Proprietor · ON profile, **When** the user opens the Taxes screen, **Then** the four CRA instalment deadlines appear with their target dates.
2. **Given** a logged deduction tagged "Home office · T2125", **When** the user views the deductions list, **Then** it appears with the correct Canadian category and amount.
3. **Given** GST/HST set-aside is enabled, **When** an applicable income is logged, **Then** a portion is automatically routed into the GST/HST bucket.

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
- A user changes province in settings: tax timelines and deductions adjust without breaking previously logged data.
- A user edits or deletes a transaction that was already counted in a closed budget period: totals recompute correctly.
- Splitting a transaction with a 0% or 100% slider value: stored as fully essential or fully treats.
- Network is offline during expense entry: the entry is queued and syncs when connectivity returns (PWA expectation).
- Income drops to zero for one adult: income-proportional split recalculates without divide-by-zero error; "by income" defaults to "split equally" when both incomes are zero.
- Currency display for amounts with fractional cents (sub-dollar values must always display two decimals in CAD).

## Requirements *(mandatory)*

### Functional Requirements

**Authentication & Household**

- **FR-001**: System MUST allow users to sign up with email and password.
- **FR-002**: System MUST allow users to sign in and sign out, and persist sessions across app reloads until explicit sign-out.
- **FR-003**: System MUST support a household concept where multiple adults share the same financial data after invitation.
- **FR-004**: System MUST allow a household owner to invite another adult to join their household.

**Family**

- **FR-005**: System MUST allow up to 2 adults and any number of children per household.
- **FR-006**: Each member MUST have at minimum a name; kids MUST also have an age.
- **FR-007**: The UI MUST scale to any number of kids without truncation or horizontal overflow on a 340 px-wide mobile viewport.

**Money entry**

- **FR-008**: Users MUST be able to log an expense with at minimum: amount, category, date, notes, "paid by" (which adult), "for whom" (household, adult, or kid), and essential/non-essential tag (or a per-transaction essential split percentage).
- **FR-009**: Users MUST be able to log income with at minimum: amount, source/type (T4 employment, T4A · contract, Self-employed, CCB, Refund, Gift), date, and earner (which adult).
- **FR-010**: Users MUST be able to edit and delete any transaction they can see.
- **FR-011**: A single transaction MUST be splittable into an essential portion and a non-essential portion (slider 0–100%) that are stored and reported separately.
- **FR-012**: Logging income MUST update the derived household income-proportional split percentages.

**Categories, defaults, and split rules**

- **FR-013**: System MUST provide sensible default categories (Groceries, Utilities, Transport, Kids, Health, Subscriptions, etc., with Canadian-context examples such as Rogers, Bell, RESP, TFSA).
- **FR-014**: Each category MUST be able to carry a default essential percentage (e.g. Groceries default 80% essential) which applies automatically on new entries unless overridden.
- **FR-015**: System MUST offer at least these split-rule options for shared expenses: "Adult A 100%", "Adult B 100%", "50/50", "by income" — and "by income" MUST be computed from current logged adult incomes, not a hard-coded percentage.

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

**Canadian tax tracking**

- **FR-030**: System MUST use Canadian tax terminology (CRA instalments, T1, T4, T4A, T2125, T2202, GST/HST, CCB, TFSA, RESP) throughout tax-related screens.
- **FR-031**: System MUST display the four CRA instalment deadlines (Mar 15 / Jun 15 / Sep 15 / Dec 15) and the personal/self-employed filing deadlines (Apr 30 / Jun 15) for the active tax year.
- **FR-032**: System MUST allow users to select a province and a tax profile (e.g. Sole Proprietor · ON), and reflect this in the marginal rate display and applicable deductions.
- **FR-033**: System MUST allow categorized deduction tracking (Home office · T2125, Vehicle · business km, Tuition · T2202, Private health premiums) and a GST/HST set-aside bucket.

**Settings**

- **FR-034**: Settings MUST include household members management, currency display (CAD), tax profile, and the income-proportional split rule view.
- **FR-035**: Settings MUST allow editing of an "essential rule" per category.

**Platform & presentation**

- **FR-036**: The app MUST be a mobile-first Progressive Web App, installable to the home screen.
- **FR-037**: All currency MUST be displayed in CAD with two decimal places.
- **FR-038**: Primary navigation MUST be a hamburger drawer reachable from every screen.

### Key Entities *(include if feature involves data)*

- **Household**: A shared financial unit; owns all data below. Has a name, currency (CAD), province, tax profile, and an income-proportional split rule derived from member incomes.
- **Member**: A person in a household. Has a role (Adult or Kid), name, age (for kids), optional avatar, and (for adults) an associated user account and current monthly income figure used by the split rule.
- **Account/User**: A login (email + password) attached to one or more household memberships.
- **Category**: A spending classification (e.g. Groceries, Kids · RESP, Subscriptions). Has a name, default essential percentage, and optional monthly budget limit.
- **Transaction**: A single money movement. Has type (expense/income), amount, date, category, notes, paid-by (Member), for-whom (Household or Member), essential split (percentage), source/type for income (T4, T4A, etc.), and optional link to a Subscription.
- **Subscription**: A recurring expense template that auto-creates Transactions. Has merchant, amount, cadence, next renewal date, paid-by, for-whom, essential split, and active/paused state.
- **BudgetLimit**: A monthly cap per category (and optionally per month/year).
- **Deduction**: A tax-relevant entry referencing a Canadian category (T2125 home office, T2202 tuition, etc.) with amount, date, and notes.
- **TaxProfile**: Province, filer type (employee, sole proprietor, mixed), GST/HST registrant flag, and resulting filing/instalment deadlines.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new household can complete sign-up, add both adults plus their kids, and log their first expense in under 5 minutes from first visit.
- **SC-002**: Logging a typical expense (amount, category, "for whom", essential split) takes no more than 4 taps after opening the app.
- **SC-003**: When one adult adds a transaction, the other adult sees it on the dashboard within 5 seconds of opening the app.
- **SC-004**: The app renders all screens correctly on a 340 px-wide mobile viewport, with zero horizontal scrolling, for households containing between 0 and 8 kids.
- **SC-005**: At least 90% of test users can correctly identify "how much we spent on Mia this month" and "what is essential vs treats" in under 30 seconds without help.
- **SC-006**: The per-person pie chart's "include general expenses" toggle recomposes the chart and updates the legend in under 500 ms on a mid-range mobile device.
- **SC-007**: 95% of subscription auto-logs are created within 24 hours of their scheduled renewal date.
- **SC-008**: A user can configure a tax profile (Sole Proprietor · ON) and see the four CRA instalment deadlines for the current year without any text input beyond province selection.
- **SC-009**: Editing a single transaction's essential split updates dashboard, budget, and reports figures with no visible inconsistencies.

## Assumptions

- All amounts and budgets are in **CAD**; multi-currency is out of scope for v1.
- Default province is **Ontario**, configurable in settings; tax behavior swaps automatically for BC/AB/QC where rates and PST/QST handling differ.
- Each household has exactly **2 adults** and any number of kids; single-parent households can also be supported (income split degenerates to 100% one adult).
- Authentication is **email + password** (the stakeholder's chosen auth provider is captured in planning, not in this spec); OAuth/social providers are out of scope for v1.
- Household membership is established via **email invitation**: each adult signs up with their own account and links to the same household through an invite.
- Data is scoped per-household; a member of one household cannot read or write data belonging to another household.
- "By income" split percentages are **always derived from current logged adult incomes**, never stored as fixed percentages.
- The app targets mobile PWA first; a 340 px-wide phone viewport is the primary design target (matching the wireframe).
- Visual language: tidy boxes-and-labels wireframe style with calm warm-grey palette, calm teal-blue accent, JetBrains Mono for labels and Inter for body text — these are starting defaults to be refined in hi-fi.
- Each screen's design will be **narrowed to one approach** during planning; the three wireframe variations per screen are exploratory inputs, not requirements.
- Kid rewards/chores tracking is **explicitly out of scope** (removed during design iteration in favor of a "compare kids" view).
- The "tabbed wireframe explorer" UI from the design bundle is for review only — the production app uses normal screen-by-screen mobile navigation with a hamburger drawer.
- PWA offline behavior queues writes and syncs on reconnect; full conflict resolution beyond last-write-wins is out of scope for v1.
