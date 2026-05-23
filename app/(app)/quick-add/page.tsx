import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";
import { QuickAddTabs } from "./QuickAddTabs";
import type { QuickAddTileData } from "@/components/quick-add/QuickAddTile";

export const metadata = { title: "Quick Add · Budget" };
export const dynamic = "force-dynamic";

type RawOption = Omit<QuickAddTileData, "amount_cents"> & {
  amount_cents: number | string;
};

export default async function QuickAddPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_quick_add_options", {
    p_limit: 12,
  });

  const options: QuickAddTileData[] = error
    ? []
    : (data ?? []).map((r: RawOption) => ({
        ...r,
        amount_cents: BigInt(
          typeof r.amount_cents === "string"
            ? r.amount_cents
            : Math.trunc(r.amount_cents),
        ),
      }));

  const recent = options.filter((o) => o.source === "recent");
  const subscriptions = options.filter((o) => o.source === "subscription");

  return (
    <div className="pt-3 pb-16">
      <AppBar
        left={<MenuButton />}
        right={
          <Link href="/add" aria-label="Open full add form">
            <IconButton icon={Icon.plus(18)} aria-label="Open full add form" />
          </Link>
        }
      />
      <PageTitle title="Quick Add" subtitle="One tap to re-log" />
      <QuickAddTabs recent={recent} subscriptions={subscriptions} />
    </div>
  );
}
