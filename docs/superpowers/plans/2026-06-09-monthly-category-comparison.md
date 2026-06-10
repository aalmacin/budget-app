# Monthly Category Comparison Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Monthly" tab to the reports page showing a table of expenses per month with configurable columns (categories, per-person, essentials/non-essentials).

**Architecture:** One new Supabase RPC (`monthly_expense_comparison`) returns the full dataset (all months, all categories, all members) in one call. A server page component fetches it and passes it to a client component that owns column-selection state. Column visibility is client-only — the full dataset is always fetched and filtered in the browser.

**Tech Stack:** Next.js App Router (server + client components), Supabase RPC, Tailwind CSS, TypeScript, Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/20260609000001_monthly_expense_comparison.sql` | RPC definition |
| Create | `app/(app)/reports/monthly/page.tsx` | Server page — fetch data, pass to client |
| Create | `components/reports/MonthlyComparisonClient.tsx` | Table + floating column picker |
| Create | `tests/unit/monthly-comparison.test.ts` | Unit tests for pure utility logic |
| Modify | `components/reports/ReportsNav.tsx` | Add Monthly tab entry |

---

## Task 1: Supabase migration — `monthly_expense_comparison` RPC

**Files:**
- Create: `supabase/migrations/20260609000001_monthly_expense_comparison.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- monthly_expense_comparison() — returns all expense months for the current
-- household, newest first, with per-category and per-member breakdowns.
-- Follows SECURITY DEFINER / search_path = '' / budget_function_owner pattern.

CREATE OR REPLACE FUNCTION public.monthly_expense_comparison(
  p_today DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
  v_today        DATE := COALESCE(p_today, current_date);
  v_result       JSONB;
BEGIN
  IF v_household_id IS NULL THEN
    RETURN '[]'::JSONB;
  END IF;

  SELECT COALESCE(jsonb_agg(month_row ORDER BY month_row->>'year' DESC, month_row->>'month' DESC), '[]'::JSONB)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'year',                  EXTRACT(YEAR  FROM date_trunc('month', occurred_on))::INT,
      'month',                 EXTRACT(MONTH FROM date_trunc('month', occurred_on))::INT,
      'total_cents',           SUM(amount_cents),
      'essential_cents',       SUM((amount_cents * essential_pct / 100)::BIGINT),
      'non_essential_cents',   SUM((amount_cents * (100 - essential_pct) / 100)::BIGINT),
      'categories',            (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',          c.id,
          'name',        c.name,
          'spent_cents', cat_totals.spent
        ) ORDER BY c.name), '[]'::JSONB)
        FROM (
          SELECT t2.category_id, SUM(t2.amount_cents) AS spent
          FROM public.transaction t2
          WHERE t2.household_id = v_household_id
            AND t2.type = 'expense'
            AND date_trunc('month', t2.occurred_on) = date_trunc('month', t.occurred_on)
          GROUP BY t2.category_id
        ) cat_totals
        JOIN public.category c ON c.id = cat_totals.category_id
      ),
      'people',                (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id',          hm.id,
          'name',        hm.display_name,
          'spent_cents', person_totals.spent
        ) ORDER BY hm.display_name), '[]'::JSONB)
        FROM (
          SELECT t3.for_member_id, SUM(t3.amount_cents) AS spent
          FROM public.transaction t3
          WHERE t3.household_id = v_household_id
            AND t3.type = 'expense'
            AND t3.for_member_id IS NOT NULL
            AND date_trunc('month', t3.occurred_on) = date_trunc('month', t.occurred_on)
          GROUP BY t3.for_member_id
        ) person_totals
        JOIN public.household_member hm ON hm.id = person_totals.for_member_id
      )
    ) AS month_row
    FROM public.transaction t
    WHERE t.household_id = v_household_id
      AND t.type = 'expense'
    GROUP BY date_trunc('month', t.occurred_on)
  ) months;

  RETURN v_result;
END;
$$;

ALTER FUNCTION public.monthly_expense_comparison(DATE) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.monthly_expense_comparison(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.monthly_expense_comparison(DATE) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applies without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000001_monthly_expense_comparison.sql
git commit -m "feat: add monthly_expense_comparison RPC"
```

---

## Task 2: Unit tests for pure utility functions

These functions live inline in `MonthlyComparisonClient.tsx` but are tested first to drive their correct shape.

**Files:**
- Create: `tests/unit/monthly-comparison.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  formatMonthLabel,
  buildColumnOrder,
} from "@/components/reports/MonthlyComparisonClient";

