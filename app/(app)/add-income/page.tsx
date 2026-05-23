import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddIncomeForm, type AdultOption } from "./AddIncomeForm";

export const metadata = { title: "Add income · Budget" };

export default async function AddIncomePage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: incomeCat }, { data: adultsData }] = await Promise.all([
    supabase
      .from("category")
      .select("id")
      .eq("kind", "income")
      .is("household_id", null)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("household_member")
      .select("id, display_name")
      .eq("role", "adult")
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  const adults: AdultOption[] = (adultsData ?? []).map((a) => ({
    id: a.id as string,
    display_name: a.display_name as string,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const incomeCategoryId = (incomeCat?.id as string | undefined) ?? null;

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
