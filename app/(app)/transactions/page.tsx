import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import { FAB } from "@/components/ui/FAB";
import { Icon } from "@/components/ui/icons";
import { FilterChips } from "@/components/transactions/FilterChips";
import { TransactionsList } from "./TransactionsList";

export const metadata = { title: "Transactions · Budget" };
export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: initial }, { data: membersData }] = await Promise.all([
    supabase.rpc("list_transactions", { p_filters: { limit: 100 } }),
    supabase
      .from("household_member")
      .select("id, display_name")
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  const members = (membersData ?? []).map((m) => ({
    id: m.id as string,
    display_name: m.display_name as string,
  }));

  return (
    <div className="pt-3 pb-32 relative">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Transactions" />
      <FilterChips members={members} />
      <div className="mt-3">
        <TransactionsList initial={initial ?? []} />
      </div>
      <FAB href="/quick-add" icon={Icon.plus(20)} />
    </div>
  );
}
