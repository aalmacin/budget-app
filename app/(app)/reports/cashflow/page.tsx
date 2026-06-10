import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatCAD } from "@/lib/money";
import { RangeSelector, type ReportRange } from "@/components/reports/RangeSelector";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cashflow · Budget" };

type KPIs = {
  income_cents: number | string;
  expense_cents: number | string;
  net_cents: number | string;
  avg_daily_spend_cents: number | string;
  largest_expense: { merchant: string; amount_cents: number | string; occurred_on: string } | null;
  top_category: { name: string; spent_cents: number | string } | null;
  insights: string[];
};

const VALID_RANGES: ReportRange[] = ["mtd", "30d", "90d", "ytd"];

const RANGE_LABELS: Record<ReportRange, string> = {
  mtd: "MTD",
  "30d": "30d",
  "90d": "90d",
  ytd: "YTD",
};

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

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

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("cashflow_kpis", { p_range: range, p_today: todayEdmonton });
  const kpi = (data ?? {}) as Partial<KPIs>;

  return (
    <div className="px-4 space-y-3">
      <RangeSelector current={range} />
      <div className="grid grid-cols-2 gap-3">
        <Stat label={`Income (${RANGE_LABELS[range]})`} value={formatCAD(toBig(kpi.income_cents ?? 0))} />
        <Stat label={`Expense (${RANGE_LABELS[range]})`} value={formatCAD(toBig(kpi.expense_cents ?? 0))} />
        <Stat label="Net" value={formatCAD(toBig(kpi.net_cents ?? 0))} />
        <Stat label="Avg daily" value={formatCAD(toBig(kpi.avg_daily_spend_cents ?? 0))} />
      </div>

      {kpi.largest_expense && (
        <Card label="Largest expense">
          {kpi.largest_expense.merchant} · {formatCAD(toBig(kpi.largest_expense.amount_cents))}
          <span className="text-faint"> · {kpi.largest_expense.occurred_on}</span>
        </Card>
      )}
      {kpi.top_category && (
        <Card label="Top category">
          {kpi.top_category.name} · {formatCAD(toBig(kpi.top_category.spent_cents))}
        </Card>
      )}
      {kpi.insights && kpi.insights.length > 0 && (
        <Card label="Insights">
          <ul className="list-disc pl-4 space-y-1">
            {kpi.insights.map((s, i) => (
              <li key={i} className="text-sm text-ink">{s}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">{label}</div>
      <div className="font-mono text-base text-ink">{value.replace("CA$", "$")}</div>
    </div>
  );
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-sm">
      <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted mb-1">{label}</div>
      <div className="text-sm text-ink">{children}</div>
    </div>
  );
}
