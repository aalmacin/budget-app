"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { RecurringFields } from "@/components/transactions/RecurringFields";
import { logIncomeAction, type LogIncomeState } from "./actions";

const INITIAL: LogIncomeState = { error: null };
const SOURCES = ["Salary", "Contract", "Self_employed", "Benefit", "Refund", "Gift"] as const;

export type AdultOption = { id: string; display_name: string };

export type IncomePrefill = {
  amount_cents: bigint;
  notes: string;
  paid_by_member_id: string;
  income_source: string;
};

export type SubmitAction = (
  prev: LogIncomeState,
  formData: FormData,
) => Promise<LogIncomeState>;

type Props = {
  incomeCategoryId: string | null;
  adults: AdultOption[];
  todayIso: string;
  prefill?: IncomePrefill | null;
  submitAction?: SubmitAction;
  submitLabel?: string;
  cancelHref?: string;
};

function centsToDollars(cents: bigint): string {
  const n = Number(cents) / 100;
  return n.toFixed(2);
}

export function AddIncomeForm({
  incomeCategoryId,
  adults,
  todayIso,
  prefill,
  submitAction,
  submitLabel,
  cancelHref,
}: Props) {
  const action = submitAction ?? logIncomeAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const [amount, setAmount] = useState(
    prefill ? centsToDollars(prefill.amount_cents) : "0.00",
  );

  const cents = (() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 100));
  })();

  if (!incomeCategoryId) {
    return (
      <p className="px-4 text-sm text-muted">
        No income category seeded — re-run migrations.
      </p>
    );
  }

  const showRecurring = submitAction === undefined;

  return (
    <form action={formAction} className="px-4 pb-32 flex flex-col gap-4" noValidate>
      <AmountHero cents={cents} label="Net amount (post-tax)" />

      <input type="hidden" name="category_id" value={incomeCategoryId} />
      <input type="hidden" name="amount_cents" value={cents.toString()} />

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">$ Amount</span>
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
        <Input type="date" name="occurred_on" defaultValue={todayIso} required />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Earner</span>
        <select
          name="paid_by_member_id"
          required
          defaultValue={prefill?.paid_by_member_id ?? ""}
          className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          {adults.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Source</span>
        <select
          name="income_source"
          required
          defaultValue={prefill?.income_source ?? "Salary"}
          className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted font-mono uppercase tracking-wider">Notes</span>
        <Input
          type="text"
          name="notes"
          maxLength={200}
          defaultValue={prefill?.notes ?? ""}
        />
      </label>

      {showRecurring && <RecurringFields todayIso={todayIso} />}

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <div className="sticky bottom-3 mt-2 -mx-4 px-4 pt-2 pb-3 bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/80 z-10 flex gap-2">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : (submitLabel ?? "Save income")}
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
