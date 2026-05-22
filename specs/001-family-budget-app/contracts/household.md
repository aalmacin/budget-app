# Household contracts

## `create_household(name text)` → `uuid`

Creates a household and adds the caller as the first adult member. **`security definer`** because the policy on `household_member` requires an existing membership row, which is what we are about to create.

- Args: `{ name }`
- Returns: `uuid` (new household id)
- Side effects: inserts `household` (with `owner_user_id = auth.uid()`) + `household_member` (role=adult, user_id=auth.uid(), display_name=email prefix). Single transaction.
- Errors:
  - `P0001` if `auth.uid()` is null (not signed in)
  - `P0001` if the caller already owns a household (v1: 1 user, 1 owned household max — they can be invited into others)

## `update_household(name?, province?, tax_profile?, gst_hst_registrant?)` → `void`

- Args (any subset): `{ name?, province?, tax_profile?, gst_hst_registrant? }`
- Implicitly scoped via RLS to the caller's household.
- Triggers a Realtime broadcast for the household's settings channel.
- Errors:
  - `42501` RLS denial if caller has no membership.
  - `P0001` "Unsupported province" if `province` not in supported list.

## `add_member(role, display_name, age_years?)` → `uuid`

Adds a kid, or a placeholder adult (no user account yet — the user account is attached on `accept_invite`).

- Args: `{ role: 'adult'|'kid', display_name, age_years? }`
- Returns: new member id
- Errors:
  - `P0001` "Households are limited to 2 adults" — triggers if a 3rd adult would be inserted (also enforced at the trigger level).
  - `P0001` "Age required for kids" if `role='kid'` without `age_years`.

## `update_member_income(member_id uuid, monthly_income_cents bigint)` → `void`

- Args: `{ member_id, monthly_income_cents }`
- Updates the adult's income. Pure RLS scoping: caller must belong to the same household.
- Side effects: triggers Realtime broadcast on the household so dashboards re-derive split ratios.
- Errors:
  - `P0001` if `member.role <> 'adult'` (kids do not earn income in v1).
  - `P0001` if `monthly_income_cents < 0`.

## `create_invite(email citext)` → `text`

Owner-only RPC. Generates a single-use opaque token.

- Args: `{ email }`
- Returns: invite token (URL-safe)
- Side effect: inserts `household_invite` with `expires_at = now() + interval '7 days'`.
- Errors:
  - `P0001` "Only the household owner can invite" if `auth.uid() <> household.owner_user_id`.
  - `P0001` "An invite for that email is already pending" (unique partial index `(household_id, lower(email)) where accepted_at is null and revoked_at is null`).

## `accept_invite(token text)` → `uuid`

**`security definer`** — the caller does NOT yet have membership in the target household, so RLS would otherwise block the read.

- Args: `{ token }`
- Returns: household id joined
- Side effect: inserts `household_member(role='adult', user_id=auth.uid())`, sets `accepted_at = now()` on the invite, all in one transaction.
- Errors:
  - `P0001` "Invite expired or invalid" if no matching unaccepted, unrevoked, unexpired token.
  - `P0001` "Households are limited to 2 adults" if accepting would create a 3rd adult.
  - `P0001` "Invite email mismatch" if `auth.users.email <> invite.email` (case-insensitive).

## `revoke_invite(invite_id uuid)` → `void`

- Owner-only. Sets `revoked_at = now()`. Idempotent.
