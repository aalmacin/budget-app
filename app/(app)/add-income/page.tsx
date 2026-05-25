import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddIncomeForm, type AdultOption } from "./AddIncomeForm";

export const metadata = { title: "Add income · Budget" };

export default async function AddIncomePage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: incomeCats }, { data: membersData }] = await Promise.all([
    supabase.rpc("list_categories", { p_kind: "income" }),
    supabase.rpc("list_household_members"),
  ]);

  type RawCategory = { id: string; name: string; household_id: string | null };
  type RawMember = { id: string; display_name: string; role: "adult" | "kid" };

  // Prefer the system-global Income seed (household_id IS NULL) so multiple
  // income transactions roll up into the same category in reports.
  const incomeCategoryId =
    ((incomeCats ?? []) as RawCategory[]).find((c) => c.household_id === null)?.id ??
    ((incomeCats ?? []) as RawCategory[])[0]?.id ??
    null;

  const adults: AdultOption[] = ((membersData ?? []) as RawMember[])
    .filter((m) => m.role === "adult")
    .map((a) => ({ id: a.id, display_name: a.display_name }));

  const today = new Date().toISOString().slice(0, 10);

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
