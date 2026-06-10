# Feature Specification: Switch Backend from Supabase to Firebase / Firestore

**Feature Branch**: `002-switch-to-firebase`
**Created**: 2026-05-31
**Status**: Draft
**Input**: User description: "Update to use firebase and firestore instead of supabase. List all of the firebase and firestore features that are going to be useful for this app and clarify with me if I should use those features."

## Clarifications

### Session 2026-05-31

- Q: Which authentication features should the new auth provider expose in this feature? → A: **Email + password only**, with accounts provisioned out-of-band by an administrator in the Firebase console. No public signup, no password reset UI, no social providers, no MFA. (Same surface area as the Supabase-based 001 feature.)
- Q: How should backend writes be gated, given the constitution's "Backend via DB Functions" principle? → A: **All writes go through Callable Cloud Functions.** No direct client writes to Firestore. This is the Firebase analog of the SECURITY DEFINER RPC pattern from the Supabase version (`budget_function_owner`, ~25 RPCs).
- Q: How should recurring subscriptions be handled? → A: **Subscriptions are labels/metadata only.** No auto-materialization, no cron job, no scheduled functions. A subscription is a record of a recurring expense the user has, used as a tag/reference when manually logging a transaction. This removes the original US7, FR-032, FR-033, and SC-008.
- Q: Which optional Firebase products should ship in this feature? → A: **None.** Minimal scope: only Firebase Authentication, Cloud Firestore (+ Security Rules), Firebase Admin SDK, Callable Cloud Functions, and the Firebase Local Emulator Suite are in scope. App Check, Performance Monitoring, Analytics, Hosting, FCM, Storage, Remote Config, BigQuery export, and Extensions are deferred to later features.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Returning user signs in to access the Budget app (Priority: P1)

A user with an existing account opens the Budget app, is prompted to sign in with email and password, and on success lands on the authenticated home page where their budget workspace lives. Without a valid session, every non-login page redirects them back to the sign-in screen.

**Why this priority**: Until authentication works end-to-end on the new auth provider, no other feature can function for real users. Replacing Supabase Auth with Firebase Authentication is the foundational unlock for everything else in this migration.

**Independent Test**: With a pre-provisioned Firebase account (created by the administrator in the Firebase console), visit any app URL, get redirected to the sign-in page, submit valid credentials, and confirm you land on the authenticated home page. Visiting the app again in a new tab keeps the session active without re-entering credentials.

**Acceptance Scenarios**:

1. **Given** a visitor with no active session, **When** they visit any in-app URL, **Then** they are redirected to the sign-in page.
2. **Given** the sign-in page is shown, **When** the user submits valid email and password, **Then** they are redirected to the authenticated home page and remain signed in across navigation and reloads.
3. **Given** the sign-in page is shown, **When** the user submits invalid credentials, **Then** they stay on the sign-in page and see a clear error message.
4. **Given** a user with an active session, **When** they revisit the sign-in page directly, **Then** the application treats them as authenticated and does not require re-entry of credentials.

---

### User Story 2 - Signed-in user only sees their own household's data (Priority: P1)

Each signed-in user can only read, create, update, or delete records that belong to a household they are an active member of. A user from a different household cannot see or alter the first household's records, even if they guess identifiers.

**Why this priority**: A multi-tenant budget app where one household can see another household's finances is a non-starter. Data isolation must be in place before any budget data is stored or displayed; retrofitting isolation later is risky and expensive. This requirement is unchanged from the Supabase version — only the enforcement mechanism (Firestore Security Rules + Callable Function authorization checks) differs.

**Independent Test**: Provision two test accounts in two separate households. Create a transaction while signed in as a member of Household A. Sign in as a member of Household B in a separate session and confirm none of Household A's records appear in any listing, direct lookups by identifier return nothing, and write attempts targeting Household A's records are rejected.

**Acceptance Scenarios**:

