<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Rationale: MINOR bump — adds the "Commit message quality" rule under
           Development Workflow & Quality Gates. This is materially new
           guidance that constrains automated commit tooling; no principle
           was removed or redefined.

Principles (unchanged):
  - I.   Code Quality & Pattern Consistency
  - II.  Security-First Development (NON-NEGOTIABLE)
  - III. Backend Communication via Database Functions (NON-NEGOTIABLE)
  - IV.  Testing Discipline (Critical-Path Playwright)
  - V.   User Experience Consistency
  - VI.  Performance via NextJS Best Practices

Added in 1.1.0:
  - Development Workflow & Quality Gates → "Commit message quality" bullet

Removed: none

Templates / tooling propagated:
  - ✅ .specify/memory/constitution.md (this file)
  - ✅ .claude/skills/speckit-git-commit/SKILL.md (instructs LLM to inspect
        the diff and compose a descriptive message before committing)
  - ✅ .specify/extensions/git/commands/speckit.git.commit.md (mirrors SKILL.md)
  - ✅ .specify/extensions/git/scripts/bash/auto-commit.sh (accepts optional
        commit-message override as 2nd arg, highest priority)
  - ✅ .specify/extensions/git/scripts/powershell/auto-commit.ps1 (same)
  - ✅ .specify/templates/plan-template.md (no edit needed — Constitution
        Check references constitution generically)
  - ✅ .specify/templates/spec-template.md (no edit needed)
  - ✅ .specify/templates/tasks-template.md (no edit needed)

History:
  - 1.0.0 (2026-05-21): Initial ratification from template. Defined the six
    principles above, the Technology Stack section, the Development Workflow
    & Quality Gates section, and the Governance section.

Follow-up TODOs: none
-->

# Budget Worktree Constitution

## Core Principles

### I. Code Quality & Pattern Consistency

All code MUST be strictly typed; `any`, type assertions to bypass errors, and
suppressed type-checker warnings are prohibited. Patterns MUST remain consistent
across the codebase: when a new pattern, library, or abstraction is about to be
introduced that overlaps with an existing one (e.g., a second state-management
library, a second HTTP client, a second styling system), implementation MUST
pause and a clarification request MUST be raised before proceeding. Redux
Toolkit is the single sanctioned state-management library; alternatives require
amendment of this constitution. Components with any reuse potential MUST be
extracted into a shared components location rather than duplicated inline.
Comments MUST be reserved for business rationale or non-obvious gotchas; they
MUST NOT narrate what the code already says.

**Rationale**: Drift between patterns causes cognitive overhead, hidden bugs,
and bloated bundles. Mandatory clarification on new patterns prevents silent
fragmentation of the codebase.

### II. Security-First Development (NON-NEGOTIABLE)

Security takes precedence over convenience. All Supabase tables MUST have Row
Level Security (RLS) enabled with explicit policies enforcing least privilege;
tables without policies MUST NOT ship. Inline scripts and styles MUST use a
nonce-based Content Security Policy as recommended by NextJS. Secrets,
credentials, service-role keys, and `.env` files MUST NEVER be committed,
logged, exposed to the client, or read by tooling. Any change that could relax
the security posture (disabling RLS, widening CORS, exposing privileged keys,
bypassing auth, introducing `dangerouslySetInnerHTML`, adding open redirects,
weakening CSP) MUST trigger an explicit clarification request and receive
written approval before implementation. Server actions and API entry points
MUST validate inputs and enforce auth/authorization at the boundary.

**Rationale**: Security regressions are expensive to detect and catastrophic to
exploit. Forcing an explicit pause on security-impacting changes ensures
informed trade-offs rather than accidental exposure.

### III. Backend Communication via Database Functions (NON-NEGOTIABLE)

Client-to-backend communication MUST use Supabase RPC calls invoking PostgreSQL
functions. Ad-hoc REST/Route Handlers for business operations are prohibited
unless the operation cannot be expressed in the database (e.g., third-party
webhooks, file streaming) and the exception is documented in the plan.
Multi-table writes, business rules, and authorization-sensitive reads MUST live
in database functions with appropriate `SECURITY DEFINER` / `SECURITY INVOKER`
choice and transaction boundaries. RLS policies remain the authoritative
authorization layer for direct table access; database functions MUST NOT bypass
RLS without justification recorded in the plan.

**Rationale**: Centralizing logic in the database keeps authorization,
transactions, and validation co-located with the data, reduces round trips, and
removes a class of REST-layer bugs.

### IV. Testing Discipline (Critical-Path Playwright)

Playwright tests MUST cover critical user flows: authentication, primary
transactional flows (e.g., budget creation, money movement, settings that
affect billing or access), and any flow whose failure would block users from
core value. Critical flows without a passing Playwright test MUST NOT ship to
production. Broad E2E coverage of secondary paths is discouraged; non-critical
behavior MUST be covered by unit or integration tests instead. The set of
"critical flows" is enumerated in each feature's plan and reviewed at the
Constitution Check gate.

