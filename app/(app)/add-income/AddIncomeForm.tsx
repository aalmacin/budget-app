"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountHero } from "@/components/ui/AmountHero";
import { logIncomeAction, type LogIncomeState } from "./actions";

const INITIAL: LogIncomeState = { error: null };
const SOURCES = ["Salary", "Contract", "Self_employed", "Benefit", "Refund", "Gift"] as const;

export type AdultOption = { id: string; display_name: string };

type Props = {
  incomeCategoryId: string | null;
  adults: AdultOption[];
  todayIso: string;
};

export function AddIncomeForm({ incomeCategoryId, adults, todayIso }: Props) {
  const [state, formAction, pending] = useActionState(logIncomeAction, INITIAL);
  const [amount, setAmount] = useState("0.00");

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
          defaultValue="Salary"
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
        <Input type="text" name="notes" maxLength={200} />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-brick">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save income"}
      </Button>
    </form>
  );
}
