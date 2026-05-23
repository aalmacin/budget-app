import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { SubscriptionsClient, type SubscriptionRow, type Overlap } from "./SubscriptionsClient";

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

type RawOverlap = {
  category_name: string;
  count: number;
  monthly_total_cents: number | string;
};

export default async function SubscriptionsPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: subsData }, { data: overlapData }, { data: categoriesData }] =
    await Promise.all([
      supabase
        .from("subscription")
        .select("id, merchant, amount_cents, cadence, next_renewal_at, active, category_id")
        .order("next_renewal_at"),
      supabase.rpc("list_overlapping_subscriptions"),
      supabase
        .from("category")
        .select("id, name")
        .eq("kind", "expense")
        .order("name"),
    ]);

  const categoryMap = new Map<string, string>(
    (categoriesData ?? []).map((c) => [c.id as string, c.name as string]),
  );

  const subscriptions: SubscriptionRow[] = ((subsData ?? []) as RawSub[]).map((s) => ({
    id: s.id,
    merchant: s.merchant,
    amount_cents: BigInt(typeof s.amount_cents === "string" ? s.amount_cents : s.amount_cents),
    cadence: s.cadence,
    next_renewal_at: s.next_renewal_at,
    active: s.active,
    category_name: categoryMap.get(s.category_id) ?? "—",
  }));

  const overlaps: Overlap[] = ((overlapData ?? []) as RawOverlap[]).map((o) => ({
    category_name: o.category_name,
    count: o.count,
    monthly_total_cents: BigInt(typeof o.monthly_total_cents === "string" ? o.monthly_total_cents : o.monthly_total_cents),
  }));

  const categories = (categoriesData ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));

  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Subscriptions" subtitle="Recurring expenses" />
      <SubscriptionsClient
        subscriptions={subscriptions}
        overlaps={overlaps}
        categories={categories}
      />
    </div>
  );
}