**Rationale**: E2E suites that grow uncritically become flaky and slow.
Constraining Playwright to critical paths preserves signal where it matters and
keeps CI fast enough to trust.

### V. User Experience Consistency

The NextJS App Router is the only sanctioned routing model; the Pages Router
MUST NOT be introduced. Shared layouts MUST be used for cross-route UI
scaffolding (navigation, auth gates, error and loading boundaries). Reusable
UI primitives (buttons, inputs, modals, forms, toasts, skeletons, empty states,
error states) MUST live in a shared components location and be reused across
features; visual or behavioral divergence requires written justification in the
plan. New UI patterns that overlap an existing one MUST trigger a clarification
request before introduction.

**Rationale**: A consistent UI is faster to build, easier to test, and feels
more trustworthy to users. Forcing reuse prevents N variants of the same modal
from accumulating.

### VI. Performance via NextJS Best Practices

Server Components are the default; components MUST be marked `"use client"`
only when interaction state, browser-only APIs, or event handlers require it.
Server Actions are preferred over client-side fetch for mutations. Static
rendering and caching MUST be used where data freshness permits; revalidation
strategy (time-based, on-demand, or dynamic) MUST be explicit in the plan when
non-default. Bundle-size impact MUST be evaluated before adding a new
client-side dependency; lighter alternatives MUST be preferred when
functionally equivalent. Images MUST go through `next/image` and fonts through
`next/font`.

**Rationale**: NextJS performance wins come from disciplined adoption of its
primitives. Treating client components and large dependencies as opt-in keeps
the app fast by default.

## Technology Stack & Architectural Constraints

The following stack is normative for this project. Substitutions require a
constitution amendment:

- **Framework**: NextJS with the App Router (server components by default,
  server actions for mutations, nonce-based CSP for inline scripts/styles).
  This codebase uses a version of NextJS that may differ from older training
  data — consult `node_modules/next/dist/docs/` before writing framework code.
- **Backend**: Supabase (PostgreSQL). All client-backend communication uses
  RPC into PostgreSQL functions. RLS is enabled on every table.
- **State management**: Redux Toolkit. No competing global state libraries.
- **End-to-end testing**: Playwright, scoped to critical flows.
- **Reusable UI**: a single shared components location; no duplicated primitives.

## Development Workflow & Quality Gates

- **Constitution Check** is the first gate in every implementation plan and is
  re-checked after design. Violations MUST be either resolved or recorded in
  the plan's Complexity Tracking with explicit justification.
- **New-pattern clarification**: introducing a new library, abstraction, or UI
  pattern that overlaps with an existing one requires raising a clarification
  before implementation begins.
- **Security clarification**: any change with a plausible security impact (RLS
  changes, auth changes, CSP relaxation, key exposure surface) requires an
  explicit clarification and written approval.
- **Critical-flow Playwright**: each feature plan enumerates which flows it
  introduces or touches; new critical flows ship with passing Playwright
  coverage.
- **Type discipline**: type errors and `any` are blocking. CI MUST fail on
  either.
- **No unsolicited commits**: automated tooling MUST NOT create git commits
  unless explicitly requested.
- **Commit message quality**: When `/speckit-git-commit` or any other
  automated commit pathway runs, the message MUST be a concise, change-
  specific description: imperative verb (Add/Update/Fix/Remove/Refactor/
  Document/Rename/Move) followed by the affected feature, file area, or
  concept (e.g., `Add login server action with rate-limit guard`). First
  line stays under ~70 characters; a body is added only when WHY is non-
  obvious. Generic placeholders such as `[Spec Kit] Auto-commit after X`,
  `WIP`, `update files`, `misc changes`, or `progress` are NOT acceptable.
  If the change set is too varied to summarize honestly in one line, split
  into multiple commits.

## Governance

This constitution supersedes ad-hoc practices and informal conventions. When
guidance elsewhere conflicts with this document, this document wins — except
where the user's direct, explicit instructions override (see CLAUDE.md /
AGENTS.md instruction-priority rules).

Amendments MUST:

1. Be proposed with a written rationale and a list of impacted templates,
   docs, and runtime guidance files.
2. Be applied via the `/speckit-constitution` workflow so the Sync Impact
   Report and version bump are recorded.
3. Follow semantic versioning:
   - **MAJOR**: backward-incompatible governance changes or principle removals/
     redefinitions.
   - **MINOR**: new principles or materially expanded guidance.
   - **PATCH**: clarifications, wording, and non-semantic refinements.

Every PR and implementation plan MUST verify compliance with these principles.
Complexity that violates a principle MUST be justified in writing or refactored
away. Agent-facing runtime guidance lives in `AGENTS.md` and `CLAUDE.md` and
MUST stay aligned with this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-05-21 | **Last Amended**: 2026-05-21
