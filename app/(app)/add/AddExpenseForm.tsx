"use client";

import Link from "next/link";
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

/** Field values used to prefill the form. Shared between the saved-template
 *  flow and the subscription "Add" flow — both supply the same shape. */
export type ExpensePrefill = {
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  category_name: string;
  paid_by_member_id: string | null;
  for_member_id: string | null;
  essential_pct: number;
  split_rule: SplitRule | null;
};

/** When set, the form renders the "Override saved values" template-specific
 *  controls and a hidden template_id input. Subscription mode passes null. */
export type ExpenseTemplateRef = {
  id: string;
  merchant: string;
};

export type SubmitAction = (
  prev: LogExpenseState,
  formData: FormData,
) => Promise<LogExpenseState>;

type Props = {
  categories: CategoryOption[];
  members: MemberOption[];
  merchants: string[];
  todayIso: string;
  prefill: ExpensePrefill | null;
  template: ExpenseTemplateRef | null;
  /** Defaults to logExpenseAction. */
  submitAction?: SubmitAction;
  /** Defaults to "Save expense". */
  submitLabel?: string;
  /** When set, renders a Cancel link to this href next to submit. */
  cancelHref?: string;
};

function centsToDollars(cents: bigint): string {
  const n = Number(cents) / 100;
  return n.toFixed(2);
}

export function AddExpenseForm({
  categories,
  members,
  merchants,
  todayIso,
  prefill,
  template,
  submitAction,
  submitLabel,
  cancelHref,
}: Props) {
  const action = submitAction ?? logExpenseAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [amount, setAmount] = useState(
    prefill ? centsToDollars(prefill.amount_cents) : "0.00",
  );
  const [forMember, setForMember] = useState<string | null>(
    prefill?.for_member_id ?? null,
  );
  const [essentialPct, setEssentialPct] = useState<number>(
    prefill?.essential_pct ?? 100,
  );
  const [splitRule, setSplitRule] = useState<SplitRule | null>(
    prefill?.split_rule ?? null,
  );
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [overrideTemplate, setOverrideTemplate] = useState(false);

  // Template UI only renders in the default submit-action path; if the caller
  // overrode submitAction (subscription flow) we hide it because save-as-template
  // and override-template wouldn't fire anyway.
  const showTemplateUI = submitAction === undefined;

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
          defaultValue={prefill?.category_name ?? ""}
          onCreate={createExpenseCategoryAction}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Merchant / notes</span>
        <MerchantCombobox merchants={merchants} defaultValue={prefill?.merchant ?? ""} />
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
            uniquely identify the payer. For 50_50/by_income/null, fall back to
            the prefill's explicit paid_by_member_id when present — otherwise
            leave empty (shared). */}
        <input
          type="hidden"
          name="paid_by_member_id"
          value={
            splitRule === "adult_a"
              ? adults[0]?.id ?? ""
              : splitRule === "adult_b"
                ? adults[1]?.id ?? ""
                : prefill?.paid_by_member_id ?? ""
          }
        />
      </div>

      {showTemplateUI && template ? (
        <>
          <input type="hidden" name="template_id" value={template.id} />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="override_template"
              checked={overrideTemplate}
              onChange={(e) => setOverrideTemplate(e.target.checked)}
              className="h-4 w-4"
            />
            Override saved values for &ldquo;{template.merchant}&rdquo;
          </label>
        </>
      ) : showTemplateUI ? (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="save_as_template"
            checked={saveAsTemplate}
            onChange={(e) => setSaveAsTemplate(e.target.checked)}
            className="h-4 w-4"
          />
          Save as template
        </label>
      ) : null}

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-3 mt-2 -mx-4 px-4 pt-2 pb-3 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 z-10 flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : (submitLabel ?? "Save expense")}
        </Button>
        {cancelHref && (
          <Link
            href={cancelHref}
            className="inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface text-ink shadow-sm hover:bg-surface-soft h-13 px-5 text-base rounded-2xl"
          >
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
