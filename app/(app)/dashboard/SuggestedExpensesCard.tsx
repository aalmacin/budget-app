"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TypePill } from "@/components/transactions/TypePill";
import { formatCAD } from "@/lib/money";
import { dismissExpenseSuggestionAction } from "./actions";

export type SuggestionRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  occurred_on: string;
  category_name: string | null;
  subscription_id: string | null;
  subscription_merchant: string | null;
  notes: string;
};

function reviewHref(r: SuggestionRow): string {
  // Linked to an active recurring expense → log it through that flow so the
  // renewal advances and it also clears from Due recurring.
  return r.subscription_id
    ? `/recurring-transactions/${r.subscription_id}/add?suggestion=${r.id}`
    : `/add?suggestion=${r.id}`;
}

export function SuggestedExpensesCard({ rows }: { rows: SuggestionRow[] }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dismiss = (id: string) => {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      const res = await dismissExpenseSuggestionAction(id);
      if (res.error) setError(res.error);
      setBusyId(null);
    });
  };

  return (
    <div className="mx-4 mb-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-sage/20">
      <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-sage mb-2">
        Suggested expenses · {rows.length}
      </div>
      <ul className="divide-y divide-line/40">
        {rows.map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3">
            <TypePill type="expense" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate" title={r.notes || undefined}>
                {r.merchant}
              </div>
              <div className="text-[11px] text-faint truncate">
                {r.category_name ?? "No category"} · {r.occurred_on}
                {r.subscription_merchant ? " · recurring" : ""}
              </div>
            </div>
            <div className="font-mono text-sm text-ink">
              {formatCAD(r.amount_cents).replace("CA$", "$")}
            </div>
            <Link
              href={reviewHref(r)}
              className="inline-flex items-center px-3 h-9 rounded-2xl bg-sage text-white text-xs"
            >
              Review
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => dismiss(r.id)}
              disabled={pending}
            >
              {pending && busyId === r.id ? "…" : "Dismiss"}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-brick">{error}</p>}
    </div>
  );
}
