# Transaction contracts

## `log_expense(payload)` → `uuid`

- Args: `{ id?, amount_cents, occurred_on, category_id, notes?, paid_by_member_id?, for_member_id?, essential_pct?, split_rule? }`
- `id` is optional — if the client supplies a UUID v7 the insert becomes idempotent across offline replays.
- If `essential_pct` is omitted, the function looks up the category's `default_essential_pct` (FR-014).
- Realtime: emits INSERT on `household:<id>:transactions`.
- Returns: the resolved `id`.
- Errors:
  - `P0001` "Amount must be positive."
  - `P0001` "Category not found in this household."
  - `P0001` "essential_pct must be between 0 and 100."
  - `P0001` "for_member_id does not belong to this household."

## `log_income(payload)` → `uuid`

- Args: `{ id?, amount_cents, occurred_on, category_id, notes?, paid_by_member_id, income_source }`
- `paid_by_member_id` is the earner (must be an `adult`).
- Side effect: a Postgres trigger on `transaction` of `type='income'` whose `category_id` is GST/HST-applicable (configurable per category, default for `Self_employed` source) inserts a corresponding `gst_hst_setaside` row at the configured percentage (FR-033).
- Returns: the resolved id.
- Errors: same shape as `log_expense`, plus `P0001 "income_source required for income"`.

## `update_transaction(id uuid, patch)` → `void`

- Args: `{ id, patch: { amount_cents?, occurred_on?, category_id?, notes?, paid_by_member_id?, for_member_id?, essential_pct?, split_rule? } }`
- Cascades to `gst_hst_setaside` if the linked income changes amount (function deletes and re-inserts the dependent setaside row).
- Realtime: emits UPDATE.
- Errors: `42501` RLS denial; `P0001` validation as above.

## `delete_transaction(id uuid)` → `void`

- Deletes the row + cascades dependent `gst_hst_setaside`.
- Realtime: emits DELETE.
- Idempotent: deleting an already-gone row returns silently.

## `list_transactions(filters?)` → `setof transaction_view`

- Args: `{ from?, to?, category_id?, for_member_id?, essential?: 'all'|'essential'|'treats', search? }`
- Returns paginated transactions in descending `occurred_on` then `created_at`, joined with category name and member display names (returned via a SQL view `transaction_view`).
- Search applies to `notes` via the GIN index.
- Used by both the transactions list page and the recent-activity strip on the dashboard.

> **Note**: Simple list reads can also go through PostgREST direct table selects under RLS. Using `list_transactions` centralizes the joined-view shape and keeps the contract stable; the client treats either path identically.
