import Link from "next/link";
import { notFound } from "next/navigation";
import { AppBar } from "@/components/ui/AppBar";
import { SplitBar } from "@/components/ui/SplitBar";
import { formatCAD } from "@/lib/money";
import { ActivityRow, type ActivityRowData } from "@/components/transactions/ActivityRow";
import {
  getCurrentHousehold,
  cachedDashboardSummary,
  cachedHistoryMonthTransactions,
} from "@/lib/supabase/cache";

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type DashboardSummary = {
  essential_spent_cents: number | string;
  treats_spent_cents: number | string;
  income_month_cents: number | string;
  month_expense_cents: number | string;
};

type TxRow = {
  id: string;
  type: "expense" | "income";
  amount_cents: number | string;
  category_name: string;
  notes: string;
  for_member_display_name: string | null;
  occurred_on: string;
};

function toBig(v: number | string | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

type Params = { year: string; month: string };

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { year, month } = await params;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) return { title: "History · Budget" };
  return { title: `${MONTH_NAMES[m - 1]} ${y} · Budget` };
}

export default async function HistoryMonthPage({ params }: { params: Promise<Params> }) {
  const { year, month } = await params;
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);

  if (isNaN(y) || isNaN(m) || m < 1 || m > 12) notFound();

  const householdId = await getCurrentHousehold();

  const [summaryData, txData] = householdId
    ? await Promise.all([
        cachedDashboardSummary(householdId, y, m),
        cachedHistoryMonthTransactions(householdId, y, m),
      ])
    : [null, []];

  const summary = (summaryData ?? {}) as Partial<DashboardSummary>;

  const income = toBig(summary.income_month_cents);
  const expense = toBig(summary.month_expense_cents);
  const essential = toBig(summary.essential_spent_cents);
  const treats = toBig(summary.treats_spent_cents);

  const essentialRatio =
    essential + treats === 0n ? 0 : Number(essential) / Number(essential + treats);
  const incomeForPct = income === 0n ? 0.1 : Number(income);
  const savedPct = Math.round(Number(income - expense) / incomeForPct * 100);

  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`;

  const transactions: ActivityRowData[] = ((txData ?? []) as TxRow[]).map((r) => ({
    id: r.id,
    type: r.type,
    amount_cents: toBig(r.amount_cents),
    category_name: r.category_name,
    notes: r.notes,
    for_member_display_name: r.for_member_display_name,
    occurred_on: r.occurred_on,
  }));

  return (
    <div className="pt-3 pb-32">
      <AppBar
        right={
          <Link
            href="/history"
            className="text-xs font-mono uppercase tracking-wider text-sage"
          >
            ← History
          </Link>
        }
      />

      <div className="mx-4 mb-3 rounded-3xl bg-sage text-white p-5 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-white/70">
          Savings · {monthLabel}
        </div>
        <div className="font-mono text-4xl font-medium tracking-tight mt-1">
          {formatCAD(income - expense).replace("CA$", "$")}
        </div>
        <div className="text-xs text-white/70 mt-1">
          {savedPct}% of income
        </div>
      </div>

      <div className="mx-4 mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Net Income · {monthLabel}
          </div>
          <div className="font-mono text-lg text-ink mt-1">
            {formatCAD(income).replace("CA$", "$")}
          </div>
        </div>
        <div className="rounded-3xl bg-surface p-4 shadow-sm">
          <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Saved
          </div>
          <div className="font-mono text-lg text-ink mt-1">{savedPct}%</div>
        </div>
      </div>

      <div className="mx-4 mb-3 rounded-3xl bg-surface p-4 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
          Expenses
        </div>
        <div className="font-mono text-lg text-ink mt-1">
          {formatCAD(expense).replace("CA$", "$")}
        </div>
        <div className="border-t border-line my-3" />
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
          Essential vs treats
        </div>
        <div className="flex items-baseline justify-between mt-1">
          <div className="font-mono text-sm text-ink">
            {formatCAD(essential).replace("CA$", "$")}{" "}
            <span className="text-faint">essential</span>
          </div>
          <div className="font-mono text-sm text-ink">
            {formatCAD(treats).replace("CA$", "$")}{" "}
            <span className="text-faint">treats</span>
          </div>
        </div>
        <div className="mt-3">
          <SplitBar essential={essentialRatio} />
        </div>
      </div>

      <div className="mx-4 rounded-3xl bg-surface p-4 shadow-sm">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted mb-2">
          Activity
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No transactions this month.</p>
        ) : (
          <ul className="divide-y divide-line/40">
            {transactions.map((r) => (
              <li key={r.id}>
                <ActivityRow row={r} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
