import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { SubscriptionsClient, type SubscriptionRow, type DueRow, type UpcomingRow, type Overlap } from "./SubscriptionsClient";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";
import type { CategoryRow, MerchantRow } from "@/lib/supabase/rpc-rows";

export const metadata = { title: "Subscriptions · Budget" };
export const dynamic = "force-dynamic";

type RawSub = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_id: string;
};

type RawDetailRow = {
  id: string;
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
};

type RawOverlap = {
  category_name: string;
  count: number | string;
  monthly_total_cents: number | string;
};

function toBig(v: number | string): bigint {
  return BigInt(typeof v === "string" ? v : Math.trunc(v));
}

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: subsData },
    { data: dueData },
    { data: upcomingData },
    { data: overlapData },
    { data: categoriesData },
    { data: merchantsData },
  ] = await Promise.all([
    supabase.rpc("list_subscriptions"),
    supabase.rpc("list_due_subscriptions"),
    supabase.rpc("list_upcoming_subscriptions"),
    supabase.rpc("list_overlapping_subscriptions"),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_merchants"),
  ]);

  const categoryRows = (categoriesData ?? []) as CategoryRow[];
  const categoryMap = new Map<string, string>(
    categoryRows.map((c) => [c.id, c.name]),
  );

  const dueIds = new Set<string>(((dueData ?? []) as RawDetailRow[]).map((r) => r.id));
  const upcomingIds = new Set<string>(((upcomingData ?? []) as RawDetailRow[]).map((r) => r.id));

  const allRows = ((subsData ?? []) as RawSub[])
    .slice()
    .sort((a, b) => a.next_renewal_at.localeCompare(b.next_renewal_at))
    .map<SubscriptionRow>((s) => ({
      id: s.id,
      merchant: s.merchant,
      amount_cents: toBig(s.amount_cents),
      cadence: s.cadence,
      next_renewal_at: s.next_renewal_at,
      active: s.active,
      category_name: categoryMap.get(s.category_id) ?? "—",
    }));

  const others = allRows.filter((r) => !dueIds.has(r.id) && !upcomingIds.has(r.id));

  const dueRows: DueRow[] = ((dueData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
  }));

  const upcomingRows: UpcomingRow[] = ((upcomingData ?? []) as RawDetailRow[]).map((r) => ({
    id: r.id,
    merchant: r.merchant,
    amount_cents: toBig(r.amount_cents),
    cadence: r.cadence,
    next_renewal_at: r.next_renewal_at,
    category_name: r.category_name,
  }));

  const overlaps: Overlap[] = ((overlapData ?? []) as RawOverlap[]).map((o) => ({
    category_name: o.category_name,
    count: typeof o.count === "string" ? Number(o.count) : o.count,
    monthly_total_cents: toBig(o.monthly_total_cents),
  }));

  const categories = categoryRows
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));

  const merchants: string[] = ((merchantsData ?? []) as MerchantRow[])
    .map((m) => m.name)
    .filter(Boolean);

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Subscriptions" subtitle="Recurring expenses" />
      <SubscriptionsClient
        due={dueRows}
        upcoming={upcomingRows}
        others={others}
        overlaps={overlaps}
        categories={categories}
        merchants={merchants}
      />
    </div>
  );
}
