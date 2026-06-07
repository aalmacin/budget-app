# Design: Consolidate Add Actions Behind FAB Popover

**Date:** 2026-06-06

## Goal

Reduce navigation clutter by removing "Quick Add", "Add Expense", and "Add Income" as standalone drawer entries. All three actions become accessible via a popover menu that appears when the user taps the + FAB on the Dashboard or Transactions page.

## Behaviour

### AddFAB component

- Renders as a circular sage-green FAB (matching the existing `FAB` component's visual).
- Tapping the button toggles the popover open/closed; the icon switches from `+` to `✕` when open.
- When open, a small card appears directly above the FAB containing three navigation links:
  1. ⚡ Quick Add → `/quick-add`
  2. ➖ Add Expense → `/add`
  3. ➕ Add Income → `/add-income`
- Tapping any option navigates to that route and closes the popover.
- Tapping anywhere outside the FAB or popover closes it.
- Implemented as a `"use client"` component using local `useState` for open/closed toggle and a `useEffect` to attach a document-level click listener for outside-dismiss.

### Drawer

Remove these three entries from `LINKS` in `AppDrawer.tsx`:
- Quick Add (`/quick-add`)
- Add Expense (`/add`)
- Add Income (`/add-income`)

The underlying pages are not deleted.

## Files Changed

| File | Change |
|------|--------|
| `components/ui/AddFAB.tsx` | New client component — popover FAB |
| `components/layout/AppDrawer.tsx` | Remove 3 entries from `LINKS` |
| `app/(app)/transactions/page.tsx` | Replace `<FAB href="/quick-add" …>` with `<AddFAB />` |
| `app/(app)/dashboard/page.tsx` | Replace `<FAB href="/quick-add" …>` with `<AddFAB />` |

## What Stays the Same

- `/quick-add`, `/add`, `/add-income` pages are not deleted or modified.
- The existing `FAB` component is untouched.
- The Quick Add page's own AppBar link to `/add` is untouched.

## Out of Scope

- Animations on the popover (no transition required).
- Any changes to the underlying add/income/quick-add forms.
- Adding the popover FAB to any page other than Dashboard and Transactions.
