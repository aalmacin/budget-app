import { Suspense } from "react";
import Link from "next/link";
import { AppBar } from "@/components/ui/AppBar";
import { SplitBar } from "@/components/ui/SplitBar";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCAD } from "@/lib/money";
import { ActivityRow, type ActivityRowData } from "@/components/transactions/ActivityRow";
import { RealtimeRefresher } from "./RealtimeRefresher";
import { DueRecurringTransactionsCard, type DueRow } from "./DueRecurringTransactionsCard";
import {
  getCurrentHousehold,
  cachedDashboardSummary,
  cachedDueSubscriptions,
} from "@/lib/supabase/cache";

type DashboardSummary = {
  balance_cents: number | string;
  left_to_spend_this_month_cents: number | string;
  essential_spent_cents: number | string;
  treats_spent_cents: number | string;
  income_month_cents: number | string;
  month_expense_cents: number | string;
  recent: ActivityRowDataRaw[];
};

type ActivityRowDataRaw = {
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

export const metadata = { title: "Dashboard · Budget" };
export const dynamic = "force-dynamic";

// --- Streaming sections ---

async function HeroSection() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = now.toLocaleString("en-CA", { month: "long" });

  const householdId = await getCurrentHousehold();
  const summaryData = householdId
    ? await cachedDashboardSummary(householdId, year, month)
    : null;

  const summary = (summaryData ?? {}) as Partial<DashboardSummary>;
  const income = toBig(summary.income_month_cents);
  const expense = toBig(summary.month_expense_cents);
  const essential = toBig(summary.essential_spent_cents);
  const treats = toBig(summary.treats_spent_cents);
  const essentialRatio =
    essential + treats === 0n ? 0 : Number(essential) / Number(essential + treats);
  const incomeForPct = income === 0n ? 0.1 : Number(income);
  const savedPct = Math.round(Number(income - expense) / incomeForPct * 100);

  return (
    <>
      {/* Sage hero — Savings */}
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

      {/* Two stat cards */}
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

      {/* Essential vs treats split */}
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
    </>
  );
}

async function RecentActivitySection() {
  const now = new Date();
  const householdId = await getCurrentHousehold();
  const summaryData = householdId
    ? await cachedDashboardSummary(householdId, now.getFullYear(), now.getMonth() + 1)
    : null;

  const summary = (summaryData ?? {}) as Partial<DashboardSummary>;
  const recent: ActivityRowData[] = (summary.recent ?? []).map((r) => ({
    id: r.id,
    type: r.type,
    amount_cents: toBig(r.amount_cents),
    category_name: r.category_name,
    notes: r.notes,
    for_member_display_name: r.for_member_display_name,
    occurred_on: r.occurred_on,
  }));

  return (
    <div className="mx-4 rounded-3xl bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
          Recent activity
        </div>
        <Link href="/transactions" className="text-xs text-sage">
          See all
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">
          No transactions yet — tap the + to add the first one.
        </p>
      ) : (
        <ul className="divide-y divide-line/40">
          {recent.map((r) => (
            <li key={r.id}>
              <ActivityRow row={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function DueSubscriptionsSection() {
  const householdId = await getCurrentHousehold();

  type RawDueRow = {
    id: string;
    type: "expense" | "income";
    merchant: string;
    amount_cents: number | string;
    category_name: string;
    cadence: string;
    next_renewal_at: string;
    income_source: string | null;
  };

  const dueSubsData = householdId ? await cachedDueSubscriptions(householdId) : [];
  const dueRows: DueRow[] = ((dueSubsData ?? []) as RawDueRow[]).map((r) => ({
    id: r.id,
    type: r.type,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));

  if (dueRows.length === 0) return null;
  return <DueRecurringTransactionsCard rows={dueRows} />;
}

async function RealtimeSection() {
  const householdId = await getCurrentHousehold();
  if (!householdId) return null;
  return <RealtimeRefresher householdId={householdId} />;
}

export default function DashboardPage() {
  return (
    <div className="pt-3 pb-32">
      <Suspense fallback={null}>
        <RealtimeSection />
      </Suspense>

      <AppBar />

      {/* Due subscriptions stream in independently */}
      <Suspense fallback={null}>
        <DueSubscriptionsSection />
      </Suspense>

      {/* Hero stats — stream in as one unit */}
      <Suspense
        fallback={
          <div className="px-4 space-y-3">
            <Skeleton className="h-28 w-full rounded-3xl" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-20 rounded-3xl" />
              <Skeleton className="h-20 rounded-3xl" />
            </div>
            <Skeleton className="h-32 w-full rounded-3xl" />
          </div>
        }
      >
        <HeroSection />
      </Suspense>

      {/* Recent activity streams in last */}
      <Suspense
        fallback={
          <div className="mx-4">
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        }
      >
        <RecentActivitySection />
      </Suspense>
    </div>
  );
}
