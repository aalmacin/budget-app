# Budget contracts

## `set_category_budget(category_id uuid, monthly_budget_cents bigint | null)` → `void`

- Sets (or clears, when passing null) the monthly limit for a category in the caller's household.
- If the target row is the system-global category (`household_id is null`), the function **clones** it into the caller's household first, then writes the override (so global seeds are never mutated).
- Errors: `P0001` "monthly_budget_cents must be non-negative when set".

## `set_category_essential_pct(category_id uuid, default_essential_pct smallint)` → `void`

- Same clone-on-write rule as above.
- Validates 0..100.
- Maps to FR-014 / FR-035.

## `get_budget_progress(year smallint, month smallint, filter text)` → `setof budget_progress_row`

Drives the budget overview screen.

- Args: `{ year, month, filter: 'all'|'essential'|'treats' }`
- Returns rows of `{ category_id, category_name, monthly_budget_cents, spent_cents, essential_spent_cents, treats_spent_cents, percent_used }`.
- The `essential` / `treats` filter affects which `spent_cents` column counts for "percent_used":
  - `all` → uses sum of essential+treats portions of all transactions in the month
  - `essential` → uses only the essential portion across transactions
  - `treats` → uses only the non-essential portion
- Categories without a budget are returned with `monthly_budget_cents = null` and `percent_used = null`. The UI still displays them under an "unlimited" section.

## `get_dashboard_summary(year smallint, month smallint)` → record

Single-call read for the dashboard panel:

```ts
type DashboardSummary = {
  balance_cents: bigint;            // sum(income) - sum(expense), all-time
  left_to_spend_this_month_cents: bigint | null;  // sum(budget) - sum(expense) for the month, null if no budgets set
  essential_spent_cents: bigint;
  treats_spent_cents: bigint;
  recent: TransactionRow[];         // top 10 by occurred_on
};
```

Powers FR-016. Built as one SQL function to minimize round trips on the cold load.
