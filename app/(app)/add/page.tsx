import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddExpenseForm, type CategoryOption, type MemberOption } from "./AddExpenseForm";

export const metadata = { title: "Add expense · Budget" };

export default async function AddExpensePage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: categoriesData }, { data: membersData }] = await Promise.all([
    supabase
      .from("category")
      .select("id, name")
      .eq("kind", "expense")
      .order("name"),
    supabase
      .from("household_member")
      .select("id, display_name, role")
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  const categories: CategoryOption[] = (categoriesData ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));
  const members: MemberOption[] = (membersData ?? []).map((m) => ({
    id: m.id as string,
    display_name: m.display_name as string,
    role: m.role as "adult" | "kid",
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Add expense" subtitle="Money out" />
      <AddExpenseForm categories={categories} members={members} todayIso={today} />
    </div>
  );
}
