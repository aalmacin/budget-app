import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  RecurringTransactionsClient,
  type RecurringTransactionRow,
  type DueRow,
  type UpcomingRow,
  type Overlap,
} from "./RecurringTransactionsClient";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";

export const metadata = { title: "Recurring Transactions · Budget" };
export const dynamic = "force-dynamic";

type RawSub = {
  id: string;
  type: string;
  merchant: string;
  amount_cents: number | string;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_id: string;
  income_source: string | null;
};

type RawDetailRow = {
  id: string;
  type: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  category_name: string;
  cadence: string;
  interval_days: number | null;
  next_renewal_at: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
  income_source: string | null;
};

type RawOverlap = {
  category_name: string;
  count: number | string;
  monthly_total_cents: number | string;
};

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

function asType(t: string): "expense" | "income" {
  return t === "income" ? "income" : "expense";
}

export default async function RecurringTransactionsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: subsData },
    { data: dueData },
    { data: upcomingData },
    { data: overlapData },
  ] = await Promise.all([
    supabase.rpc("list_subscriptions"),
    supabase.rpc("list_due_subscriptions"),
    supabase.rpc("list_upcoming_subscriptions"),
    supabase.rpc("list_overlapping_subscriptions"),
  ]);

  // list_subscriptions doesn't return category_name; map ids from due/upcoming
  // and let the "others" rows show the cadence label as a fallback.
  const detailById = new Map<string, RawDetailRow>();
  for (const r of ((dueData ?? []) as RawDetailRow[])) detailById.set(r.id, r);
  for (const r of ((upcomingData ?? []) as RawDetailRow[])) detailById.set(r.id, r);

  const dueIds = new Set<string>(((dueData ?? []) as RawDetailRow[]).map((r) => r.id));
  const upcomingIds = new Set<string>(((upcomingData ?? []) as RawDetailRow[]).map((r) => r.id));

  const allRows = ((subsData ?? []) as RawSub[])
    .slice()
    .sort((a, b) => a.next_renewal_at.localeCompare(b.next_renewal_at))
    .map<RecurringTransactionRow>((s) => ({
      id: s.id,
      type: asType(s.type),
      merchant: s.merchant,
      amount_cents: toBig(s.amount_cents),
      cadence: s.cadence,
      next_renewal_at: s.next_renewal_at,
      active: s.active,
      category_name: detailById.get(s.id)?.category_name ?? "—",
      income_source: s.income_source,
    }));

  const others = allRows.filter((r) => !dueIds.has(r.id) && !upcomingIds.has(r.id));

  const dueRows: DueRow[] = ((dueData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    type: asType(r.type),
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));

  const upcomingRows: UpcomingRow[] = ((upcomingData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    type: asType(r.type),
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
    income_source: r.income_source,
  }));

  const overlaps: Overlap[] = ((overlapData ?? []) as RawOverlap[]).map((o) => ({
    category_name: o.category_name,
    count: typeof o.count === "string" ? Number(o.count) : o.count,
    monthly_total_cents: toBig(o.monthly_total_cents),
  }));

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Recurring Transactions" subtitle="Recurring expenses and income" />
      <RecurringTransactionsClient
        due={dueRows}
        upcoming={upcomingRows}
        others={others}
        overlaps={overlaps}
      />
    </div>
  );
}
