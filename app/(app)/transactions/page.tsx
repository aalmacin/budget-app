import { AppBar } from "@/components/ui/AppBar";
import { PageTitle } from "@/components/ui/PageTitle";
import { FilterChips } from "@/components/transactions/FilterChips";
import { TransactionsList } from "./TransactionsList";
import {
  getCurrentHousehold,
  cachedListTransactions,
  cachedListMembers,
  cachedListCategories,
  cachedListMerchants,
} from "@/lib/supabase/cache";

export const metadata = { title: "Transactions · Budget" };
export const dynamic = "force-dynamic";

/** Current-month bounds [first day, first day of next month) as YYYY-MM-DD.
 * Keeps the SSR initial fetch aligned with the filters slice default. */
function thisMonthBounds(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return { from: iso(y, m, 1), to: iso(nextY, nextM, 1) };
}

export default async function TransactionsPage() {
  const householdId = await getCurrentHousehold();
  const { from, to } = thisMonthBounds();

  const [initial, membersData, expenseCategoriesData, merchantsData] = householdId
    ? await Promise.all([
        cachedListTransactions(householdId, { from, to, limit: 50, offset: 0 }),
        cachedListMembers(householdId),
        cachedListCategories(householdId, "expense"),
        cachedListMerchants(householdId),
      ])
    : [[], [], [], []];

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
    <div className="pt-3 pb-32">
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
    </div>
  );
}
