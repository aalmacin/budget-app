import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddIncomeForm, type AdultOption } from "./AddIncomeForm";

export const metadata = { title: "Add income · Budget" };

export default async function AddIncomePage() {
  const supabase = await createSupabaseServerClient();

  // Principle III: clients call RPCs, never `.from()` against the
  // household-scoped tables (`authenticated` has no DML grants on them).
  const [{ data: categories }, { data: members }] = await Promise.all([
    supabase.rpc("list_categories", { p_kind: "income" }),
    supabase.rpc("list_household_members"),
  ]);

  type CategoryRow = { id: string; household_id: string | null; kind: string };
  type MemberRow = { id: string; role: string; display_name: string };

  const incomeSeed = ((categories ?? []) as CategoryRow[]).find(
    (c) => c.kind === "income" && c.household_id === null,
  );
  const adults: AdultOption[] = ((members ?? []) as MemberRow[])
    .filter((m) => m.role === "adult")
    .map((m) => ({ id: m.id, display_name: m.display_name }));

  const today = new Date().toISOString().slice(0, 10);
  const incomeCategoryId = incomeSeed?.id ?? null;

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Add income" subtitle="Money in (net)" />
      <AddIncomeForm
        incomeCategoryId={incomeCategoryId}
        adults={adults}
        todayIso={today}
      />
    </div>
  );
}