1. **Given** members of two distinct households, **When** each lists their household's records, **Then** each member sees only the records belonging to their own household.
2. **Given** Household A owns a record, **When** a member of Household B attempts to read, update, or delete that record by its identifier, **Then** the operation returns no data or is rejected.
3. **Given** any signed-in household member creates a new record, **When** the record is persisted, **Then** ownership (household identifier) is automatically attributed by the server without the client supplying it.

---

### User Story 3 - Signed-in user signs out (Priority: P2)

A signed-in user can explicitly end their session. After signing out, the app behaves as it does for any unauthenticated visitor — they are sent back to the sign-in page, and protected URLs are no longer accessible from that browser.

**Why this priority**: Sign-out is required for shared devices and for a complete authentication loop. Ships immediately after sign-in/isolation are in place.

**Independent Test**: As a signed-in user, trigger sign-out. Confirm the session is terminated (both the client SDK state and the server-verifiable session cookie) and that revisiting any protected URL redirects to the sign-in page.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they activate the sign-out control in the app shell header, **Then** their session ends and they are redirected to the sign-in page.
2. **Given** a user has signed out, **When** they revisit any protected URL in the same browser, **Then** they are redirected to the sign-in page.
3. **Given** a signed-in user is on any protected page, **When** the page renders, **Then** the app shell shows their email address and the sign-out control.

---

### User Story 4 - First-time signed-in user creates a household (Priority: P1)

A signed-in user who isn't a member of any household lands on an onboarding screen. They submit a household name and become its first adult member. After creation they reach the dashboard, which renders for the household they just made.

**Why this priority**: Every household-scoped feature (transactions, family, subscriptions-as-labels, reports, settings) needs a household to exist. Without onboarding, a signed-in user has nowhere to send writes.

**Independent Test**: Sign in as a brand-new user (no household membership). Confirm landing on `/onboarding/create-household`. Submit a household name. Confirm redirect to `/dashboard` and that `/family` lists the calling user as the sole adult member.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no household membership, **When** they visit any in-app URL other than `/onboarding/create-household`, **Then** they are redirected to that onboarding page.
2. **Given** the onboarding page, **When** the user submits a non-empty household name, **Then** a household is created with them as the first adult, and they land on `/dashboard`.
3. **Given** a user already in a household, **When** they visit `/onboarding/create-household`, **Then** they are redirected to `/dashboard` (onboarding is one-shot).

---

### User Story 5 - Adults manage household members (Priority: P1)

A household adult adds the second adult (by their existing account email) or any number of kids (display name + age). They can update an adult's monthly income or soft-delete any member. The system rejects a 3rd active adult.

**Why this priority**: Multi-adult households are the primary use case ("family budget"). The adult cap and member roster drive the income split, per-kid reporting, and transaction attribution that every later page surfaces.

**Independent Test**: As a household adult, add a second adult by email (assumes their account exists in Firebase Authentication). Add a kid. Update an adult's income. Soft-delete the kid. Attempt to add a 3rd adult; confirm rejection with a clear error message.

**Acceptance Scenarios**:

1. **Given** a household with one adult, **When** that adult adds a second adult by an email that exists in Firebase Authentication, **Then** that user appears in the family roster as `adult`.
2. **Given** a household with two active adults, **When** an adult tries to add a 3rd adult, **Then** the operation is rejected by the server and the error surfaces to the UI.
3. **Given** a household member, **When** an adult soft-deletes them, **Then** they no longer appear in active rosters but historical transactions still resolve their display name.

---

### User Story 6 - Household members log and review transactions (Priority: P1)

Any active household member logs an expense or income transaction (amount, category, date, optional note, optional member attribution, optional subscription label). Listed transactions are filterable by member, essential-or-treat, date range, and free-text search. Edits and deletes are allowed for any member.

**Why this priority**: Recording and reviewing money flow is the core value proposition. Without this, the dashboard and reports have nothing to summarize.

