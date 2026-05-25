# Feature Specification: Supabase Foundation for Budget App

**Feature Branch**: `001-setup-supabase`
**Created**: 2026-05-22
**Status**: Draft
**Input**: User description: "Setup supabase on this project. Use ~/Projects/daily-learning-worktree/fix-account-access/ as the guide"

## Clarifications

### Session 2026-05-22

- Q: Should this feature include database tables for the Budget app's domain (not just the auth/RLS foundation)? → A: Yes — include the full first-pass ("normal") budget schema, not just a demonstration table.
- Q: What entities make up the first-pass budget schema for this feature? → A: Categories + Transactions only (minimal foundation; accounts, budgets, payees, tags come in later features).
- Q: How do users get their accounts, given public signup is out of scope? → A: An administrator manually creates each user in the Supabase dashboard for the relevant environment. Migrations contain no hardcoded user UUIDs and the repository contains no user credentials.
- Q: What UI ships with this feature beyond the sign-in page? → A: A minimal authenticated app shell (header showing the signed-in user's email and a sign-out button) plus a placeholder home page confirming sign-in. No UI is shipped for Categories or Transactions in this feature; they exist as data only.
- Q: How is the Supabase project hosted now, vs. the original "shared instance" assumption? → A: For now, **local Supabase only** (`npx supabase start` per developer; each developer runs their own Docker stack). The original "shared cloud project" stance was retracted after we recognized that Supabase CLI's migration-tracking table is project-global and cannot be safely shared by two CLI-owning repos. A dedicated paid Supabase project for the Budget app is the planned cloud target and will be added in a later feature; FR-013's `budget` schema convention persists in both worlds.

### Session 2026-05-24 (Phase 7 scope expansion)

- Q: The app code carries ~10 routes and ~25 RPC call sites from the reference project (`onboarding/create-household`, `family/`, `dashboard/`, `transactions/`, `subscriptions/`, `budget/`, `add/`, `add-income/`, `quick-add/`, `reports/`, `settings/`) that the current spec doesn't cover, and trying to use them produces `Could not find the function budget.create_household` errors. Do we restore the household-based model so these routes work, or strip them out? → A: **Restore.** Port the legacy household + member + subscription model from `0001`–`0004` into the `budget` schema and implement every missing RPC. This shifts 001 from "Supabase foundation" to "Supabase foundation + first-pass full app"; tracked as Phase 7 in `tasks.md`.
- Q: The current `budget.categories` and `budget.transactions` are user-owned (`user_id = auth.uid()`). Should they become household-owned? → A: **Yes — household-owned.** Drop and recreate both tables under the legacy schema shapes adapted to `budget` (with the system-global seed-category pattern: `household_id IS NULL` rows are read-only system seeds visible to everyone). No production data exists yet, so the drop is safe.
- Q: How are write paths gated, given the existing Principle III grant lockdown (R10)? → A: Every write in Phase 7 goes through a `SECURITY DEFINER` RPC owned by a new `budget_function_owner` non-superuser role (research.md R10's "Validation gap" pre-requisite). Direct `supabase.from(...).insert/update/delete` is impossible because the lockdown migration revokes those grants. Reads that the existing code does via `supabase.from(...)` (5 call sites) must also be ported to RPCs in T094 since the same lockdown applies.
- Q: Recurring subscriptions need to auto-materialize as transactions. How? → A: Via `pg_cron` schedule `subscriptions-hourly` (matches legacy `0004_subscriptions.sql:39–43`). The `pg_cron` extension is installed in the `extensions` schema (not `public`) to avoid re-introducing the `extension_in_public` lint that T044 closed. The cron-invoked function bypasses RLS only on that specific code path (documented in T088).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning user signs in to access the Budget app (Priority: P1)

A user with an existing account opens the Budget app, is prompted to sign in with email and password, and on success lands on the authenticated home page where their budget workspace will live. Without a valid session, every non-login page redirects them back to the sign-in screen.

**Why this priority**: Until authentication works end-to-end, no other Budget feature can exist for real users — every later story (categories, transactions, reports) assumes a known, identified user. This is the foundational unlock and must be the MVP.

**Independent Test**: With a pre-provisioned account, visit any app URL, get redirected to the sign-in page, submit valid credentials, and confirm you land on the authenticated home page. Visiting the app again in a new tab keeps the session active without re-entering credentials.

**Acceptance Scenarios**:

1. **Given** a visitor with no active session, **When** they visit any in-app URL, **Then** they are redirected to the sign-in page.
2. **Given** the sign-in page is shown, **When** the user submits valid email and password, **Then** they are redirected to the authenticated home page and remain signed in across navigation and reloads.
3. **Given** the sign-in page is shown, **When** the user submits invalid credentials, **Then** they stay on the sign-in page and see a clear error message.
4. **Given** a user with an active session, **When** they revisit the sign-in page directly, **Then** the application treats them as authenticated and does not require re-entry of credentials.

---

### User Story 2 - Signed-in user only sees their own data (Priority: P1)

Each signed-in user can only read, create, update, or delete records that belong to them. A second user signed in from a different browser cannot see or alter the first user's records, even if they guess identifiers.

**Why this priority**: A multi-user budget app where one user can see another user's finances is a non-starter. Data isolation must be in place before any budget data is stored or displayed; retrofitting isolation later is risky and expensive.

**Independent Test**: Create two test accounts. Insert a record while signed in as User A. Sign in as User B in a separate session and confirm none of User A's records appear in any listing, and direct lookups by identifier return nothing. Repeated for write attempts: User B cannot modify User A's records.

**Acceptance Scenarios**:

1. **Given** two distinct signed-in users, **When** each lists their records, **Then** each user sees only the records they created.
2. **Given** User A owns a record, **When** User B attempts to read, update, or delete that record by its identifier, **Then** the operation returns no data or is rejected.
3. **Given** any signed-in user creates a new record, **When** the record is persisted, **Then** ownership is automatically attributed to that user without the client needing to supply it.

---

### User Story 3 - Signed-in user signs out (Priority: P2)

A signed-in user can explicitly end their session. After signing out, the app behaves as it does for any unauthenticated visitor — they are sent back to the sign-in page, and protected URLs are no longer accessible from that browser.

**Why this priority**: Sign-out is required for shared devices and for a complete authentication loop, but the app is usable for a single trusted user without it. It ships immediately after sign-in/isolation are in place.

**Independent Test**: As a signed-in user, trigger sign-out. Confirm the session is terminated and that revisiting any protected URL redirects to the sign-in page.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they activate the sign-out control in the app shell header, **Then** their session ends and they are redirected to the sign-in page.
2. **Given** a user has signed out, **When** they revisit any protected URL in the same browser, **Then** they are redirected to the sign-in page.
3. **Given** a signed-in user is on any protected page, **When** the page renders, **Then** the app shell shows their email address and the sign-out control.

---

### User Story 4 - First-time signed-in user creates a household (Priority: P1) — Phase 7

A signed-in user who isn't a member of any household lands on an onboarding screen. They submit a household name and become its first adult member. After creation they reach the dashboard, which renders for the household they just made.

**Why this priority**: Every household-scoped feature (transactions, family, subscriptions, reports, settings) needs a household to exist. Without onboarding, a signed-in user has nowhere to send writes and every page that does `auth_user_household_ids()` returns the empty set.

**Independent Test**: Sign in as a brand-new user. Confirm landing on `/onboarding/create-household`. Submit a name. Confirm redirect to `/dashboard` and that `/family` lists the calling user as the sole adult member.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no household membership, **When** they visit any in-app URL other than `/onboarding/create-household`, **Then** they are redirected to that onboarding page.
2. **Given** the onboarding page, **When** the user submits a non-empty household name, **Then** a household is created with them as the first adult and they land on `/dashboard`.
3. **Given** a user already in a household, **When** they visit `/onboarding/create-household`, **Then** they are redirected to `/dashboard` (onboarding is one-shot).

---

### User Story 5 - Adults manage household members (Priority: P1) — Phase 7

A household adult adds the second adult (by their existing account email) or any number of kids (display name + age). They can update an adult's monthly income or soft-delete any member. The system rejects a 3rd active adult.

**Why this priority**: Multi-adult households are the primary use case ("family budget"). The adult cap and member roster drive the income split, per-kid reporting, and transaction attribution that every later page surfaces.

**Independent Test**: As a household adult, add a second adult by email (assumes their account exists). Add a kid. Update an adult's income. Soft-delete the kid. Attempt to add a 3rd adult; confirm rejection with `Households are limited to 2 adults`.

**Acceptance Scenarios**:

1. **Given** a household with one adult, **When** that adult adds a second adult by an email that exists in `auth.users`, **Then** that user appears in the family roster as `adult`.
2. **Given** a household with two active adults, **When** an adult tries to add a 3rd adult, **Then** the operation is rejected and the error surfaces to the UI.
3. **Given** a household member, **When** an adult soft-deletes them, **Then** they no longer appear in active rosters but historical transactions still resolve their display name.

---

### User Story 6 - Household members log and review transactions (Priority: P1) — Phase 7

Any active household member logs an expense or income transaction (amount, category, date, optional note, optional member attribution). Listed transactions are filterable by member / essential-or-treat / date range / free-text search. Edits and deletes are allowed for any member.

**Why this priority**: Recording and reviewing money flow is the core value proposition. Without this, the dashboard and reports have nothing to summarize.

**Independent Test**: As an adult, log an expense in category "Groceries" for $50. Confirm it appears in `/transactions` and is reflected in `/dashboard` totals. Filter by member; confirm the row is included or excluded correctly. Edit the amount and confirm the change persists. Delete and confirm it's gone.

**Acceptance Scenarios**:

1. **Given** a household with at least one category, **When** any member submits a `log_expense` payload, **Then** a `budget.transaction` row is created scoped to that household, and `/dashboard` + `/transactions` reflect it on next render.
2. **Given** a transaction owned by a household member, **When** any household member edits its amount/notes/essential_pct/date, **Then** the change is persisted and visible to every other member of the household.
3. **Given** a transaction, **When** a household member deletes it, **Then** it no longer appears in any household-scoped listing.
4. **Given** a member of household A, **When** they attempt to read or modify a transaction belonging to household B, **Then** the operation returns no data or is rejected.

---

### User Story 7 - Subscriptions auto-materialize as transactions (Priority: P2) — Phase 7

A household member registers a recurring subscription (merchant, amount, category, cadence, next renewal date). An hourly cron job inspects every active subscription whose `next_renewal_at <= today` and creates the corresponding transaction, then advances the renewal date by one cadence step. The unique `(subscription_id, occurrence_date)` index makes replays idempotent.

**Why this priority**: Manual subscription tracking is a known pain point; auto-materialization is the differentiator from a plain ledger app. Lower than P1 because the household is still usable without it.

**Independent Test**: Register a subscription with `next_renewal_at = today`. Call `SELECT budget.materialize_due_subscriptions(true);` (or wait for the cron). Confirm a new transaction exists with the subscription's amount/category/merchant and `next_renewal_at` advanced by one cadence step. Re-running the same SQL produces zero new rows (idempotency).

**Acceptance Scenarios**:

1. **Given** an active subscription due today, **When** the cron job runs, **Then** exactly one `budget.transaction` is materialized for that subscription and `next_renewal_at` is advanced.
2. **Given** the cron job already ran for a given subscription/occurrence, **When** it runs again with no time advance, **Then** no new transaction is created (idempotent on the unique `(subscription_id, occurrence_date)` index).
3. **Given** a paused subscription, **When** the cron job runs, **Then** no transaction is materialized for it.

---

### User Story 8 - Household sees aggregated reports and dashboard (Priority: P2) — Phase 7

The dashboard shows left-to-spend, monthly income/expense, essential-vs-treats split, and recent activity. Report pages drill down: cashflow KPIs, essentials breakdown (including recurring subscriptions essential/treats), spend over time, per-person breakdown, per-category budget progress.

**Why this priority**: Reporting is the second-order benefit of logging transactions. Lower than P1 because logging works without it; ships immediately after US6.

**Independent Test**: With seeded transactions and subscriptions in a household, visit `/dashboard`, `/budget`, `/reports/cashflow`, `/reports/essentials`, `/reports/spend-over-time`, `/reports/per-person`. Confirm each page returns numbers consistent with the underlying transactions.

**Acceptance Scenarios**:

1. **Given** a household with month-to-date transactions, **When** any member visits `/dashboard`, **Then** the displayed totals (income, expense, left to spend, essential/treats split) match `SUM` over the underlying transactions for that month.
2. **Given** category budgets set for the current month, **When** a member visits `/budget`, **Then** each category shows its monthly budget and the actual spend.
3. **Given** member-attributed transactions, **When** a member visits `/reports/per-person`, **Then** spend per member is correctly partitioned.

---

### Edge Cases

- A user's session token expires while they are using the app: the next protected request must transparently refresh the session if possible, and otherwise redirect to sign-in without losing form input ungracefully.
- The authentication provider is temporarily unreachable when the user signs in: the sign-in page must show a non-cryptic error and allow the user to retry rather than appearing broken.
- A user has multiple tabs open and signs out in one of them: protected requests from the other tabs must redirect to sign-in on next interaction.
- A user manually navigates directly to the sign-in URL while already signed in: the app should not error; treating them as still authenticated is acceptable.
- A user attempts to submit the sign-in form with an empty email or password: the form must prevent submission and surface a clear validation message.
- Records that pre-date this feature (if any) must either be assigned to a specific owner or be excluded from queries; orphaned rows must never be visible to arbitrary users.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST require an authenticated session to access any page outside the sign-in flow and any non-public asset.
- **FR-002**: The app MUST provide a sign-in page that accepts an email address and password.
- **FR-003**: On submission of valid credentials, the app MUST establish a session that persists across page navigations and browser reloads until it is explicitly ended or expires.
- **FR-004**: On submission of invalid credentials, the app MUST keep the user on the sign-in page and display a human-readable error.
- **FR-005**: The app MUST refresh the user's session in the background on protected requests, so that a working but stale session does not force re-authentication.
- **FR-006**: The app MUST provide a way for a signed-in user to end their session ("sign out"), after which they are returned to the sign-in page.
- **FR-007**: The app MUST resolve the current user on the server for every protected page so that page output reflects that specific user's data.
- **FR-008**: Every record in user-owned tables MUST carry an owner identifier referencing the authenticated user it belongs to.
- **FR-009**: When a signed-in user creates a record in a user-owned table, the system MUST automatically attribute ownership to that user without requiring the client to pass the owner identifier.
- **FR-010**: The database MUST enforce, at the storage layer, that a user can only read, insert, update, or delete records they own; client-side filtering alone is not sufficient.
- **FR-011**: The database schema and migrations for this app MUST be version-controlled in the repository and applied in order, so that the schema can be reproduced from scratch on any environment.
- **FR-012**: Required configuration (the project URL and the public anonymous key for the authentication/database service) MUST be supplied via environment variables and MUST never be committed to the repository.
- **FR-012a**: Migrations and seed files MUST NOT contain hardcoded user identifiers, email addresses, or passwords. Per-environment users are created by an administrator out-of-band (in the Supabase dashboard) and resolve themselves at runtime via the authenticated session.
- **FR-013**: Any tables, views, or functions created for this app MUST live under this project's dedicated database schema (`budget`). This convention is enforced today against the local Supabase stack and persists when the Budget app moves to a dedicated cloud Supabase project later. Sharing the schema namespace with another app on the same physical instance is out of scope (see Assumption regarding cloud hosting).
- **FR-014**: A developer setting up the project MUST be able to install dependencies and start the app such that the sign-in flow is reachable without manual edits beyond providing environment variables.
- **FR-015**: The feature MUST create persistent `Category` and `Transaction` tables in the `budget` schema, each carrying an owner reference defaulted to the authenticated user, with isolation enforced per FR-010.
- **FR-016**: A `Category`'s name MUST be unique per owning user (the same name may exist across different users).
- **FR-017**: A `Transaction` MUST reference exactly one `Category` owned by the same user; the database MUST reject attempts to reference a category owned by a different user, and MUST prevent deletion of a category that still has transactions.
- **FR-018**: Every protected page MUST be rendered inside a shared authenticated app shell that displays the signed-in user's email address and a sign-out control.
- **FR-019**: Activating the sign-out control MUST trigger the sign-out behavior defined in FR-006 (end session and redirect to the sign-in page) without requiring the user to navigate to a specific URL.
- **FR-020**: After successful sign-in, the user MUST land on a placeholder home page that visibly confirms they are signed in (e.g., a greeting referencing their email). No Category or Transaction UI is required by this feature.

#### Phase 7 — Household model + full app

These requirements supersede the user-centric ownership model that FR-008/FR-009/FR-015 implicitly described. After Phase 7 ships, "owner" for household-scoped data means "the household the calling user is an active member of" — not the individual `auth.uid()`.

- **FR-021**: A signed-in user with no household membership MUST be redirected to `/onboarding/create-household`; every other in-app route is unreachable until they create or are added to a household.
- **FR-022**: Creating a household MUST atomically (a) insert the household, (b) insert the calling user as a `role='adult'` member with `user_id := auth.uid()`, and (c) return the new household id so the caller can redirect to it.
- **FR-023**: `budget.category`, `budget.transaction`, and `budget.subscription` MUST be household-owned: every row carries a `household_id` foreign-keyed to `budget.household`, and RLS isolates rows to the calling user's active household memberships (via the helper `budget.auth_user_household_ids()`).
- **FR-024**: System-global seed categories (e.g., "Groceries", "Income") MUST exist as rows with `household_id IS NULL` and be readable by every authenticated user; per-household overrides are written by cloning a system-global row into a household-scoped row before mutation.
- **FR-025**: Every household-scoped write — including the create-household call itself — MUST go through a `SECURITY DEFINER` Postgres function in the `budget` schema, owned by a non-superuser role (`budget_function_owner`) that has explicit `INSERT/UPDATE/DELETE` grants on the relevant tables. Direct `supabase.from(...).insert/update/delete` calls from the client MUST be rejected by the grant model (continues R10 from Phase 6).
- **FR-026**: Every household-scoped read currently done by `supabase.from(...).select()` from the client MUST also be routed through a `SECURITY DEFINER` RPC (Principle III is non-bypassable; the grant lockdown applies to SELECT too).
- **FR-027**: A household MUST be limited to 2 active (`deleted_at IS NULL`) adults. Both `INSERT`-of-an-adult-into-a-capped-household and `UPDATE`-deleted_at-from-non-null-to-null-on-an-adult-when-capped MUST be rejected at the database layer with `errcode = 'P0001'` and a human-readable message.
- **FR-028**: A household member MUST be soft-deletable (`deleted_at = now()`). Soft-deleted members MUST remain readable for historical attribution (displaying their `display_name` on transactions that reference them) but MUST NOT appear in active-member rosters or income-split calculations.
- **FR-029**: `paid_by_member_id` and `for_member_id` on a transaction MUST belong to the same household as the transaction itself; mismatch MUST be rejected at the database layer by a deferred constraint trigger.
- **FR-030**: A category that has any transactions MUST NOT be deletable (`ON DELETE RESTRICT`). Category deletion only succeeds when zero transactions reference it.
- **FR-031**: Transactions MUST accept a client-supplied `id` (UUID v7 minted in the browser) so that the offline outbox (`lib/pwa/dispatch.ts`, `lib/pwa/outbox.ts`) can replay queued writes idempotently against the table's PK after the device comes back online.
- **FR-032**: Subscriptions MUST auto-materialize transactions via a `pg_cron` schedule (`subscriptions-hourly`, `0 * * * *`). The cron-invoked function MUST be idempotent against re-runs — a unique index on `(subscription_id, occurrence_date)` on `budget.transaction` enforces this physically.
- **FR-033**: The `pg_cron` extension required by FR-032 MUST be installed in the `extensions` schema, not `public`, so that lint `extension_in_public` (closed by T044 in Phase 6) is not re-introduced.
- **FR-034**: Adult members carry a `monthly_income_cents` value. The income-split RPC (`budget.compute_income_split`) MUST return per-adult ratios summing to 1.0 when at least one adult has non-zero income; when all adults have zero income, it MUST return an equal split.
- **FR-035**: Every Phase 7 RPC MUST be defined with `SECURITY DEFINER`, `LANGUAGE plpgsql` (or `sql` where pure), `SET search_path = ''` (every table reference schema-qualified), `OWNER TO budget_function_owner`, and `GRANT EXECUTE TO authenticated`. Functions on the cron path that need to operate across households MAY use `SET LOCAL row_security = off` only in a clearly demarcated branch of the function body; the function comment MUST document this.

### Key Entities *(include if feature involves data)*

- **User**: An individual who can sign in. Identified by a stable internal identifier issued by the authentication provider; carries an email address used as the sign-in handle. Provided by the authentication system; not redefined by this feature.
- **Category**: A user-owned classification used to group transactions (e.g., "Groceries", "Salary"). Attributes: a human-readable name, a kind indicator distinguishing income from expense, and the owning User. Names are unique per user (two users may each have a "Groceries" category; one user cannot have two).
- **Transaction**: A single user-owned monetary event. Attributes: amount, date the event occurred, an optional short description/note, a reference to exactly one Category that belongs to the same User, and the owning User. Deleting a Category that still has Transactions is not allowed (transactions must always belong to a known category).
- **Owner-attributed Record (pattern)**: The generic pattern, instantiated by Category and Transaction in this feature: every domain record references the owning User; ownership is set on creation and is the basis for all access decisions. **Phase 7 supersedes this for household-scoped data**: ownership becomes the calling user's active household membership, not `auth.uid()` directly. See `Household` and `Household Member` below.
- **Household** (Phase 7): A budgeting unit (typically a family). Attributes: a human-readable `name`, a `currency` (CAD by default for v1), an `owner_user_id` reference, and a roster of `Household Member`s. Created by the first signed-in user via US4. All household-scoped data (categories, transactions, subscriptions) lives under exactly one household.
- **Household Member** (Phase 7): A person who belongs to a Household. Attributes: a `role` (`adult` or `kid`), a `display_name`, optional `age_years` (required for kids, forbidden for adults), an optional `user_id` linking to `auth.users` (only set for members who have an account — kids typically don't), `monthly_income_cents` (used by US8 income-split reporting), and `deleted_at` (soft-delete; preserves historical attribution). Adults are capped at 2 active per household.
- **Subscription** (Phase 7): A recurring expense (e.g., Netflix, hydro bill). Attributes: `merchant`, `amount_cents`, `category_id`, `cadence` (weekly/biweekly/monthly/quarterly/yearly), `next_renewal_at`, optional member attributions, `active` flag. The hourly cron job materializes a `Transaction` for every active subscription that has come due, then advances `next_renewal_at`.
- **Category** (Phase 7 supersedes Phase 2): Now household-scoped. System-global seed categories (e.g., "Groceries", "Income") exist as rows with `household_id IS NULL` and are readable by everyone but not directly mutable; per-household overrides happen via clone-on-write.
- **Transaction** (Phase 7 supersedes Phase 2): Now household-scoped, with the full attribute set the app needs: `type` (`expense`|`income`), `amount_cents`, `occurred_on`, `category_id`, `notes`, `paid_by_member_id`, `for_member_id`, `essential_pct`, `split_rule` (for adult-vs-adult attribution), `income_source` (for income transactions), `subscription_id` + `occurrence_date` (for auto-materialized rows).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials can move from the sign-in page to the authenticated home page in under 5 seconds on a normal broadband connection.
- **SC-002**: Across 100 cross-user access attempts (User B querying User A's records by identifier), 0 succeed in returning or modifying data.
- **SC-003**: A returning user with a valid, non-expired session can navigate to any protected page without re-entering credentials in 100% of cases.
- **SC-004**: A new developer following the project README can clone the repo, supply environment variables, have an administrator create their user in the Supabase dashboard, and reach a successful sign-in in under 15 minutes (the administrator step itself takes well under 1 minute and counts toward the 15).
- **SC-005**: 100% of tables created for this app live in the project's dedicated schema (none accidentally created in shared/default schemas).
- **SC-006**: Sign-out fully invalidates the session: after sign-out, 100% of subsequent attempts to access protected pages in the same browser are redirected to sign-in.
- **SC-007**: Phase 7 — Across 100 cross-household access attempts (a member of household B querying household A's transactions/subscriptions/members by identifier), 0 succeed in returning or modifying data.
- **SC-008**: Phase 7 — A subscription with `next_renewal_at = today` is auto-materialized as a transaction within 1 hour of that timestamp 95% of the time (hourly cron with no missed runs).
- **SC-009**: Phase 7 — Inserting a 3rd active adult into a household raises a clear, human-readable error in 100% of attempts (no silent insert, no generic 500).
- **SC-010**: Phase 7 — Every direct `supabase.from('<household-scoped-table>')` call in `app/(app)/**` and `app/(auth)/**` is eliminated; `grep -rn "from('household_member\\|from('transaction\\|from('subscription\\|from('category" app/` returns zero matches.

## Assumptions

- Accounts are provisioned by an administrator through the Supabase dashboard (one administrator action per new user, per environment). This feature does not include public self-signup, password reset, email verification, or social login. (Matches the reference project's surface area.)
- Email + password is the chosen sign-in method. Additional factors (MFA, magic links, SSO) are out of scope.
- The Budget app currently uses a local Supabase stack (`npx supabase start`) per developer. Cloud deployment is deferred until a dedicated paid Supabase project is provisioned for the Budget app in a later feature. The original "shared cloud instance with another app" stance was retracted once we realised that Supabase CLI's migration-tracking table (`supabase_migrations.schema_migrations`) is project-global and cannot be safely shared by two CLI-owning repos. The `budget` schema convention persists in both the local and future-dedicated worlds.
- ~~All Budget domain data is owned by exactly one user; there are no shared/team-owned records in scope for this feature.~~ **Superseded by Phase 7**: household-scoped data is shared across every active member of a household. Direct-user ownership only applies to `auth.users` itself and to the household's `owner_user_id` audit field.
- A first-pass set of budget domain tables is created as part of this feature so that User Story 2 (data isolation) is verified on real domain entities, not a placeholder. The exact entity set is recorded under Key Entities; additional entities can be added by later features.
- The reference project at `~/Projects/daily-learning-worktree/fix-account-access/` is treated as the pattern source for client/server/middleware setup, environment variable naming, and migration conventions. This spec captures the resulting behavior, not the exact code, so future framework or library changes can be absorbed without rewriting the spec.
- Developers running the project locally are responsible for supplying valid credentials for the database/auth instance via environment variables; this feature does not provision the instance itself.
