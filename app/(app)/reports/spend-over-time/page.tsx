import { SpendOverTimeChart } from "@/components/reports/charts";
import { RangeSelector, type ReportRange } from "@/components/reports/RangeSelector";
import { getCurrentHousehold, cachedSpendOverTime } from "@/lib/supabase/cache";

export const dynamic = "force-dynamic";
export const metadata = { title: "Spend over time · Budget" };

type RawRow = { bucket_start: string; spent_cents: number | string; income_cents: number | string };

const VALID_RANGES: ReportRange[] = ["mtd", "30d", "90d", "ytd"];

const RANGE_LABELS: Record<ReportRange, string> = {
  mtd: "Month to date",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  ytd: "Year to date",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range: ReportRange = VALID_RANGES.includes(sp.range as ReportRange)
    ? (sp.range as ReportRange)
    : "mtd";

  const todayEdmonton = new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
  const householdId = await getCurrentHousehold();
  const data = householdId ? await cachedSpendOverTime(householdId, range, todayEdmonton) : [];

  const rows = ((data ?? []) as RawRow[]).map((r) => ({
    bucket_start: r.bucket_start,
    spent_cents: Number(r.spent_cents),
    income_cents: Number(r.income_cents),
  }));

  return (
    <div className="px-4">
      <RangeSelector current={range} />
      <h2 className="text-sm font-medium text-ink mb-2">{RANGE_LABELS[range]}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No data yet.</p>
      ) : (
        <SpendOverTimeChart data={rows} />
      )}
    </div>
  );
}
