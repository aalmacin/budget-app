import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SpendOverTimeChart } from "@/components/reports/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spend over time · Budget" };

type RawRow = { bucket_start: string; spent_cents: number | string; income_cents: number | string };

export default async function Page() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("spend_over_time", { p_range: "30d" });

  const rows = ((data ?? []) as RawRow[]).map((r) => ({
    bucket_start: r.bucket_start,
    spent_cents: Number(r.spent_cents),
    income_cents: Number(r.income_cents),
  }));

  return (
    <div className="px-4">
      <h2 className="text-sm font-medium text-ink mb-2">Last 30 days</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <SpendOverTimeChart data={rows} />
      )}
    </div>
  );
}
