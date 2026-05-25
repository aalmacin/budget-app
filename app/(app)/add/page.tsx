import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { AddExpenseForm, type CategoryOption, type MemberOption } from "./AddExpenseForm";

export const metadata = { title: "Add expense · Budget" };

export default async function AddExpensePage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: categoriesData }, { data: membersData }] = await Promise.all([
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_household_members"),
  ]);

  type RawCategory = { id: string; name: string };
  type RawMember = { id: string; display_name: string; role: "adult" | "kid" };
  const categories: CategoryOption[] = ((categoriesData ?? []) as RawCategory[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const members: MemberOption[] = ((membersData ?? []) as RawMember[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
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
