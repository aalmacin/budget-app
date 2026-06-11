import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { AddFAB } from "@/components/ui/AddFAB";
import { FilterChips } from "@/components/transactions/FilterChips";
import { TransactionsList } from "./TransactionsList";

export const metadata = { title: "Transactions · Budget" };
export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const supabase = await createSupabaseServerClient();

  // Principle III: clients call RPCs, never `.from()` against household tables.
  const [
    { data: initial },
    { data: membersData },
    { data: expenseCategoriesData },
    { data: merchantsData },
  ] = await Promise.all([
    supabase.rpc("list_transactions", {
      p_filters: { limit: 50, offset: 0 },
    }),
    supabase.rpc("list_household_members"),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_merchants"),
  ]);

  type MemberRow = { id: string; display_name: string; role: "adult" | "kid" };
  type CategoryRow = { id: string; name: string };
  type MerchantRow = { name: string };

  const members = ((membersData ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
  }));
  const filterMembers = members.map(({ id, display_name }) => ({ id, display_name }));
  const expenseCategories = ((expenseCategoriesData ?? []) as CategoryRow[])
    .map((c) => ({ id: c.id, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const merchants = ((merchantsData ?? []) as MerchantRow[])
    .map((m) => m.name)
    .filter(Boolean);

  return (
    <div className="pt-3 pb-32 relative">
      <AppBar />
      <PageTitle title="Transactions" />
      <FilterChips members={filterMembers} categories={expenseCategories} />
      <div className="mt-3">
        <TransactionsList
          initial={initial ?? []}
          members={members}
          expenseCategories={expenseCategories}
          merchants={merchants}
        />
      </div>
      <AddFAB />
    </div>
  );
}
