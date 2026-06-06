# Adult Display Name Editing + Transaction-Based Income Split

**Date:** 2026-06-06

## Summary

Two related changes to the family management feature:

1. Adults can now edit their display name (replaces the income editing UI on the family page).
2. Income is removed from the family page entirely; income split ratios are computed from actual income transactions (rolling 12 months) rather than a manually set `monthly_income_cents` field.

---

## Feature 1: Edit Display Name for Adults

### What changes

The "Edit" button on each adult's `MemberCard` currently opens an income editing popup. It will instead open an inline text input to edit `display_name`.

The sub-line under the adult's name (currently "Income $X/mo") is removed entirely — adults show no sub-line.

### RPC

New `update_member_display_name(p_member_id UUID, p_display_name TEXT)`:
- Validates trimmed length is between 1 and 100 characters
- Verifies the member belongs to the caller's household
- Updates `household_member.display_name`
- `SECURITY DEFINER`, `search_path = ''`, owned by `budget_function_owner`

### Server action

New `updateDisplayNameAction(memberId: string, displayName: string): Promise<{ error?: string }>` in `app/(app)/family/actions.ts`.

Calls `update_member_display_name` RPC. On success, calls `revalidatePath("/family")`.

`updateIncomeAction` is removed.

### UI

`MemberCardData` type drops `monthly_income_cents`.

`MemberCard`:
- Replaces income sub-line with nothing (no sub-line for adults)
- Edit popup becomes a text input for `display_name` (pre-populated with current value)
- `onSaveIncome` prop replaced by `onSaveDisplayName: (memberId: string, name: string) => Promise<void>`

`FamilyClient`:
- Wires `onSaveDisplayName` to `updateDisplayNameAction`
- Removes `updateIncomeAction` import

`family/page.tsx`:
- No longer maps `monthly_income_cents` into the adults array

---

## Feature 2: Transaction-Based Income Split

### What changes

`compute_income_split` is rewritten to derive each adult's income from the sum of their income transactions over the rolling 12 months (today − 365 days through today), instead of reading `monthly_income_cents`.

`apply_split_rule`'s `by_income` path currently queries `monthly_income_cents` directly for tie-breaking. It will instead use an `income_cents` column added to the `compute_income_split` return type.

`household_member.monthly_income_cents` stays in the DB — no destructive migration.

Settings page empty-state copy changes from "Add adults and incomes first." to "Add income transactions first."

### Updated `compute_income_split` return type

```
adult_id       uuid
ratio          numeric(10,8)
display_order  int
income_cents   bigint          -- rolling 12-month sum; 0 if none
```

### Income sum logic

```sql
SELECT paid_by_member_id, COALESCE(SUM(amount_cents), 0) AS income_cents
FROM public.transaction
WHERE household_id = p_household_id
  AND type = 'income'
  AND occurred_on >= (CURRENT_DATE - INTERVAL '365 days')
GROUP BY paid_by_member_id
```

Fallback: if all adults have `income_cents = 0`, equal split (1/n per adult) — unchanged from current behaviour.

### Migration

Single new migration file (timestamp > 20260606000001) containing:
- `CREATE OR REPLACE FUNCTION update_member_display_name(...)`
- `CREATE OR REPLACE FUNCTION compute_income_split(...)` — updated logic
- `CREATE OR REPLACE FUNCTION apply_split_rule(...)` — use `income_cents` from `compute_income_split` instead of `monthly_income_cents`

---

## Affected files

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | New `update_member_display_name` RPC; updated `compute_income_split`; updated `apply_split_rule` |
| `app/(app)/family/actions.ts` | Add `updateDisplayNameAction`; remove `updateIncomeAction` |
| `components/family/MemberCard.tsx` | Replace income edit UI with display name edit; update type |
| `app/(app)/family/FamilyClient.tsx` | Wire `onSaveDisplayName`; remove income action |
| `app/(app)/family/page.tsx` | Remove `monthly_income_cents` from adults array |
| `app/(app)/settings/page.tsx` | Update empty-state copy |

---

## Edge cases

- **No income transactions in 12 months:** equal split among all adults (same fallback as before).
- **Single adult:** always 100% regardless of transaction history.
- **Adult with zero income but others have some:** their ratio is 0, they owe nothing on `by_income` splits.
