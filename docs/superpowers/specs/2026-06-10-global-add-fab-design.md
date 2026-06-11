# Global Add FAB

## Goal

Surface the Add FAB (Quick Add / Add Expense / Add Income) on every page in the authenticated app shell, not just Dashboard and Transactions.

## Approach

Add `<AddFAB />` once to `app/(app)/layout.tsx`. This layout is the single auth-gated shell for all `(app)/` routes, so a single placement covers every current and future page.

## Changes

### 1. `app/(app)/layout.tsx`

Add `<AddFAB />` inside the `main` element.

### 2. Padding audit — all `(app)/` pages

Dashboard and Transactions already have `pb-32` to clear the FAB. Every other page needs `pb-32` on its outermost content container. This includes form pages (`/add`, `/add-income`) since the FAB is wanted there too.

Pages to update:
- `/add` — AddExpenseForm wrapper
- `/add-income` — AddIncomeForm wrapper
- `/quick-add` — page container
- `/history` and dynamic sub-routes
- `/reports/*` — all report pages
- `/recurring-transactions` and `[id]` sub-routes
- `/family`
- `/settings`
- `/budget`

## Out of Scope

- No per-page FAB suppression
- No changes to FAB menu items or behavior
