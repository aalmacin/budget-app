import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/ui/PageTitle";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption,
  type ExpensePrefill,
  type ExpenseTemplateRef,
} from "./AddExpenseForm";
import type {
  CategoryRow,
  MemberRow,
  MerchantRow,
} from "@/lib/supabase/rpc-rows";

export const metadata = { title: "Add expense · Budget" };

type RawTemplate = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: "adult_a" | "adult_b" | "50_50" | "by_income" | null;
};

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;
  const templateId = sp.template ?? null;

  // Principle III: clients call RPCs, never `.from()` against household tables.
  const [{ data: categoriesData }, { data: membersData }, { data: merchantsData }] =
    await Promise.all([
      supabase.rpc("list_categories", { p_kind: "expense" }),
      supabase.rpc("list_household_members"),
      supabase.rpc("list_merchants"),
    ]);

  const categories: CategoryOption[] = ((categoriesData ?? []) as CategoryRow[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));
  const members: MemberOption[] = ((membersData ?? []) as MemberRow[]).map((m) => ({
    id: m.id,
    display_name: m.display_name,
    role: m.role,
  }));
  const merchants: string[] = ((merchantsData ?? []) as MerchantRow[])
    .map((m) => m.name)
    .filter(Boolean);

  let prefill: ExpensePrefill | null = null;
  let template: ExpenseTemplateRef | null = null;
  if (templateId) {
    const { data: tplRows } = await supabase.rpc("get_saved_expense", {
      p_id: templateId,
    });
    const tplData = ((tplRows ?? []) as RawTemplate[])[0] ?? null;
    if (tplData) {
      // Bump MRU so the tile sorts to the top next time Quick Add loads.
      await supabase.rpc("touch_saved_expense", { p_id: templateId });
      const categoryName =
        categories.find((c) => c.id === tplData.category_id)?.name ?? "";
      prefill = {
        merchant: tplData.merchant,
        amount_cents: BigInt(
          typeof tplData.amount_cents === "string"
            ? tplData.amount_cents
            : Math.trunc(tplData.amount_cents),
        ),
        category_id: tplData.category_id,
        category_name: categoryName,
        paid_by_member_id: tplData.paid_by_member_id,
        for_member_id: tplData.for_member_id,
        essential_pct: tplData.essential_pct,
        split_rule: tplData.split_rule,
      };
      template = { id: tplData.id, merchant: tplData.merchant };
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle
        title={template ? `Add expense (from ${template.merchant})` : "Add expense"}
        subtitle="Money out"
      />
      <AddExpenseForm
        categories={categories}
        members={members}
        merchants={merchants}
        todayIso={today}
        prefill={prefill}
        template={template}
      />
    </div>
  );
}