**Independent Test**: As an adult, log an expense in category "Groceries" for $50. Confirm it appears in `/transactions` and is reflected in `/dashboard` totals. Filter by member; confirm the row is included or excluded correctly. Edit the amount and confirm the change persists. Delete and confirm it's gone. Log another expense and attach a subscription label; confirm the label is visible on the transaction.

**Acceptance Scenarios**:

1. **Given** a household with at least one category, **When** any member submits a "log expense" payload through the appropriate server-side function, **Then** a transaction record is created scoped to that household, and `/dashboard` + `/transactions` reflect it on next render.
2. **Given** a transaction owned by a household, **When** any household member edits its amount, notes, essential percentage, or date, **Then** the change is persisted and visible to every other member of the household.
3. **Given** a transaction, **When** a household member deletes it, **Then** it no longer appears in any household-scoped listing.
4. **Given** a member of household A, **When** they attempt to read or modify a transaction belonging to household B, **Then** the operation returns no data or is rejected.
5. **Given** a household has registered subscriptions (see US7), **When** a member logs a transaction, **Then** they can optionally attach a subscription label to it, and the transaction listing surfaces that label.

---

### User Story 7 - Household members register subscriptions as recurring-expense labels (Priority: P2)

A household member registers a recurring subscription (merchant, amount, category, cadence, expected next date). The subscription is stored as a **label/reference only** — it does **not** automatically create transactions. When a member logs a transaction for that recurring expense (manually, e.g., when they see the charge on their bank statement), they can optionally attach the subscription label to the transaction for tracking and reporting purposes.

**Why this priority**: Subscriptions exist primarily so the household can see "what recurring expenses do we have?" and so reports can attribute logged transactions to those recurring sources. Auto-materialization (which was US7 in the Supabase version) is explicitly out of scope per the Clarifications session — this avoids the need for any scheduled/cron infrastructure.

**Independent Test**: Register a subscription with merchant "Netflix", amount $20, cadence monthly. Confirm it appears in `/subscriptions`. Confirm that no transactions are automatically created for it (zero side effects on the transaction collection). Log a manual expense and attach the Netflix subscription label; confirm the label appears on the transaction in listings.

**Acceptance Scenarios**:

1. **Given** a household member registers a subscription, **When** the registration completes, **Then** the subscription appears in the household's subscription list and **no** transaction is created as a side effect.
2. **Given** an active subscription exists, **When** time passes (hours, days, the expected next date arrives, or it passes), **Then** **no** transaction is auto-created. The subscription's stored "expected next date" may be updated by the user but is never advanced automatically by the system.
3. **Given** a subscription exists, **When** a member logs a manual transaction, **Then** they may optionally select that subscription as a label, and the resulting transaction record carries the subscription reference.
4. **Given** a subscription is paused or deleted, **When** members view the subscription list, **Then** the paused/deleted subscription does not appear in active rosters but its label remains resolvable on historical transactions that reference it.

---

### User Story 8 - Household sees aggregated reports and dashboard (Priority: P2)

The dashboard shows left-to-spend, monthly income/expense, essential-vs-treats split, and recent activity. Report pages drill down: cashflow KPIs, essentials breakdown, spend over time, per-person breakdown, per-category budget progress.

**Why this priority**: Reporting is the second-order benefit of logging transactions. Ships immediately after US6.

**Independent Test**: With seeded transactions in a household, visit `/dashboard`, `/budget`, `/reports/cashflow`, `/reports/essentials`, `/reports/spend-over-time`, `/reports/per-person`. Confirm each page returns numbers consistent with the underlying transactions.

**Acceptance Scenarios**:

1. **Given** a household with month-to-date transactions, **When** any member visits `/dashboard`, **Then** the displayed totals (income, expense, left to spend, essential/treats split) match the sum over the underlying transactions for that month.
2. **Given** category budgets set for the current month, **When** a member visits `/budget`, **Then** each category shows its monthly budget and the actual spend.
3. **Given** member-attributed transactions, **When** a member visits `/reports/per-person`, **Then** spend per member is correctly partitioned.
4. **Given** transactions tagged with a subscription label, **When** a member views the essentials breakdown, **Then** subscription-tagged transactions are correctly categorized in essentials vs treats based on each transaction's `essential_pct`.

