# Adult Display Name Editing + Transaction-Based Income Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `monthly_income_cents`-based income entry on the family page with (a) editable display names for adults and (b) income split ratios derived from rolling 12-month income transactions.

**Architecture:** A new migration adds `update_member_display_name` RPC and rewrites `compute_income_split` + `apply_split_rule` to read from `transaction` rows instead of `monthly_income_cents`. TypeScript types and UI components are updated to match. No destructive schema changes — `monthly_income_cents` column stays but is no longer surfaced.

**Tech Stack:** Next.js App Router, Supabase (SECURITY DEFINER RPCs), TypeScript, Vitest (unit tests)

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260606000003_adult_display_name_and_txn_income_split.sql` | CREATE (new migration) |
| `lib/split.ts` | Modify — rename `monthlyIncomeCents` → `incomeCents` on `Adult` type |
| `tests/unit/split.test.ts` | Modify — rename field in test fixtures |
| `app/(app)/family/actions.ts` | Modify — add `updateDisplayNameAction`, remove `updateIncomeAction` |
| `components/family/MemberCard.tsx` | Modify — replace income UI with display name edit, update type |
| `app/(app)/family/FamilyClient.tsx` | Modify — wire `onSaveDisplayName`, remove income action |
| `app/(app)/family/page.tsx` | Modify — remove `monthly_income_cents` from adults mapping |
| `app/(app)/settings/page.tsx` | Modify — update empty-state copy, remove `monthly_income_cents` from type |

---

### Task 1: New migration — RPCs for display name + transaction-based income split

**Files:**
- Create: `supabase/migrations/20260606000003_adult_display_name_and_txn_income_split.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 1. New RPC: update an adult's display name.
CREATE OR REPLACE FUNCTION public.update_member_display_name(
  p_member_id   UUID,
  p_display_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_household_id UUID := public.get_current_household();
BEGIN
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'No household' USING ERRCODE = 'P0001';
  END IF;
  IF p_display_name IS NULL OR length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'Display name is required' USING ERRCODE = '22023';
  END IF;
  IF length(trim(p_display_name)) > 100 THEN
    RAISE EXCEPTION 'Display name must be at most 100 characters' USING ERRCODE = '22023';
  END IF;

  UPDATE public.household_member
     SET display_name = trim(p_display_name)
   WHERE id = p_member_id
     AND household_id = v_household_id
     AND deleted_at IS NULL;
END;
$$;

ALTER FUNCTION public.update_member_display_name(UUID, TEXT) OWNER TO budget_function_owner;
REVOKE ALL ON FUNCTION public.update_member_display_name(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_display_name(UUID, TEXT) TO authenticated;

-- 2. Rewrite compute_income_split to derive income from rolling 12-month
--    income transactions instead of monthly_income_cents.
--    Adds income_cents to the return type so apply_split_rule can use it
--    for tie-breaking without querying household_member directly.
CREATE OR REPLACE FUNCTION public.compute_income_split(p_household_id uuid)
RETURNS TABLE(adult_id uuid, ratio numeric(10,8), display_order int, income_cents bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH adults AS (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY created_at, id) AS display_order
    FROM public.household_member
    WHERE household_id = p_household_id
      AND role = 'adult'
      AND deleted_at IS NULL
  ),
  income AS (
    SELECT paid_by_member_id AS adult_id,
           COALESCE(SUM(amount_cents), 0) AS income_cents
    FROM public.transaction
    WHERE household_id = p_household_id
      AND type = 'income'
      AND occurred_on >= CURRENT_DATE - INTERVAL '365 days'
    GROUP BY paid_by_member_id
  ),
  adults_with_income AS (
    SELECT a.id, a.display_order,
           COALESCE(i.income_cents, 0)::bigint AS income_cents
    FROM adults a
    LEFT JOIN income i ON i.adult_id = a.id
  ),
  total AS (SELECT SUM(income_cents) AS t FROM adults_with_income)
  SELECT
    a.id AS adult_id,
    CASE
      WHEN (SELECT t FROM total) = 0
        THEN (1.0 / NULLIF((SELECT COUNT(*) FROM adults_with_income), 0))::numeric(10,8)
      ELSE (a.income_cents::numeric / (SELECT t FROM total))::numeric(10,8)
    END AS ratio,
    a.display_order::int,
    a.income_cents
  FROM adults_with_income a;
$$;

REVOKE ALL ON FUNCTION public.compute_income_split(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_income_split(uuid) TO authenticated;

-- 3. Rewrite apply_split_rule to use income_cents from compute_income_split
--    instead of querying monthly_income_cents from household_member.
CREATE OR REPLACE FUNCTION public.apply_split_rule(p_transaction_id uuid)
RETURNS TABLE(adult_id uuid, owed_cents bigint)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount    bigint;
  v_household uuid;
  v_rule      text;
  v_payer     uuid;
BEGIN
  SELECT amount_cents, household_id, split_rule, paid_by_member_id
    INTO v_amount, v_household, v_rule, v_payer
    FROM public.transaction WHERE id = p_transaction_id;

  IF v_amount IS NULL THEN
    RETURN;
  END IF;

  IF v_rule IS NULL THEN
    RETURN QUERY
      SELECT COALESCE(v_payer, (
        SELECT cis.adult_id FROM public.compute_income_split(v_household) cis
        ORDER BY cis.display_order LIMIT 1
      )), v_amount;
    RETURN;
  END IF;

  IF v_rule IN ('adult_a','adult_b','50_50') THEN
    RETURN QUERY
      WITH adults AS (
        SELECT cis.adult_id, cis.display_order
        FROM public.compute_income_split(v_household) cis
      ),
      ranked AS (
        SELECT a.adult_id, a.display_order,
               CASE
                 WHEN v_rule = 'adult_a' AND a.display_order = 1 THEN v_amount
                 WHEN v_rule = 'adult_b' AND a.display_order = 2 THEN v_amount
                 WHEN v_rule = '50_50' THEN (v_amount / 2)
                 ELSE 0
               END AS base
        FROM adults a
      ),
      with_residual AS (
        SELECT r.adult_id, r.display_order, r.base,
               CASE
                 WHEN v_rule = '50_50'
                      AND r.display_order = 1
                      AND (v_amount % 2) = 1
                 THEN r.base + 1
                 ELSE r.base
               END AS owed
        FROM ranked r
      )
      SELECT wr.adult_id, wr.owed::bigint
      FROM with_residual wr
      ORDER BY wr.display_order;
    RETURN;
  END IF;

  -- by_income: floor each share; residual to highest-earning adult
  -- (ties broken by display_order asc). Uses income_cents from
  -- compute_income_split (rolling 12-month transaction sum).
  RETURN QUERY
    WITH split AS (
      SELECT cis.adult_id, cis.ratio, cis.display_order, cis.income_cents AS income
      FROM public.compute_income_split(v_household) cis
    ),
    floored AS (
      SELECT s.adult_id, s.ratio, s.display_order, s.income,
             FLOOR(v_amount * s.ratio)::bigint AS base
      FROM split s
    ),
    totals AS (SELECT SUM(f.base) AS base_sum FROM floored f),
    ranked AS (
      SELECT f.adult_id, f.base, f.income, f.display_order,
             ROW_NUMBER() OVER (ORDER BY f.income DESC, f.display_order ASC) AS winner_rank
      FROM floored f
    )
    SELECT r.adult_id,
           CASE WHEN r.winner_rank = 1
                THEN r.base + (v_amount - (SELECT base_sum FROM totals))
                ELSE r.base END AS owed_cents
    FROM ranked r
    ORDER BY r.display_order;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_split_rule(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.apply_split_rule(uuid) TO authenticated;
```

- [ ] **Step 2: Apply the migration**

Apply via your normal Supabase workflow (e.g., `supabase db push` or the Supabase dashboard SQL editor). Do not run this via Claude — supabase CLI commands are excluded per project rules.

---

### Task 2: Update `lib/split.ts` — rename `monthlyIncomeCents` to `incomeCents`

The TypeScript mirror of `compute_income_split` / `apply_split_rule` uses `monthlyIncomeCents` on `Adult`. Since the source is now rolling transaction totals (not a monthly figure), rename to `incomeCents` throughout.

**Files:**
- Modify: `lib/split.ts`
- Modify: `tests/unit/split.test.ts`

- [ ] **Step 1: Update the test fixtures first (TDD — rename field, confirm tests fail)**

In `tests/unit/split.test.ts`, replace every `monthlyIncomeCents` with `incomeCents`:

```typescript
// Line 4-5 — change:
const alex: Adult = { id: "alex", incomeCents: 580_000n, displayOrder: 1 };
const bea:  Adult = { id: "bea",  incomeCents: 248_500n, displayOrder: 2 };

// Lines 19-22 — change:
const zero: Adult[] = [
  { id: "a", incomeCents: 0n, displayOrder: 1 },
  { id: "b", incomeCents: 0n, displayOrder: 2 },
];

// Lines 49-52 — change:
const zero: Adult[] = [
  { id: "a", incomeCents: 0n, displayOrder: 1 },
  { id: "b", incomeCents: 0n, displayOrder: 2 },
];
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx vitest run tests/unit/split.test.ts
```

Expected: type errors / test failures mentioning `monthlyIncomeCents`.

- [ ] **Step 3: Update `lib/split.ts`**

Replace the `Adult` type and all usages of `monthlyIncomeCents`:

```typescript
export type Adult = {
  id: string;
  /** Rolling 12-month income sum in whole cents from income transactions. Zero is allowed. */
  incomeCents: bigint;
  displayOrder: number;
};
```

In `computeIncomeSplit`, change:
```typescript
// old
const total = adults.reduce((acc, a) => acc + a.monthlyIncomeCents, 0n);
// ...
return adults.map((a) => ({
  adultId: a.id,
  numerator: a.monthlyIncomeCents,
  denominator: total,
}));
```
to:
```typescript
const total = adults.reduce((acc, a) => acc + a.incomeCents, 0n);
// ...
return adults.map((a) => ({
  adultId: a.id,
  numerator: a.incomeCents,
  denominator: total,
}));
```

In `applySplitRule`, `by_income` case, change:
```typescript
// old
income: a.monthlyIncomeCents,
```
to:
```typescript
income: a.incomeCents,
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/unit/split.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/split.ts tests/unit/split.test.ts
git commit -m "refactor: rename Adult.monthlyIncomeCents to incomeCents in split lib"
```

---

### Task 3: Add `updateDisplayNameAction`, remove `updateIncomeAction` in `actions.ts`

**Files:**
- Modify: `app/(app)/family/actions.ts`

- [ ] **Step 1: Update `actions.ts`**

Replace the entire file content:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AddAdultResult = { status?: string; error?: string };

export async function addAdultAction(email: string): Promise<AddAdultResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("add_adult_by_email", {
    p_email: email,
  });
  if (error) return { error: error.message };
  revalidatePath("/family");
  const row = Array.isArray(data) ? data[0] : data;
  return { status: (row?.status as string | undefined) ?? "inserted" };
}

export async function addKidAction(displayName: string, ageYears: number): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_kid", {
    p_display_name: displayName,
    p_age_years: ageYears,
  });
  if (error) return { error: error.message };
  revalidatePath("/family");
  return {};
}

export async function removeMemberAction(memberId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("soft_delete_member", {
    p_member_id: memberId,
  });
  if (error) return { error: error.message };
  revalidatePath("/family");
  revalidatePath("/dashboard");
  return {};
}

export async function updateDisplayNameAction(
  memberId: string,
  displayName: string,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_member_display_name", {
    p_member_id: memberId,
    p_display_name: displayName,
  });
  if (error) return { error: error.message };
  revalidatePath("/family");
  return {};
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(app)/family/actions.ts
git commit -m "feat: add updateDisplayNameAction, remove updateIncomeAction"
```

---

### Task 4: Update `MemberCard` — display name edit UI, drop income

**Files:**
- Modify: `components/family/MemberCard.tsx`

- [ ] **Step 1: Rewrite `MemberCard.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FamilyAvatar } from "@/components/ui/FamilyAvatar";

export type MemberCardData = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
  age_years: number | null;
};

type Props = {
  member: MemberCardData;
  onSaveDisplayName: (memberId: string, name: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
};

export function MemberCard({ member, onSaveDisplayName, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.display_name);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) return;
    startTransition(async () => {
      await onSaveDisplayName(member.id, trimmed);
      setEditing(false);
    });
  };

  const remove = () => {
    if (!window.confirm(`Remove ${member.display_name}?`)) return;
    startTransition(async () => onRemove(member.id));
  };

  return (
    <div className="rounded-2xl bg-surface p-3 shadow-sm flex items-center gap-3">
      <FamilyAvatar
        initial={member.display_name.charAt(0).toUpperCase()}
        tone={member.role === "adult" ? "sage" : "sand"}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{member.display_name}</div>
        {member.role === "kid" && (
          <div className="text-[11px] text-faint">
            {member.age_years ?? "?"} years old
          </div>
        )}
      </div>
      {member.role === "adult" && !editing && (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${member.display_name}`}
      >
        Remove
      </Button>
      {editing && (
        <div className="absolute inset-x-4 mt-32 bg-surface rounded-2xl p-3 shadow-lg">
          <label className="text-xs text-muted font-mono uppercase">Display name</label>
          <Input
            type="text"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={save} disabled={pending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/family/MemberCard.tsx
git commit -m "feat: replace income edit with display name edit on MemberCard"
```

---

### Task 5: Update `FamilyClient` — wire display name action

**Files:**
- Modify: `app/(app)/family/FamilyClient.tsx`

- [ ] **Step 1: Rewrite `FamilyClient.tsx`**

```typescript
"use client";

import { MemberCard, type MemberCardData } from "@/components/family/MemberCard";
import { KidGrid, type KidCardData } from "@/components/family/KidGrid";
import { AddAdultByEmail } from "@/components/family/AddAdultByEmail";
import { AddKidForm } from "@/components/family/AddKidForm";
import { formatCAD } from "@/lib/money";
import {
  addAdultAction,
  addKidAction,
  removeMemberAction,
  updateDisplayNameAction,
} from "./actions";

type Props = {
  adults: MemberCardData[];
  kids: KidCardData[];
  monthSpentOnKidsCents: bigint;
  monthLabel: string;
};

export function FamilyClient({ adults, kids, monthSpentOnKidsCents, monthLabel }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="mx-4 mt-2 rounded-3xl bg-sage text-white p-5 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-white/70">
          Spent on kids · {monthLabel}
        </div>
        <div className="font-mono text-4xl font-medium tracking-tight mt-1">
          {formatCAD(monthSpentOnKidsCents).replace("CA$", "$")}
        </div>
        <div className="text-xs text-white/70 mt-1">{kids.length} kid{kids.length === 1 ? "" : "s"}</div>
      </div>

      <section className="space-y-2">
        <h2 className="px-4 text-[11px] font-mono uppercase tracking-[1.4px] text-muted">Adults</h2>
        <div className="px-4 space-y-2">
          {adults.map((a) => (
            <MemberCard
              key={a.id}
              member={a}
              onSaveDisplayName={(id, name) => updateDisplayNameAction(id, name).then(() => undefined)}
              onRemove={(id) => removeMemberAction(id).then(() => undefined)}
            />
          ))}
        </div>
        <AddAdultByEmail onAdd={addAdultAction} />
      </section>

      <section className="space-y-2">
        <h2 className="px-4 text-[11px] font-mono uppercase tracking-[1.4px] text-muted">Kids</h2>
        <KidGrid kids={kids} onRemove={(id) => removeMemberAction(id).then(() => undefined)} />
        <AddKidForm onAdd={addKidAction} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/family/FamilyClient.tsx"
git commit -m "feat: wire updateDisplayNameAction in FamilyClient"
```

---

### Task 6: Update `family/page.tsx` — remove `monthly_income_cents` mapping

**Files:**
- Modify: `app/(app)/family/page.tsx`

- [ ] **Step 1: Remove `monthly_income_cents` from `RawMember` and adults mapping**

Change `RawMember`:
```typescript
type RawMember = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
  age_years: number | null;
};
```

Change the adults mapping:
```typescript
const adults: MemberCardData[] = members
  .filter((m) => m.role === "adult")
  .map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: "adult",
    age_years: null,
  }));
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/family/page.tsx"
git commit -m "feat: remove monthly_income_cents from family page adults mapping"
```

---

### Task 7: Update `settings/page.tsx` — empty-state copy + remove `monthly_income_cents`

**Files:**
- Modify: `app/(app)/settings/page.tsx`

- [ ] **Step 1: Update `MemberRow` type and empty-state copy**

Change `MemberRow`:
```typescript
type MemberRow = { id: string; display_name: string; role?: string };
```

Change the empty-state paragraph (line ~62):
```tsx
<p className="text-sm text-muted mt-2">Add income transactions first.</p>
```

- [ ] **Step 2: Commit**

```bash
git add "app/(app)/settings/page.tsx"
git commit -m "feat: update settings income-split empty state copy, remove monthly_income_cents type"
```

---

### Task 8: Type-check and verify

- [ ] **Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Start dev server and verify family page**

```bash
npm run dev
```

Navigate to `/family`. Verify:
- Each adult card has an "Edit" button.
- Clicking "Edit" shows a text input pre-populated with the adult's current name.
- Saving updates the name and closes the popup.
- No income amount shown anywhere on adult cards.
- Kids still show age sub-line.
- Remove button still works for both adults and kids.

Navigate to `/settings`. Verify:
- Income-split section shows percentages (populated from income transactions if any exist, equal split if none).
- Empty state reads "Add income transactions first." if no splits are available.
