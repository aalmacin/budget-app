import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";
import {
  AddExpenseForm,
  type CategoryOption,
  type MemberOption as ExpenseMemberOption,
  type ExpensePrefill,
} from "../../../add/AddExpenseForm";
import {
  AddIncomeForm,
  type AdultOption,
  type IncomePrefill,
} from "../../../add-income/AddIncomeForm";
import { logRecurringTransactionExpenseAction, logRecurringTransactionIncomeAction } from "../../actions";
import type { SplitRule } from "@/components/transactions/SplitRuleChips";
import type { CategoryRow, MemberRow, MerchantRow } from "@/lib/supabase/rpc-rows";

export const metadata = { title: "Log recurring transaction · Budget" };
export const dynamic = "force-dynamic";

type PrefillRow = {
  id: string;
  type: "expense" | "income";
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
  income_source: string | null;
};

type IncomeCategoryRow = { id: string };

export default async function RecurringTransactionAddPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: prefillRows, error: prefillErr } = await supabase.rpc(
    "get_subscription_prefill",
    { p_id: id },
  );
  const rows = (prefillRows ?? []) as PrefillRow[];
  if (prefillErr || rows.length === 0) {
    redirect("/recurring-transactions");
  }
  const row = rows[0];

  const [
    { data: membersData },
    { data: categoriesData },
    { data: merchantsData },
    { data: incomeCategoryRows },
  ] = await Promise.all([
    supabase.rpc("list_household_members"),
    supabase.rpc("list_categories", { p_kind: "expense" }),
    supabase.rpc("list_merchants"),
    supabase.rpc("list_categories", { p_kind: "income" }),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  if (row.type === "income") {
    const adults: AdultOption[] = ((membersData ?? []) as MemberRow[])
      .filter((m) => m.role === "adult")
      .map((m) => ({ id: m.id, display_name: m.display_name }));

    const incomeCategoryId =
      ((incomeCategoryRows ?? []) as IncomeCategoryRow[])[0]?.id ?? null;

    const prefill: IncomePrefill = {
      amount_cents: BigInt(
        typeof row.amount_cents === "string"
          ? row.amount_cents
          : Math.trunc(row.amount_cents),
      ),
      // If the subscription was created without an explicit note, the migration
      // stored income_source as the merchant fallback — don't surface that as the
      // pre-filled Notes value (it would be confusing).
      notes:
        row.merchant && row.merchant !== row.income_source
          ? row.merchant
          : "",
      paid_by_member_id: row.paid_by_member_id ?? "",
      income_source: row.income_source ?? "Salary",
    };

    const bound = logRecurringTransactionIncomeAction.bind(null, id);

    return (
      <div className="pt-3">
        <AppBar left={<MenuButton />} />
        <PageTitle
          title={`Log ${row.merchant}`}
          subtitle={`Renewal was ${row.next_renewal_at}`}
        />
        <AddIncomeForm
          incomeCategoryId={incomeCategoryId}
          adults={adults}
          todayIso={today}
          prefill={prefill}
          submitAction={bound}
          submitLabel="Save & advance"
          cancelHref="/recurring-transactions"
        />
      </div>
    );
  }

  // Expense path (default).
  const categories: CategoryOption[] = ((categoriesData ?? []) as CategoryRow[])
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ id: c.id, name: c.name }));
  const members: ExpenseMemberOption[] = ((membersData ?? []) as MemberRow[]).map((m) => ({
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
  const bound = logRecurringTransactionExpenseAction.bind(null, id);

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
        cancelHref="/recurring-transactions"
      />
    </div>
  );
}
