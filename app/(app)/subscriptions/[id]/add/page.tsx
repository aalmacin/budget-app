import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption,
  type ExpensePrefill,
} from "../../../add/AddExpenseForm";
import { logSubscriptionExpenseAction } from "../../actions";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";
import type {
  CategoryRow,
  MemberRow,
  MerchantRow,
} from "@/lib/supabase/rpc-rows";

export const metadata = { title: "Log subscription · Budget" };
export const dynamic = "force-dynamic";

type PrefillRow = {
  id: string;
  merchant: string;
  amount_cents: number | string;
  category_id: string;
  category_name: string;
  cadence: string;
  interval_days: number | null;
  next_renewal_at: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
};

export default async function SubscriptionAddPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [
    { data: prefillRows, error: prefillErr },
    { data: categoriesData },
    { data: membersData },
    { data: merchantsData },
  ] = await Promise.all([
    supabase.rpc("get_subscription_prefill", { p_id: id }),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_household_members"),
    supabase.rpc("list_merchants"),
  ]);

  const rows = (prefillRows ?? []) as PrefillRow[];
  if (prefillErr || rows.length === 0) {
    redirect("/subscriptions");
  }
  const row = rows[0];

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

  const prefill: ExpensePrefill = {
    merchant: row.merchant,
    amount_cents: BigInt(
      typeof row.amount_cents === "string"
        ? row.amount_cents
        : Math.trunc(row.amount_cents),
    ),
    category_id: row.category_id,
    category_name: row.category_name,
    paid_by_member_id: row.paid_by_member_id,
    for_member_id: row.for_member_id,
    essential_pct: row.essential_pct,
    split_rule: row.split_rule,
  };

  const today = new Date().toISOString().slice(0, 10);
  const bound = logSubscriptionExpenseAction.bind(null, id);

  return (
    <div className="pt-3">
      <AppBar left={<MenuButton />} />
      <PageTitle
        title={`Log ${row.merchant}`}
        subtitle={`Renewal was ${row.next_renewal_at}`}
      />
      <AddExpenseForm
        categories={categories}
        members={members}
        merchants={merchants}
        todayIso={today}
        prefill={prefill}
        template={null}
        submitAction={bound}
        submitLabel="Save & advance"
        cancelHref="/subscriptions"
      />
    </div>
  );
}
