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

  // Principle III: clients call RPCs, never `.from()` against household tables.
  const [{ data: initial }, { data: membersData }] = await Promise.all([
    supabase.rpc("list_transactions", {
      p_filters: { limit: 50, offset: 0 },
    }),
    supabase.rpc("list_household_members"),
  ]);

  type MemberRow = { id: string; display_name: string };
  const members = ((membersData ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
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
