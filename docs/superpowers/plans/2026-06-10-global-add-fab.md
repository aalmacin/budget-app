# Global Add FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Add FAB on every page in the authenticated app shell.

**Architecture:** Add `<AddFAB />` once to `app/(app)/layout.tsx` (the single auth-gated shell). Upgrade bottom padding from `pb-16` → `pb-32` on pages that have `pb-16`, and add `pb-32` to pages that have no bottom padding, so content is never hidden behind the FAB.

**Tech Stack:** Next.js (App Router), Tailwind CSS, existing `AddFAB` component at `components/ui/AddFAB.tsx`

---

## File Map

| File | Change |
|------|--------|
| `app/(app)/layout.tsx` | Add `<AddFAB />` inside `<main>` |
| `app/(app)/quick-add/page.tsx` | `pb-16` → `pb-32` |
| `app/(app)/recurring-transactions/page.tsx` | `pb-16` → `pb-32` |
| `app/(app)/family/page.tsx` | `pb-16` → `pb-32` |
| `app/(app)/settings/page.tsx` | `pb-16` → `pb-32` |
| `app/(app)/budget/page.tsx` | `pb-16` → `pb-32` |
| `app/(app)/reports/layout.tsx` | `pb-16` → `pb-32` (covers all 5 report pages) |
| `app/(app)/add/page.tsx` | `pt-3` → `pt-3 pb-32` |
| `app/(app)/add-income/page.tsx` | `pt-3` → `pt-3 pb-32` |
| `app/(app)/recurring-transactions/[id]/add/page.tsx` | both `pt-3` return paths → `pt-3 pb-32` |

---

### Task 1: Add AddFAB to the app shell layout

**Files:**
- Modify: `app/(app)/layout.tsx`

- [ ] **Add `AddFAB` import and render it inside `<main>`**

  Open `app/(app)/layout.tsx`. Add the import and place `<AddFAB />` as a sibling after `{children}` inside the `<main>` element:

  ```tsx
  import type { ReactNode } from "react";
  import { redirect } from "next/navigation";
  import { createSupabaseServerClient } from "@/lib/supabase/server";
  import { AppDrawer } from "@/components/layout/AppDrawer";
  import { OnlineReplayMounter } from "@/components/layout/OnlineReplayMounter";
  import { ReduxProvider } from "@/store/Provider";
  import { AddFAB } from "@/components/ui/AddFAB";

  export default async function AppLayout({ children }: { children: ReactNode }) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: householdId } = await supabase.rpc("get_current_household");
    if (!householdId) redirect("/onboarding/create-household");

    return (
      <ReduxProvider>
        <div className="min-h-svh bg-bg flex flex-col">
          <main className="flex-1 relative w-full max-w-2xl mx-auto">
            {children}
            <AddFAB />
          </main>
          <AppDrawer />
          <OnlineReplayMounter />
        </div>
      </ReduxProvider>
    );
  }
  ```

- [ ] **Commit**

  ```bash
  git add app/\(app\)/layout.tsx
  git commit -m "feat: add AddFAB to app shell layout so it appears on every page"
  ```

---

### Task 2: Fix bottom padding — pb-16 pages

Pages with `pb-16` need `pb-32` so the FAB doesn't cover content.

**Files:**
- Modify: `app/(app)/quick-add/page.tsx`
- Modify: `app/(app)/recurring-transactions/page.tsx`
- Modify: `app/(app)/family/page.tsx`
- Modify: `app/(app)/settings/page.tsx`
- Modify: `app/(app)/budget/page.tsx`
- Modify: `app/(app)/reports/layout.tsx`

- [ ] **quick-add/page.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>`

- [ ] **recurring-transactions/page.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>`

- [ ] **family/page.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>`

- [ ] **settings/page.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>`

- [ ] **budget/page.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>`

- [ ] **reports/layout.tsx** — change `pt-3 pb-16` → `pt-3 pb-32` on the outermost `<div>` (covers cashflow, essentials, monthly, per-person, spend-over-time)

- [ ] **Commit**

  ```bash
  git add \
    app/\(app\)/quick-add/page.tsx \
    app/\(app\)/recurring-transactions/page.tsx \
    app/\(app\)/family/page.tsx \
    app/\(app\)/settings/page.tsx \
    app/\(app\)/budget/page.tsx \
    app/\(app\)/reports/layout.tsx
  git commit -m "fix: upgrade pb-16 to pb-32 on all pages to clear the global AddFAB"
  ```

---

### Task 3: Fix bottom padding — pages with no bottom padding

**Files:**
- Modify: `app/(app)/add/page.tsx`
- Modify: `app/(app)/add-income/page.tsx`
- Modify: `app/(app)/recurring-transactions/[id]/add/page.tsx`

- [ ] **add/page.tsx** — change `"pt-3"` → `"pt-3 pb-32"` on the outermost `<div>`

- [ ] **add-income/page.tsx** — change `"pt-3"` → `"pt-3 pb-32"` on the outermost `<div>`

- [ ] **recurring-transactions/[id]/add/page.tsx** — this file has two return paths, both with `"pt-3"`. Change both to `"pt-3 pb-32"`.

- [ ] **Commit**

  ```bash
  git add \
    app/\(app\)/add/page.tsx \
    app/\(app\)/add-income/page.tsx \
    "app/(app)/recurring-transactions/[id]/add/page.tsx"
  git commit -m "fix: add pb-32 to form pages so content clears the global AddFAB"
  ```
