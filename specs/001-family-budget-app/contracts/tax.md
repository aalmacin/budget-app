# Tax contracts

## `set_tax_profile(province text, tax_profile text, gst_hst_registrant boolean)` → `void`

- Args: `{ province, tax_profile, gst_hst_registrant }`
- Updates the household row.
- Triggers Realtime so the Taxes screen recomposes.
- Errors:
  - `P0001` "Unsupported province" if not in supported list.
  - `P0001` "Invalid tax profile" if not in enum.

## `log_deduction(payload)` → `uuid`

- Args: `{ id?, member_id, cra_category, amount_cents, occurred_on, notes?, tax_year? }`
- `tax_year` defaults to `extract(year from occurred_on)`.
- Returns the deduction id.
- Errors:
  - `P0001` "Unknown CRA category" if not in enum.
  - `P0001` "Amount must be positive".

## `list_deductions(tax_year smallint, member_id uuid?)` → `setof deduction_view`

- Filters: tax year (required), optional member.
- Returns rows joined with member display name and category label localized to Canadian terminology (T2125, T2202, etc.).

## `gst_hst_running_total()` → `bigint`

- Returns the running set-aside balance for the caller's household (sum of `gst_hst_setaside.amount_cents`).

## CRA dates (client-side, no RPC)

The Taxes screen does not need to call an RPC for the four CRA quarterly instalments or the Apr 30 / Jun 15 filing deadlines — those are deterministic dates derived in `lib/canadian-tax/dates.ts` for the active tax year, anchored in `America/Toronto` so a user in any timezone sees the correct Canadian-civil-calendar date.

If a date function ever needs server-side semantics, we add `get_cra_deadlines(tax_year)` later. For v1 it lives client-side.
