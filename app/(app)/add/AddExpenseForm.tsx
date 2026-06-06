"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { CategoryCombobox } from "@/components/transactions/CategoryCombobox";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { ForWhomChips } from "@/components/transactions/ForWhomChips";
import { SplitSlider } from "@/components/transactions/SplitSlider";
import { SplitRuleChips, type SplitRule } from "@/components/transactions/SplitRuleChips";
import { logExpenseAction, createExpenseCategoryAction, type LogExpenseState } from "./actions";

const INITIAL: LogExpenseState = { error: null };

export type CategoryOption = { id: string; name: string };
export type MemberOption = { id: string; display_name: string; role: "adult" | "kid" };

type Props = {
  categories: CategoryOption[];
  members: MemberOption[];
  merchants: string[];
  todayIso: string;
};

export function AddExpenseForm({ categories, members, merchants, todayIso }: Props) {
  const [state, formAction, pending] = useActionState(logExpenseAction, INITIAL);
  const [amount, setAmount] = useState("0.00");
  const [forMember, setForMember] = useState<string | null>(null);
  const [essentialPct, setEssentialPct] = useState<number>(100);
  const [splitRule, setSplitRule] = useState<SplitRule | null>(null);
  const adults = members.filter((m) => m.role === "adult");
  const adultA = adults[0]?.display_name ?? "Adult A";
  const adultB = adults[1]?.display_name ?? "Adult B";

  const cents = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 100));
  })();

  return (
    <form action={formAction} className="px-4 pb-32 flex flex-col gap-4" noValidate>
      <AmountHero cents={cents} label="Amount" />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">$ Amount</span>
        <Input
          type="number"
          name="amount_cents_dollars"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <input type="hidden" name="amount_cents" value={cents.toString()} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
        <Input type="date" name="occurred_on" defaultValue={todayIso} required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Category</span>
        <CategoryCombobox
          categories={categories}
          required
          onCreate={createExpenseCategoryAction}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Merchant / notes</span>
        <MerchantCombobox merchants={merchants} />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">For whom</span>
        <ForWhomChips
          members={members}
          value={forMember}
          onChange={setForMember}
          asFormField
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Essential split</span>
        <SplitSlider
          value={essentialPct}
          onChange={setEssentialPct}
          asFormField
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">
          Paid by · split
        </span>
        <SplitRuleChips
          value={splitRule}
          onChange={setSplitRule}
          adultALabel={`${adultA} 100%`}
          adultBLabel={`${adultB} 100%`}
          asFormField
        />
        {/* paid_by_member_id is derived from the split rule: adult_a/adult_b
            uniquely identify the payer; 50_50 / by_income are shared so we
            leave it null. */}
        <input
          type="hidden"
          name="paid_by_member_id"
          value={
            splitRule === "adult_a"
              ? adults[0]?.id ?? ""
              : splitRule === "adult_b"
                ? adults[1]?.id ?? ""
                : ""
          }
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save expense"}
      </Button>
    </form>
  );
}
