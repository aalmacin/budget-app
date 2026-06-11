# History Page — Design Spec

**Date:** 2026-06-10

## Overview

Add a History section so users can browse any past month's financial summary and full transaction list. Also make months clickable in the Monthly report table.

## Routes

| Route | Description |
|---|---|
| `/history` | Index of all past months, newest first |
| `/history/[year]/[month]` | Detail view for one month |

## `/history` — Month Index

**Component:** Server component (`app/(app)/history/page.tsx`)

**Data:** Calls `monthly_expense_comparison` (existing RPC). Filters out the current month. Renders a sorted list (newest first) of month links.

**UI:** Simple card list — each entry shows the full month name (e.g. "May 2026") as a `<Link href="/history/2026/5">`. No extra data shown on this page.

**Navigation:** Added to the AppDrawer `LINKS` array in the `money` section (after Transactions, before Reports).

## `/history/[year]/[month]` — Month Detail

**Component:** Server component (`app/(app)/history/[year]/[month]/page.tsx`)

**Data:** Two parallel RPC calls:
- `get_dashboard_summary(year, month)` — for all stat cards
- `list_transactions({ from: "YYYY-MM-01", to: "YYYY-MM+1-01", limit: 1000 })` — for the full activity list

**UI:** Mirrors the dashboard layout:
1. AppBar with a `←` back link to `/history` on the left (no menu button)
2. Same four stat cards as the dashboard (Left to spend, Balance, Income / Saved %, Expenses / Essential vs Treats)
   - Hero label reads "{Month} {Year}" instead of "Left to spend · {current month}"
3. Full activity list for the month — all transactions sorted date descending, using the existing `<ActivityRow>` component. No "See all" link (this is already all of them).
4. No FAB (no add button — history is read-only)

**Month label:** Uses the format "May 2026" in the hero card. AppBar title is also "May 2026".

## Monthly Report Update

**File:** `components/reports/MonthlyComparisonClient.tsx`

The month label `<td>` cell in the table body is wrapped in a `<Link>`:
- Past months → `href="/history/{year}/{month}"`
- Current month (MTD row) → `href="/dashboard"` (plain link, no special style)

## Navigation

AppDrawer `LINKS` in `components/layout/AppDrawer.tsx`:

```
{ href: "/history", label: "History", section: "money" }
```

Inserted after Transactions, before Reports.

## What is NOT in scope

- Editing transactions from the history view
- Filtering/search on the history detail page (use Transactions page for that)
- Pagination on the detail page (limit 1000 covers any realistic month)
