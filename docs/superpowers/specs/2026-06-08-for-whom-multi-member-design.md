# For Whom — Multi-Member Support

**Date:** 2026-06-08
**Status:** Approved

## Summary

Update the "For Whom" field on expenses to allow multiple household members to be selected. When multiple members are selected the expense is split equally among them (equal split is derived, not stored). A `NULL` or empty array means the expense belongs to the whole household.

## Data Model

Replace the single `for_member_id UUID` column on `transaction` and `saved_expense` with `for_member_ids UUID[]`.

Two forward migrations (in order — never edit applied migrations):

1. **Back-fill migration**: Add `for_member_ids UUID[]` to both tables. Back-fill: `for_member_ids = ARRAY[for_member_id]` where `for_member_id IS NOT NULL`; rows with `NULL` keep `NULL`.
2. **Drop migration**: Remove `for_member_id` from both tables.

A trigger on `transaction` (similar to `enforce_member_household`) validates every element of `for_member_ids` belongs to the same household as the transaction.

**Canonical form**: DB stores `NULL` when no specific members are selected (whole household). UI state uses `string[]` where `[]` represents whole household. The server action converts `[]` → `NULL` on save and `NULL` → `[]` on load.

Equal split per member: `amount_cents / array_length(for_member_ids, 1)` — computed at query/display time, not stored.

## Database RPCs

| RPC | Change |
|-----|--------|
| `_insert_transaction` | Extract `v_for_member_ids UUID[]` from JSON input instead of single UUID |
| `update_transaction` | Accept JSON array for `for_member_ids` in patch payload |
| `list_transactions` | Filter: `v_for_member = ANY(t.for_member_ids)`. Return `for_member_display_names TEXT[]` (via `array_agg`) instead of `for_member_display_name TEXT` |
| `list_quick_add_options` | Return `for_member_ids UUID[]` instead of `for_member_id UUID` |

## Types & Validators

- `logExpenseSchema`: replace `for_member_id: uuidSchema.nullable().optional()` with `for_member_ids: z.array(uuidSchema).optional().default([])`
- `updateTransactionSchema`: same replacement
- `EditableTxn`: `for_member_id: string | null` → `for_member_ids: string[]`
- `QuickAddTile` data type: same replacement
- `ForWhomOption`: unchanged

Server action (`logExpenseAction`) extracts the field via `formData.getAll("for_member_ids[]")`.

## Redux State & Filtering

Filter state `forMember: string | null` is unchanged. Filtering by a member shows all transactions where that member is `ANY(for_member_ids)`. No changes to `FilterChips` or filter dispatch.

## UI Components

### `ForWhomChips`
- `value`: `string | null` → `string[]`
- "Household" chip corresponds to empty array `[]` in UI state (stored as `NULL` in DB)
- Each member chip toggles its ID in/out of the array; multiple chips active simultaneously
- Hidden form fields: one `<input name="for_member_ids[]">` per selected member (replaces single hidden input)

### `AddExpenseForm`
- `forMember` state: `string | null` → `string[]`

### `EditTxnSheet`
- `forMember` state: `string | null` → `string[]`
- Patch payload: `for_member_ids: forMember`

### Transaction List
- `for_member_display_name` (single string) → derived from `for_member_display_names TEXT[]` as comma-joined string (e.g., "Alice, Bob" or "Household")

## Out of Scope

- Unequal splits (always equal when multiple members selected)
- Storing per-member amounts
- Changing filter to support multi-member selection
