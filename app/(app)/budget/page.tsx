import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { BudgetClient } from "./BudgetClient";
import type { CategoryRowData } from "@/components/budget/CategoryRow";
import { getCurrentHousehold, cachedBudgetProgress } from "@/lib/supabase/cache";

export const metadata = { title: "Budget · Budget" };
export const dynamic = "force-dynamic";

type RawRow = {
  category_id: string;
  category_name: string;
  monthly_budget_cents: number | string | null;
  spent_cents: number | string;
};

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "essential" | "treats" | undefined) ?? "all";
  const householdId = await getCurrentHousehold();

  const now = new Date();
  const data = householdId
    ? await cachedBudgetProgress(householdId, now.getFullYear(), now.getMonth() + 1, filter)
    : [];

  const rows: CategoryRowData[] = ((data ?? []) as RawRow[]).map((r) => ({
    category_id: r.category_id,
    category_name: r.category_name,
    monthly_budget_cents:
      r.monthly_budget_cents === null
        ? null
        : BigInt(typeof r.monthly_budget_cents === "string" ? r.monthly_budget_cents : r.monthly_budget_cents),
    spent_cents: BigInt(typeof r.spent_cents === "string" ? r.spent_cents : r.spent_cents),
  }));

  return (
    <div className="pt-3 pb-16">
      <AppBar />
      <PageTitle title="Budget" subtitle="Monthly limits + progress" />
      <BudgetClient rows={rows} />
    </div>
  );
}
