# Reduce Pages — Consolidate Add Actions Behind FAB Popover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove "Quick Add", "Add Expense", and "Add Income" from the drawer and replace both plain-link FABs (Transactions + Dashboard) with a single `AddFAB` component that shows a popover with all three options.

**Architecture:** A new `AddFAB` client component wraps a toggle button and an absolutely-positioned popover card. It replaces the `<FAB href="/quick-add">` on two pages. The AppDrawer LINKS array loses three entries. The underlying route pages are untouched.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Playwright (E2E)

---

## File Map

| File | Action |
|------|--------|
| `components/ui/AddFAB.tsx` | CREATE — popover FAB client component |
| `components/layout/AppDrawer.tsx` | MODIFY — remove 3 LINKS entries |
| `app/(app)/transactions/page.tsx` | MODIFY — swap `<FAB>` → `<AddFAB>` |
| `app/(app)/dashboard/page.tsx` | MODIFY — swap `<FAB>` → `<AddFAB>` |
| `tests/e2e/authed/add-fab.spec.ts` | CREATE — E2E tests |

---

## Task 1: Write the failing E2E tests

**Files:**
- Create: `tests/e2e/authed/add-fab.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// tests/e2e/authed/add-fab.spec.ts
import { test, expect } from "../fixtures";

test.describe("AddFAB — drawer cleanup", () => {
  test("drawer no longer shows Quick Add, Add Expense, or Add Income", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open navigation/i }).click();
    const nav = page.getByRole("dialog", { name: /navigation/i });
    await expect(nav.getByRole("link", { name: "Quick Add" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Add Expense" })).not.toBeVisible();
    await expect(nav.getByRole("link", { name: "Add Income" })).not.toBeVisible();
  });
});

test.describe("AddFAB — Transactions page", () => {
  test("+ FAB is a button (not a link)", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("button", { name: /open add menu/i })).toBeVisible();
  });

  test("tapping + opens popover with three options", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Expense" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Income" })).toBeVisible();
  });

  test("tapping outside closes the popover", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await page.mouse.click(100, 200);
    await expect(page.getByRole("link", { name: "Quick Add" })).not.toBeVisible();
  });

  test("Quick Add navigates to /quick-add", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Quick Add" }).click();
    await expect(page).toHaveURL(/\/quick-add/);
  });

  test("Add Expense navigates to /add", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Add Expense" }).click();
    await expect(page).toHaveURL(/\/add/);
  });

  test("Add Income navigates to /add-income", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await page.getByRole("link", { name: "Add Income" }).click();
    await expect(page).toHaveURL(/\/add-income/);
  });
});

test.describe("AddFAB — Dashboard page", () => {
  test("+ FAB on dashboard is a button and opens same popover", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /open add menu/i }).click();
    await expect(page.getByRole("link", { name: "Quick Add" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Expense" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Income" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests — confirm they all fail**

```bash
npx playwright test tests/e2e/authed/add-fab.spec.ts --project=authed-userA
```

Expected: all tests FAIL (drawer still has the links; FAB is a link, not a button).

---

## Task 2: Create the AddFAB component

**Files:**
- Create: `components/ui/AddFAB.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export function AddFAB() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="absolute right-5" style={{ bottom: 28 }}>
      {open && (
        <nav
          aria-label="Add options"
          className="absolute bottom-[calc(100%+8px)] right-0 bg-surface rounded-2xl shadow-xl overflow-hidden min-w-[152px]"
        >
          <Link
            href="/quick-add"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink border-b border-line hover:bg-surface-soft"
          >
            Quick Add
          </Link>
          <Link
            href="/add"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink border-b border-line hover:bg-surface-soft"
          >
            Add Expense
          </Link>
          <Link
            href="/add-income"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            Add Income
          </Link>
        </nav>
      )}
      <button
        type="button"
        aria-label={open ? "Close add menu" : "Open add menu"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-sage text-white flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(42,61,51,0.45)]"
      >
        {open ? Icon.close(20) : Icon.plus(20)}
      </button>
    </div>
  );
}
```

---

## Task 3: Update the Transactions page

**Files:**
- Modify: `app/(app)/transactions/page.tsx`

Current imports include:
```tsx
import { FAB } from "@/components/ui/FAB";
import { Icon } from "@/components/ui/icons";
```

And the JSX includes:
```tsx
<FAB href="/quick-add" icon={Icon.plus(20)} />
```

- [ ] **Step 1: Replace the FAB import and usage**

Remove both the `FAB` and `Icon` imports (Icon is only used for the FAB on this page). Add `AddFAB` import. Replace the element.

The imports section should change from:
```tsx
import { FAB } from "@/components/ui/FAB";
import { Icon } from "@/components/ui/icons";
```
to:
```tsx
import { AddFAB } from "@/components/ui/AddFAB";
```

The JSX should change from:
```tsx
<FAB href="/quick-add" icon={Icon.plus(20)} />
```
to:
```tsx
<AddFAB />
```

---

## Task 4: Update the Dashboard page

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

Current imports include:
```tsx
import { FAB } from "@/components/ui/FAB";
import { Icon } from "@/components/ui/icons";
```

And the JSX includes:
```tsx
<FAB href="/quick-add" icon={Icon.plus(20)} />
```

- [ ] **Step 1: Replace the FAB import and usage**

Remove both `FAB` and `Icon` imports (Icon is only used for the FAB on this page). Add `AddFAB` import.

The imports section should change from:
```tsx
import { FAB } from "@/components/ui/FAB";
import { Icon } from "@/components/ui/icons";
```
to:
```tsx
import { AddFAB } from "@/components/ui/AddFAB";
```

The JSX should change from:
```tsx
<FAB href="/quick-add" icon={Icon.plus(20)} />
```
to:
```tsx
<AddFAB />
```

---

## Task 5: Remove drawer entries

**Files:**
- Modify: `components/layout/AppDrawer.tsx`

- [ ] **Step 1: Remove the three LINKS entries**

In `AppDrawer.tsx`, the `LINKS` array currently reads:

```ts
const LINKS: DrawerLink[] = [
  { href: "/dashboard", label: "Dashboard", section: "main" },
  { href: "/quick-add", label: "Quick Add", section: "money" },
  { href: "/add", label: "Add Expense", section: "money" },
  { href: "/add-income", label: "Add Income", section: "money" },
  { href: "/transactions", label: "Transactions", section: "money" },
  { href: "/budget", label: "Budget", section: "money" },
  { href: "/reports/spend-over-time", label: "Reports", section: "money" },
  { href: "/subscriptions", label: "Subscriptions", section: "money" },
  { href: "/family", label: "Family", section: "household" },
  { href: "/settings", label: "Settings", section: "household" },
];
```

Replace with:

```ts
const LINKS: DrawerLink[] = [
  { href: "/dashboard", label: "Dashboard", section: "main" },
  { href: "/transactions", label: "Transactions", section: "money" },
  { href: "/budget", label: "Budget", section: "money" },
  { href: "/reports/spend-over-time", label: "Reports", section: "money" },
  { href: "/subscriptions", label: "Subscriptions", section: "money" },
  { href: "/family", label: "Family", section: "household" },
  { href: "/settings", label: "Settings", section: "household" },
];
```

---

## Task 6: Run tests and commit

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run E2E tests**

```bash
npx playwright test tests/e2e/authed/add-fab.spec.ts --project=authed-userA
```

Expected: all 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ui/AddFAB.tsx components/layout/AppDrawer.tsx app/(app)/transactions/page.tsx app/(app)/dashboard/page.tsx tests/e2e/authed/add-fab.spec.ts
git commit -m "feat: consolidate add actions behind FAB popover, remove from drawer"
```
