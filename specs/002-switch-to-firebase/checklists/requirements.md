# Specification Quality Checklist: Switch Backend from Supabase to Firebase / Firestore

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-05-31
**Feature**: [Link to spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

> Note: This spec explicitly names Firebase, Firestore, Firebase Authentication, Callable Cloud Functions, Firebase Admin SDK, and the Firebase Local Emulator Suite. This is intentional and was directly requested by the user ("Update to use firebase and firestore instead of supabase. List all of the firebase and firestore features…"). The platform choice itself **is** the feature, so naming the products is appropriate at the spec level. Lower-level implementation details (collection schemas, exact rule expressions, function names, deployment topology) remain in the plan.

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

> 2 `[NEEDS CLARIFICATION]` markers remain (FR-013 — Firestore namespace convention; FR-030 — offline outbox interaction with Callable Functions). Both are flagged as critical decisions with multiple reasonable interpretations and no obvious default. They should be resolved via `/speckit-clarify` before `/speckit-plan`.
> 
> Note on Success Criteria: SC-005 references "direct `db.collection(...).add(...)`" which leans technical. This is intentional — it gives the test author an unambiguous failure mode to assert. The user-facing equivalent ("zero accidental writes bypass server validation") is implicit in the requirement. Considered acceptable.

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification beyond the deliberate platform-naming above

## Notes

- The 2 outstanding `[NEEDS CLARIFICATION]` markers require user input before `/speckit-plan`. Recommended next command: `/speckit-clarify`.
- This spec consciously diverges from the Supabase-based `001-setup-supabase` spec in three places: (a) subscriptions are labels only (no auto-materialization, no cron — US7, FR-026–FR-028, SC-008 rewritten); (b) backend write gating moves from SECURITY DEFINER RPCs to Callable Cloud Functions (FR-015–FR-017); (c) the `budget` schema convention has no direct Firestore equivalent and is now a NEEDS CLARIFICATION (FR-013).
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
