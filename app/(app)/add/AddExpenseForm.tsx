"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { CategoryCombobox } from "@/components/transactions/CategoryCombobox";
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
  todayIso: string;
};

export function AddExpenseForm({ categories, members, todayIso }: Props) {
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
        <Input type="text" name="notes" maxLength={200} placeholder="e.g. Whole Foods" />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Paid by</span>
        <select
          name="paid_by_member_id"
          className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          <option value="">— select —</option>
          {members.filter((m) => m.role === "adult").map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
            </option>
          ))}
        </select>
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
