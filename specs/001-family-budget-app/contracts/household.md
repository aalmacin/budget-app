# Household contracts

Household creation is user-initiated on first sign-in. Adding adults is by email-lookup against `auth.users` (no invitation tokens). Removing members is a soft-delete that preserves historical attribution. All per spec clarifications §1 and §5.

## `create_household(name text)` → `uuid`

Creates a household and adds the caller as the first adult member. **`security definer`** because the policies on `household` and `household_member` require an existing membership, which is what we are about to create.

- Args: `{ name }`
- Returns: `uuid` (new household id)
- Side effects in a single transaction:
  1. INSERT `household` with `owner_user_id = auth.uid()`.
  2. INSERT `household_member` with `role='adult'`, `user_id=auth.uid()`, `display_name = auth.users.email`'s local-part (the user can edit later).
- Errors:
  - `P0001` "Not signed in" if `auth.uid()` is null.
  - `P0001` "You already belong to a household" if the caller already has an active `household_member` row anywhere. (A single user owns at most one household in v1.)

## `update_household(name?, province?, tax_profile?, gst_hst_registrant?)` → `void`

- Args (any subset): `{ name?, province?, tax_profile?, gst_hst_registrant? }`
- Implicitly scoped via RLS to the caller's household.
- Triggers a Realtime broadcast so the Taxes screen recomputes if `province` or `tax_profile` changed.
- Errors:
  - `42501` RLS denial if caller has no active membership.
  - `P0001` "Unsupported province" if `province` not in the supported list.
  - `P0001` "Invalid tax profile" if not in enum.

## `add_adult_by_email(email citext)` → `record { status text, member_id uuid }`

Add a second adult by email-lookup against `auth.users`. Replaces the v0 invitation-token flow.

- Args: `{ email }` — case-insensitive.
- Returns: `{ status, member_id }` where `status` is one of:
  - `inserted` — a new active adult was added; `member_id` is the new row's id.
  - `already_member` — caller's household already has this user as an active adult; `member_id` is the existing row (idempotent no-op, FR-004b).
  - `self_member` — caller passed their own email; `member_id` is the caller's row (idempotent no-op, edge case).
- Errors:
  - `P0001` "No account exists for that email — ask the admin to create one first" — no `auth.users` row matches (FR-004).
  - `P0001` "Households are limited to 2 adults" — the household already has 2 active adults and the incoming user is not one of them (FR-004b). Caller must soft-delete one first.
  - `42501` RLS denial if caller has no active membership.

Idempotency: re-running with the same email after `inserted` returns `already_member` without side effects.

## `add_kid(display_name text, age_years smallint)` → `uuid`

- Args: `{ display_name, age_years }` — `age_years` between 0 and 25.
- Returns: new member id.
- Inserts `household_member` with `role='kid'`, `user_id=null`, `display_name`, `age_years`.
- Errors:
  - `P0001` "Age required for kids" if `age_years` is null.
  - `P0001` "Age must be between 0 and 25" otherwise.
  - `42501` RLS denial if caller has no active membership.

## `soft_delete_member(member_id uuid)` → `void`

- Sets `household_member.deleted_at = now()` (spec clarification §1).
- Idempotent (no-op if already soft-deleted).
- Triggers Realtime so all clients refresh their member selectors.
- Errors:
  - `42501` RLS denial if `member` is not in the caller's household.
  - `P0001` "Can't remove yourself if you are the only active adult" — caller may not soft-delete themselves when no other active adult exists (would orphan the household).

## `update_member_income(member_id uuid, monthly_income_cents bigint)` → `void`

- Args: `{ member_id, monthly_income_cents }`
- Updates the adult's income. Caller must belong to the same household (active membership).
- Side effects: Realtime broadcast so other clients re-derive income-split ratios from the new totals.
- Errors:
  - `P0001` if `member.role <> 'adult'` (kids do not earn income in v1).
  - `P0001` if `monthly_income_cents < 0`.
  - `P0001` "Can't update income on a removed member" if the target's `deleted_at` is not null.

## What is explicitly NOT in this contract

- **No `create_invite` / `accept_invite` / `revoke_invite`**. Removed per spec clarification §5 (admin-only account creation; in-app email-lookup add-member). The `household_invite` table is also removed from `data-model.md`.
- **No hard-delete of members or households.** Soft-delete is the only data-side removal in v1; full account/household deletion is handled manually by operations (spec clarification §2).