describe("formatMonthLabel", () => {
  it("labels current month as MTD", () => {
    expect(formatMonthLabel(2026, 6, 2026, 6)).toBe("MTD (Jun 2026)");
  });

  it("labels past months as Mon YYYY", () => {
    expect(formatMonthLabel(2026, 5, 2026, 6)).toBe("May 2026");
    expect(formatMonthLabel(2025, 12, 2026, 6)).toBe("Dec 2025");
    expect(formatMonthLabel(2026, 1, 2026, 6)).toBe("Jan 2026");
  });
});

describe("buildColumnOrder", () => {
  const categories = [
    { id: "cat-1", name: "Groceries" },
    { id: "cat-2", name: "Transport" },
  ];
  const people = [
    { id: "per-1", name: "Alice" },
    { id: "per-2", name: "Bob" },
  ];

  it("returns only fixed columns when nothing extra is selected", () => {
    const cols = buildColumnOrder(new Set(["ess", "non_ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["ess", "non_ess", "total"]);
  });

  it("inserts selected categories before essentials, sorted alphabetically", () => {
    const cols = buildColumnOrder(new Set(["cat-2", "cat-1", "ess", "non_ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["cat-1", "cat-2", "ess", "non_ess", "total"]);
  });

  it("inserts selected people after categories and before essentials", () => {
    const cols = buildColumnOrder(new Set(["per-2", "per-1", "ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["per-1", "per-2", "ess", "total"]);
  });

  it("total column is always last and always present", () => {
    const cols = buildColumnOrder(new Set(), categories, people);
    expect(cols.at(-1)?.id).toBe("total");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (exports don't exist yet)**

```bash
npm run test:unit -- tests/unit/monthly-comparison.test.ts
```

Expected: fails with "does not provide an export named 'formatMonthLabel'"

---

## Task 3: Client component — `MonthlyComparisonClient`

**Files:**
- Create: `components/reports/MonthlyComparisonClient.tsx`

- [ ] **Step 1: Create the component with exported utility functions**

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { formatCAD } from "@/lib/money";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CategorySummary = { id: string; name: string; spent_cents: number };
export type PersonSummary   = { id: string; name: string; spent_cents: number };

export type MonthRow = {
  year: number;
  month: number;
  total_cents: number;
  essential_cents: number;
  non_essential_cents: number;
  categories: CategorySummary[];
  people: PersonSummary[];
};

type ColDef = { id: string; label: string };

// ─── Exported utility functions (also unit-tested) ───────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatMonthLabel(
  year: number, month: number,
  currentYear: number, currentMonth: number,
): string {
  if (year === currentYear && month === currentMonth) {
    return `MTD (${MONTH_NAMES[month - 1]} ${year})`;
  }
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function buildColumnOrder(
  selected: Set<string>,
  categories: { id: string; name: string }[],
  people: { id: string; name: string }[],
): ColDef[] {
  const cols: ColDef[] = [];

  // Categories — sorted alphabetically, only if selected
  [...categories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => selected.has(c.id))
    .forEach((c) => cols.push({ id: c.id, label: c.name }));

  // People — sorted alphabetically, only if selected
  [...people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((p) => selected.has(p.id))
    .forEach((p) => cols.push({ id: p.id, label: p.name }));

  // Essentials / Non-essentials — only if selected
  if (selected.has("ess"))     cols.push({ id: "ess",     label: "Essentials" });
  if (selected.has("non_ess")) cols.push({ id: "non_ess", label: "Non-ess." });

  // Total always last
  cols.push({ id: "total", label: "Total" });

  return cols;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return formatCAD(BigInt(Math.trunc(cents))).replace("CA$", "$");
}

function cellValue(col: ColDef, row: MonthRow): string {
  if (col.id === "total")   return fmt(row.total_cents);
  if (col.id === "ess")     return fmt(row.essential_cents);
  if (col.id === "non_ess") return fmt(row.non_essential_cents);
  const cat = row.categories.find((c) => c.id === col.id);
  if (cat) return fmt(cat.spent_cents);
  const person = row.people.find((p) => p.id === col.id);
  if (person) return fmt(person.spent_cents);
  return "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  rows: MonthRow[];
  allCategories: { id: string; name: string }[];
  allPeople: { id: string; name: string }[];
  currentYear: number;
  currentMonth: number;
};

const DEFAULT_SELECTED = new Set(["ess", "non_ess"]);

export function MonthlyComparisonClient({
  rows,
  allCategories,
  allPeople,
  currentYear,
  currentMonth,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const columns = buildColumnOrder(selected, allCategories, allPeople);

  if (rows.length === 0) {
    return <p className="text-sm text-muted px-4">No data yet.</p>;
  }

  return (
    <div className="px-4">
      {/* Column picker trigger */}
      <div className="flex justify-end mb-3 relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            panelOpen
              ? "bg-ink text-white"
              : "bg-surface shadow-sm text-ink-2 hover:bg-surface-soft"
          }`}
        >
          ⊞ Columns
        </button>

        {panelOpen && (
          <div className="absolute top-9 right-0 z-20 bg-surface border border-border rounded-2xl shadow-lg p-3 w-52">
            <PickerGroup label="Categories">
              {allCategories.map((c) => (
                <Pill key={c.id} label={c.name} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </PickerGroup>
            <PickerGroup label="Per person">
              {allPeople.map((p) => (
                <Pill key={p.id} label={p.name} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
              ))}
            </PickerGroup>
            <PickerGroup label="Defaults">
              <Pill label="Essentials"     selected={selected.has("ess")}     onToggle={() => toggle("ess")} />
              <Pill label="Non-essentials" selected={selected.has("non_ess")} onToggle={() => toggle("non_ess")} />
            </PickerGroup>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs font-mono">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 bg-ink text-white rounded-tl-lg whitespace-nowrap">Month</th>
              {columns.map((col, i) => (
                <th
                  key={col.id}
                  className={`text-right px-2 py-2 bg-ink text-white whitespace-nowrap ${
                    i === columns.length - 1 ? "rounded-tr-lg" : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isMtd = row.year === currentYear && row.month === currentMonth;
              const isAlt = ri % 2 === 1;
              return (
                <tr
                  key={`${row.year}-${row.month}`}
                  className={
                    isMtd
                      ? "bg-yellow-100 font-semibold"
                      : isAlt
                      ? "bg-surface-soft"
                      : "bg-surface"
                  }
                >
                  <td className="px-2 py-2 text-ink whitespace-nowrap">
                    {formatMonthLabel(row.year, row.month, currentYear, currentMonth)}
                  </td>
                  {columns.map((col) => (
                    <td key={col.id} className="px-2 py-2 text-right text-ink tabular-nums">
                      {cellValue(col, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PickerGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[9px] font-mono uppercase tracking-[1.4px] text-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Pill({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
        selected
          ? "bg-ink text-white border-ink"
          : "bg-surface text-ink-2 border-border hover:bg-surface-soft"
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Run tests — expect PASS**

```bash
npm run test:unit -- tests/unit/monthly-comparison.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/reports/MonthlyComparisonClient.tsx tests/unit/monthly-comparison.test.ts
git commit -m "feat: add MonthlyComparisonClient with column picker"
```

---

## Task 4: Server page

**Files:**
- Create: `app/(app)/reports/monthly/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  MonthlyComparisonClient,
  type MonthRow,
  type CategorySummary,
  type PersonSummary,
} from "@/components/reports/MonthlyComparisonClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly · Budget" };

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const { data } = await supabase.rpc("monthly_expense_comparison", {
    p_today: now.toISOString().slice(0, 10),
  });

  const rows = (data ?? []) as MonthRow[];

  // Collect the union of all categories and people across all months
  const categoryMap = new Map<string, string>();
  const peopleMap   = new Map<string, string>();
  for (const row of rows) {
    for (const c of (row.categories as CategorySummary[])) categoryMap.set(c.id, c.name);
    for (const p of (row.people   as PersonSummary[]))   peopleMap.set(p.id, p.name);
  }

  const allCategories = [...categoryMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const allPeople = [...peopleMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <MonthlyComparisonClient
      rows={rows}
      allCategories={allCategories}
      allPeople={allPeople}
      currentYear={currentYear}
      currentMonth={currentMonth}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/reports/monthly/page.tsx
git commit -m "feat: add monthly reports server page"
```

---

## Task 5: Add tab to ReportsNav

**Files:**
- Modify: `components/reports/ReportsNav.tsx`

- [ ] **Step 1: Add Monthly tab entry**

In `components/reports/ReportsNav.tsx`, update the TABS array:

```ts
const TABS = [
  { href: "/reports/spend-over-time", label: "Spend" },
  { href: "/reports/cashflow",        label: "Cashflow" },
  { href: "/reports/per-person",      label: "Per-person" },
  { href: "/reports/essentials",      label: "Essentials" },
  { href: "/reports/monthly",         label: "Monthly" },
];
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run typecheck && npm run lint
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify manually**

```bash
npm run dev
```

Open http://localhost:3023/reports/monthly. Verify:
- "Monthly" tab appears in the nav and is active when on that route
- Table renders with Month, Essentials, Non-Essentials, Total columns by default
- MTD row is highlighted in amber
- History rows alternate shading
- "⊞ Columns" button appears top-right
- Clicking the button opens the floating panel
- Clicking it again closes it
- Clicking outside the panel closes it
- Toggling a category pill adds/removes that column in the correct position
- Toggling Essentials or Non-Essentials in the Defaults group adds/removes those columns
- Table scrolls horizontally when many columns are active

- [ ] **Step 4: Commit**

```bash
git add components/reports/ReportsNav.tsx
git commit -m "feat: add Monthly tab to reports nav"
```
