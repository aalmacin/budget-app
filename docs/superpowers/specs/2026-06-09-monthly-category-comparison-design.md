# Monthly Category Comparison Tab

**Date:** 2026-06-09

## Summary

Add a "Monthly" tab to the reports page that shows a table comparing expenses across all months in history. MTD (current month) is pinned at the top. Columns are configurable via a floating picker; Essentials and Non-Essentials are shown by default.

---

## Route & Navigation

- New route: `/reports/monthly`
- Tab label: `Monthly`
- Insert into `ReportsNav.tsx` TABS array alongside the existing four tabs

---

## Architecture

### Data flow

1. `app/(app)/reports/monthly/page.tsx` — server component; calls `monthly_expense_comparison()` RPC once; passes the full result to the client component.
2. `components/reports/MonthlyComparisonClient.tsx` — client component; owns column selection state (`useState<Set<string>>`); renders the table and floating column picker.

Column visibility is client state only — the full dataset is always fetched; the RPC is not parameterised by selected columns. No URL params are needed since column selection is a personal UI preference, not shareable state.

### New files

| File | Purpose |
|------|---------|
| `app/(app)/reports/monthly/page.tsx` | Server page — fetch + pass data |
| `components/reports/MonthlyComparisonClient.tsx` | Table + floating column picker |
| `supabase/migrations/<timestamp>_monthly_expense_comparison.sql` | New RPC |

### Modified files

| File | Change |
|------|--------|
| `components/reports/ReportsNav.tsx` | Add Monthly tab entry |

---

## RPC: `monthly_expense_comparison()`

**Returns:** `JSONB[]`, ordered newest month first.

```json
[
  {
    "year": 2026,
    "month": 6,
    "total_cents": 76500,
    "essential_cents": 45500,
    "non_essential_cents": 31000,
    "categories": [
      { "id": "uuid", "name": "Groceries", "spent_cents": 32000 }
    ],
    "people": [
      { "id": "uuid", "name": "Bob", "spent_cents": 19000 }
    ]
  }
]
```

- Scope: `type = 'expense'` only, current household
- `essential_cents` = sum of `amount_cents * essential_pct / 100`
- `non_essential_cents` = sum of `amount_cents * (100 - essential_pct) / 100`
- Categories and people with zero spend are omitted from their arrays
- Follows existing RPC conventions: `SECURITY DEFINER`, `search_path = ''`, owned by `budget_function_owner`, `EXECUTE` granted to `authenticated`

---

## Table

### Default columns

| Month | Essentials | Non-Essentials | Total |
|-------|-----------|----------------|-------|

MTD row is visually highlighted (amber background, bold).

### With extra columns selected

Enforced render order (left to right):

1. Month (fixed, not in picker)
2. Selected categories — sorted alphabetically by name
3. Selected people — sorted alphabetically by name
4. Essentials (default-on, removable)
5. Non-Essentials (default-on, removable)
6. Total (fixed, not in picker)

Cells for categories/people not present in a given month's data render `—`.

All amount values formatted via `formatCAD()` with `CA$` replaced by `$` (matching the existing pattern in cashflow and essentials pages).

---

## Column Picker

- Triggered by a "⊞ Columns" button top-right above the table
- Clicking the button toggles the panel open/closed
- Panel floats over the table (absolute positioned, box shadow)
- Three groups of pill toggles inside the panel:
  - **Categories** — one pill per category that exists in the fetched data
  - **Per person** — one pill per household member in the fetched data
  - **Defaults** — Essentials pill (pre-selected), Non-Essentials pill (pre-selected)
- Selected pills render dark fill; unselected are outlined
- Initial state: Essentials and Non-Essentials selected, everything else deselected

---

## Edge cases

- **No data yet:** render `<p>No data yet.</p>` instead of the table
- **Single month (MTD only):** table renders normally with one row
- **Category/person missing for a month:** cell shows `—`
- **Long category names:** table allows horizontal scroll on mobile (same `overflow-x: auto` wrapper used in other report pages)
