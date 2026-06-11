import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { BudgetClient } from "./BudgetClient";
import type { CategoryRowData } from "@/components/budget/CategoryRow";

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
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;
  const filter = (sp.filter as "all" | "essential" | "treats" | undefined) ?? "all";

  const now = new Date();
  const { data, error } = await supabase.rpc("get_budget_progress", {
    p_year: now.getFullYear(),
    p_month: now.getMonth() + 1,
    p_filter: filter,
  });

  const rows: CategoryRowData[] = error
    ? []
    : ((data ?? []) as RawRow[]).map((r) => ({
        category_id: r.category_id,
        category_name: r.category_name,
        monthly_budget_cents:
          r.monthly_budget_cents === null
            ? null
            : BigInt(typeof r.monthly_budget_cents === "string" ? r.monthly_budget_cents : r.monthly_budget_cents),
        spent_cents: BigInt(typeof r.spent_cents === "string" ? r.spent_cents : r.spent_cents),
      }));

  return (
    <div className="pt-3 pb-32">
      <AppBar />
      <PageTitle title="Budget" subtitle="Monthly limits + progress" />
      <BudgetClient rows={rows} />
    </div>
  );
}
