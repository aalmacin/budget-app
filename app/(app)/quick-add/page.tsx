import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";
import { QuickAddTabs } from "./QuickAddTabs";
import type { QuickAddTileData } from "@/components/quick-add/QuickAddTile";
import type { SavedTileData } from "@/components/quick-add/SavedTilesGrid";

export const metadata = { title: "Quick Add · Budget" };
export const dynamic = "force-dynamic";

type RawSaved = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  category_name: string;
};

type RawSub = Omit<QuickAddTileData, "amount_cents"> & {
  amount_cents: number | string;
};

export default async function QuickAddPage() {
  const supabase = await createSupabaseServerClient();

  const [savedRes, subsRes] = await Promise.all([
    supabase.rpc("list_saved_expenses"),
    supabase.rpc("list_quick_add_options", { p_limit: 12 }),
  ]);

  const saved: SavedTileData[] = savedRes.error
    ? []
    : ((savedRes.data ?? []) as RawSaved[]).map((r) => ({
        id: r.id,
        merchant: r.merchant,
        category_id: r.category_id,
        category_name: r.category_name,
        amount_cents: BigInt(
          typeof r.amount_cents === "string"
            ? r.amount_cents
            : Math.trunc(r.amount_cents),
        ),
      }));

  const subscriptions: QuickAddTileData[] = subsRes.error
    ? []
    : ((subsRes.data ?? []) as RawSub[])
        .filter((r) => r.source === "subscription")
        .map((r) => ({
          ...r,
          for_member_ids: r.for_member_ids ?? [],
          amount_cents: BigInt(
            typeof r.amount_cents === "string"
              ? r.amount_cents
              : Math.trunc(r.amount_cents),
          ),
        }));

  return (
    <div className="pt-3 pb-16">
      <AppBar
        right={
          <Link href="/add" aria-label="Open full add form">
            <IconButton icon={Icon.plus(18)} aria-label="Open full add form" />
          </Link>
        }
      />
      <PageTitle title="Quick Add" subtitle="Tap a saved expense to log" />
      <QuickAddTabs saved={saved} subscriptions={subscriptions} />
    </div>
  );
}