---

### Edge Cases

- A user's session token expires while they are using the app: the next protected request must transparently refresh the session if possible, and otherwise redirect to sign-in without losing form input ungracefully.
- The authentication provider is temporarily unreachable when the user signs in: the sign-in page must show a non-cryptic error and allow the user to retry rather than appearing broken.
- A user has multiple tabs open and signs out in one of them: protected requests from the other tabs must redirect to sign-in on next interaction.
- A user manually navigates directly to the sign-in URL while already signed in: the app should not error; treating them as still authenticated is acceptable.
- A user attempts to submit the sign-in form with an empty email or password: the form must prevent submission and surface a clear validation message.
- A Callable Cloud Function rejects a write because of an integrity violation (e.g., 3rd adult, mismatched household reference on transaction): the UI must surface the server-supplied error message verbatim and the client cache must not optimistically retain the rejected write.
- The user goes offline and queues writes; the device returns online and replays them: queued writes must replay idempotently against the server (see FR-029 on client-supplied IDs and the NEEDS CLARIFICATION below regarding the queueing layer's interaction with Callable Functions).
- A user is removed from a household (soft-deleted as a member): subsequent reads against that household's data must be rejected by the server even if the client still holds a cached membership.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & session

- **FR-001**: The app MUST require an authenticated session to access any page outside the sign-in flow and any non-public asset.
- **FR-002**: The app MUST provide a sign-in page that accepts an email address and password and submits them to Firebase Authentication.
- **FR-003**: On successful authentication, the app MUST establish a server-verifiable session (a Firebase session cookie minted via the Firebase Admin SDK on the server) that persists across page navigations and browser reloads until it is explicitly ended or expires.
- **FR-004**: On submission of invalid credentials, the app MUST keep the user on the sign-in page and display a human-readable error.
- **FR-005**: The app MUST refresh or revalidate the session on the server for protected requests, so that a working but stale session does not force re-authentication.
- **FR-006**: The app MUST provide a way for a signed-in user to end their session ("sign out"), which MUST revoke both the client-side Firebase Authentication state and the server-side session cookie, after which the user is returned to the sign-in page.
- **FR-007**: The app MUST resolve the current user on the server (via the verified session cookie + Firebase Admin SDK) for every protected page so that page output reflects that specific user's data.

#### Data ownership & isolation

- **FR-008**: Every household-scoped record (categories, transactions, subscriptions, household members) MUST carry a household identifier referencing the household it belongs to.
- **FR-009**: When a signed-in user creates a household-scoped record, the server MUST automatically attribute the household identifier from the caller's active household membership without requiring the client to pass it.
- **FR-010**: The data layer MUST enforce, at the server boundary (Cloud Functions for writes; Firestore Security Rules for reads), that a user can only read, insert, update, or delete records belonging to a household they are an active member of. Client-side filtering alone is not sufficient.

#### Schema, configuration, and developer setup

- **FR-011**: The Firestore data model (collection structure, indexes, security rules) MUST be version-controlled in the repository and applied in a reproducible order, so that the data layer can be recreated from scratch on any environment (local emulator or cloud project).
- **FR-012**: Required configuration (Firebase project identifier, web API key, and any other public client config) MUST be supplied via environment variables. Private credentials used by the Firebase Admin SDK on the server (the service account JSON or its individual fields) MUST also be supplied via environment variables and MUST never be committed to the repository.
- **FR-012a**: Initialization scripts, security rules, and Cloud Function code MUST NOT contain hardcoded user identifiers, email addresses, or passwords. Per-environment users are created by an administrator out-of-band (in the Firebase console for each environment) and resolve themselves at runtime via the authenticated session.
- **FR-013**: [NEEDS CLARIFICATION: the Supabase version constrained all tables/functions to the `budget` Postgres schema. Firestore has no schemas. Which equivalent should this feature adopt — (a) a dedicated **named Firestore database** (e.g., `budget`) inside the Firebase project so the default database is left untouched, or (b) a **top-level collection-prefix convention** (`budget_household`, `budget_transaction`, …) inside the default database? Both work; (a) is cleaner namespace isolation if/when the Firebase project hosts other apps, (b) is simpler for a Firebase project dedicated to this app.]
- **FR-014**: A developer setting up the project MUST be able to install dependencies, start the Firebase Local Emulator Suite, and start the app such that the sign-in flow is reachable without manual edits beyond providing environment variables.

#### Backend gating (Principle III analog)

- **FR-015**: Every household-scoped write — including the create-household call itself — MUST go through a Callable Cloud Function that verifies the caller's session, validates the payload, enforces business rules (adult cap, household membership, FK-equivalent references), and performs the write using the Firebase Admin SDK. Direct client SDK writes to Firestore against household-scoped collections MUST be rejected by Firestore Security Rules.
- **FR-016**: Every household-scoped read currently done by direct client SDK queries from the browser MUST also go through Callable Cloud Functions, OR be permitted by Firestore Security Rules that constrain the query to the caller's active household memberships. Reads MUST NEVER return data from a household the caller does not belong to.
- **FR-017**: Callable Cloud Functions MUST verify the caller's session on every invocation, derive the caller's household membership from the server-side data (not from client-supplied claims), and reject any request that asserts a household identity the caller does not hold.

#### Household and member model

- **FR-018**: A signed-in user with no household membership MUST be redirected to `/onboarding/create-household`; every other in-app route is unreachable until they create or are added to a household.
- **FR-019**: Creating a household MUST atomically (a) create the household record, (b) create the calling user as a `role='adult'` member with their authenticated user identifier, and (c) return the new household identifier so the caller can redirect to it. "Atomically" here means within a single Firestore transaction or batched write, such that no partial state is observable.
- **FR-019a**: The first-adult member's `display_name` MUST be derived from Firebase Authentication for the calling user, preferring the `displayName` field over the email local-part, with `'Adult'` as the final fallback.
- **FR-020**: Categories, transactions, and subscriptions MUST be household-scoped: every record carries a household identifier and access is restricted to active members of that household.
- **FR-021**: System-global seed categories (e.g., "Groceries", "Income") MUST exist as records readable by every authenticated user, owned by a sentinel "system" household identifier (or equivalent marker). Per-household overrides are written by cloning a system-global category into a household-scoped category before mutation.
- **FR-022**: A household MUST be limited to 2 active (non-soft-deleted) adults. Both adding a new adult to a capped household and restoring (un-soft-deleting) an adult that would push the count above 2 MUST be rejected by the relevant Callable Cloud Function with a human-readable error message.
- **FR-023**: A household member MUST be soft-deletable. Soft-deleted members MUST remain readable for historical attribution (displaying their `display_name` on transactions that reference them) but MUST NOT appear in active-member rosters or income-split calculations.
- **FR-024**: On a transaction, `paid_by_member_id` and `for_member_id` MUST belong to the same household as the transaction itself; mismatch MUST be rejected by the responsible Callable Cloud Function before the write.
- **FR-025**: A category that has any transactions MUST NOT be deletable. Category deletion only succeeds when zero transactions reference it; the Callable Cloud Function MUST perform this check inside a Firestore transaction.

#### Subscriptions as labels (changed from the Supabase version)

- **FR-026**: Subscriptions MUST exist purely as labels/metadata recording recurring expenses a household has. Registering, updating, pausing, or deleting a subscription MUST NOT cause any transaction to be created, modified, or deleted as a side effect.
- **FR-027**: A transaction MAY optionally reference a subscription label belonging to the same household. If referenced, the subscription's identifier is stored on the transaction record. Subscriptions MUST NOT be in any "scheduled" or "due" state from the system's perspective — only the user logs transactions; the system never does.
- **FR-028**: Removing or pausing a subscription MUST NOT alter or detach existing subscription references on historical transactions. The reference resolves to the (possibly paused or soft-deleted) subscription record for label display purposes.

#### Offline / client-supplied IDs

- **FR-029**: Transactions MUST accept a client-supplied `id` (UUID v7 minted in the browser) so that queued writes can be replayed idempotently against the data store after the device comes back online. The Callable Cloud Function that creates a transaction MUST treat a repeated invocation with the same `id` as a no-op (returning the existing record) rather than creating a duplicate.
- **FR-030**: [NEEDS CLARIFICATION: with all writes going through Callable Cloud Functions (per FR-015), Firestore's built-in offline persistence (which queues *direct* Firestore writes) does not automatically queue *function calls* while the device is offline. Options: (a) keep the existing custom PWA outbox (`lib/pwa/dispatch.ts`, `lib/pwa/outbox.ts`) and retarget it to queue Callable Function invocations; (b) drop the custom outbox and accept that the app does not work offline for writes (read-only offline via Firestore cache); (c) use Firestore offline persistence for a small, pre-approved set of writes that have simple Security Rules (e.g., transaction logging) and route only complex operations through Cloud Functions. The choice impacts US6 acceptance scenarios and the offline behaviour described in Edge Cases.]

### Key Entities *(include if feature involves data)*

- **User**: An individual who can sign in. Identified by a Firebase Authentication UID (a stable internal identifier issued by Firebase Authentication); carries an email address used as the sign-in handle and an optional `displayName`. Provided by Firebase Authentication; not redefined by this feature.
- **Household**: A budgeting unit (typically a family). Attributes: a human-readable `name`, a `currency` (CAD by default for v1), an `owner_user_id` reference (the user who created it), and a roster of `Household Member`s. Created by the first signed-in user via US4. All household-scoped data lives under exactly one household.
- **Household Member**: A person who belongs to a Household. Attributes: a `role` (`adult` or `kid`), a `display_name`, optional `age_years` (required for kids, forbidden for adults), an optional `user_id` linking to a Firebase Authentication user (only set for members who have an account — kids typically don't), `monthly_income_cents` (used by US8 income-split reporting), and a `deleted_at` field for soft-delete (preserves historical attribution). Adults are capped at 2 active per household.
- **Category**: A household-scoped classification used to group transactions (e.g., "Groceries", "Salary"). Attributes: a human-readable `name`, a `kind` indicator distinguishing income from expense, an `essential_pct` (used by reports), an optional `monthly_budget_cents`, and the owning household identifier. System-global seed categories exist with a sentinel household identifier and are readable by all users; per-household overrides clone them.
- **Transaction**: A single household-scoped monetary event. Attributes: client-supplied `id` (UUID v7), `type` (`expense` or `income`), `amount_cents`, `occurred_on` date, optional `notes`, a reference to one `Category` belonging to the same household, optional `paid_by_member_id` and `for_member_id` (both must belong to the same household), an `essential_pct` (defaulting from the category), an optional `subscription_id` label reference, and the owning household identifier.
- **Subscription**: A household-scoped label representing a recurring expense (e.g., Netflix, hydro). Attributes: `merchant`, `amount_cents` (expected amount), `category_id` reference, `cadence` (weekly, biweekly, monthly, quarterly, yearly — informational only), `expected_next_date` (informational only — never advanced by the system), optional member attributions for reporting, an `active` flag (paused vs active), and the owning household identifier. Subscriptions never cause transactions to be created; they are referenced by transactions a user manually logs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials can move from the sign-in page to the authenticated home page in under 5 seconds on a normal broadband connection.
- **SC-002**: Across 100 cross-household access attempts (a member of household B querying household A's records by identifier through any client path — direct Firestore client SDK or Callable Cloud Function), 0 succeed in returning or modifying data.
- **SC-003**: A returning user with a valid, non-expired session can navigate to any protected page without re-entering credentials in 100% of cases.
- **SC-004**: A new developer following the project README can clone the repo, install dependencies, supply environment variables, start the Firebase Local Emulator Suite, have an administrator create their user in Firebase Authentication, and reach a successful sign-in in under 15 minutes.
- **SC-005**: 100% of household-scoped client write attempts that bypass Callable Cloud Functions (i.e., direct `db.collection(...).add(...)` or equivalent from the browser) are rejected by Firestore Security Rules.
- **SC-006**: Sign-out fully invalidates the session: after sign-out, 100% of subsequent attempts to access protected pages in the same browser are redirected to sign-in, and the server-side session cookie is unusable on subsequent requests even if replayed.
- **SC-007**: Inserting a 3rd active adult into a household raises a clear, human-readable error in 100% of attempts (no silent insert, no generic 500 from the Callable Cloud Function).
- **SC-008**: Registering, updating, pausing, or deleting a subscription produces exactly 0 side-effect changes on the household's transaction collection in 100% of attempts (verified by snapshotting the transaction collection before and after each subscription operation).
- **SC-009**: An offline transaction logged on a device that subsequently comes online appears exactly once on the server in 100% of replay attempts (idempotency via FR-029 client-supplied IDs), regardless of how many times the replay layer retries.

## Assumptions

- Accounts are provisioned by an administrator through the Firebase console (one administrator action per new user, per Firebase project / environment). This feature does not include public self-signup, password reset, email verification, or social login. Same surface area as the Supabase-based 001 feature.
- Email + password is the only sign-in method. Additional factors (MFA, magic links, OAuth providers) are explicitly out of scope per the Clarifications.
- The Budget app will run against the Firebase Local Emulator Suite per developer for local development (Auth + Firestore + Functions emulators). A dedicated Firebase project (with billing enabled — Callable Cloud Functions require the Blaze plan in cloud) will be created for the cloud target in a later feature.
- Firestore (not Firebase Realtime Database) is the chosen data store: better querying, transactions, security rules, and scaling story for the household-scoped relational data this app stores.
- All household-scoped data writes go through Callable Cloud Functions, per the Clarifications. This means the constitution's Principle III ("Backend via DB Functions") is preserved in spirit: a single server-side validation path gates every mutation. The "DB function" wording in Principle III is interpreted as "a server-side function that owns the write path", whether implemented as a Postgres SECURITY DEFINER function or as a Callable Cloud Function.
- Subscriptions are labels only (per Clarifications). The Supabase version's US7, FR-032, FR-033, SC-008 (auto-materialization, pg_cron, idempotency-on-cron-replay) are explicitly retracted. The new SC-008 confirms no side effects.
- No optional Firebase products are in scope (per Clarifications). App Check, Performance Monitoring, Analytics, Hosting, FCM, Storage, Remote Config, BigQuery export, and Firebase Extensions are deferred to later features.
- The Next.js framework, App Router, Server Actions, route groups, and PWA infrastructure (service worker, manifest, offline outbox depending on FR-030 resolution) carry over from the Supabase version. Only the data and auth layers change.
- Historical Supabase artifacts (the `001-setup-supabase` migrations, the `supabase/` directory, `@supabase/*` dependencies, references to `auth.uid()`, RLS test SQL, SECURITY DEFINER RPCs) will be removed or rewritten as part of this feature's implementation. The implementation plan (see `/speckit-plan`) will enumerate the deletions and rewrites; this spec only captures the resulting behaviour.
- The existing aggregation/reporting requirements (US8) are preserved as user-facing requirements, but the implementation strategy (SQL `GROUP BY` versus client-side aggregation versus precomputed summary documents versus Firestore aggregation queries) is deferred to the implementation plan.
