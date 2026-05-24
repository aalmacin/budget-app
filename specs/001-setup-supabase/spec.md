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

### Key Entities *(include if feature involves data)*

- **User**: An individual who can sign in. Identified by a stable internal identifier issued by the authentication provider; carries an email address used as the sign-in handle. Provided by the authentication system; not redefined by this feature.
- **Category**: A user-owned classification used to group transactions (e.g., "Groceries", "Salary"). Attributes: a human-readable name, a kind indicator distinguishing income from expense, and the owning User. Names are unique per user (two users may each have a "Groceries" category; one user cannot have two).
- **Transaction**: A single user-owned monetary event. Attributes: amount, date the event occurred, an optional short description/note, a reference to exactly one Category that belongs to the same User, and the owning User. Deleting a Category that still has Transactions is not allowed (transactions must always belong to a known category).
- **Owner-attributed Record (pattern)**: The generic pattern, instantiated by Category and Transaction in this feature: every domain record references the owning User; ownership is set on creation and is the basis for all access decisions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with valid credentials can move from the sign-in page to the authenticated home page in under 5 seconds on a normal broadband connection.
- **SC-002**: Across 100 cross-user access attempts (User B querying User A's records by identifier), 0 succeed in returning or modifying data.
- **SC-003**: A returning user with a valid, non-expired session can navigate to any protected page without re-entering credentials in 100% of cases.
- **SC-004**: A new developer following the project README can clone the repo, supply environment variables, have an administrator create their user in the Supabase dashboard, and reach a successful sign-in in under 15 minutes (the administrator step itself takes well under 1 minute and counts toward the 15).
- **SC-005**: 100% of tables created for this app live in the project's dedicated schema (none accidentally created in shared/default schemas).
- **SC-006**: Sign-out fully invalidates the session: after sign-out, 100% of subsequent attempts to access protected pages in the same browser are redirected to sign-in.

## Assumptions

- Accounts are provisioned by an administrator through the Supabase dashboard (one administrator action per new user, per environment). This feature does not include public self-signup, password reset, email verification, or social login. (Matches the reference project's surface area.)
- Email + password is the chosen sign-in method. Additional factors (MFA, magic links, SSO) are out of scope.
- The Budget app currently uses a local Supabase stack (`npx supabase start`) per developer. Cloud deployment is deferred until a dedicated paid Supabase project is provisioned for the Budget app in a later feature. The original "shared cloud instance with another app" stance was retracted once we realised that Supabase CLI's migration-tracking table (`supabase_migrations.schema_migrations`) is project-global and cannot be safely shared by two CLI-owning repos. The `budget` schema convention persists in both the local and future-dedicated worlds.
- All Budget domain data is owned by exactly one user; there are no shared/team-owned records in scope for this feature.
- A first-pass set of budget domain tables is created as part of this feature so that User Story 2 (data isolation) is verified on real domain entities, not a placeholder. The exact entity set is recorded under Key Entities; additional entities can be added by later features.
- The reference project at `~/Projects/daily-learning-worktree/fix-account-access/` is treated as the pattern source for client/server/middleware setup, environment variable naming, and migration conventions. This spec captures the resulting behavior, not the exact code, so future framework or library changes can be absorbed without rewriting the spec.
- Developers running the project locally are responsible for supplying valid credentials for the database/auth instance via environment variables; this feature does not provision the instance itself.
