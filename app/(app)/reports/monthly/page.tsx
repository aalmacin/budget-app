import {
  MonthlyComparisonClient,
  type MonthRow,
  type CategorySummary,
  type PersonSummary,
} from "@/components/reports/MonthlyComparisonClient";
import { getCurrentHousehold, cachedMonthlyExpenseComparison } from "@/lib/supabase/cache";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monthly · Budget" };

export default async function Page() {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const today = now.toISOString().slice(0, 10);

  const householdId = await getCurrentHousehold();
  const data = householdId ? await cachedMonthlyExpenseComparison(householdId, today) : [];

  const rows = (data ?? []) as MonthRow[];

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
