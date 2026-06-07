"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import { skipSubscriptionOccurrenceAction } from "../subscriptions/actions";

export type DueRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
};

export function DueSubscriptionsCard({ rows }: { rows: DueRow[] }) {
  const [pending, startTransition] = useTransition();

  const skip = (id: string) => {
    startTransition(async () => {
      await skipSubscriptionOccurrenceAction(id);
    });
  };

  return (
    <div className="mx-4 mb-3 rounded-3xl bg-surface p-4 shadow-sm ring-1 ring-brick/20">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] font-mono uppercase tracking-[1.4px] text-brick">
          Due subscriptions · {rows.length}
        </div>
      </div>
      <ul className="divide-y divide-line/40">
        {rows.map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate">{r.merchant}</div>
              <div className="text-[11px] text-faint">
                {r.category_name} · was {r.next_renewal_at}
              </div>
            </div>
            <div className="font-mono text-sm text-ink">
              {formatCAD(r.amount_cents).replace("CA$", "$")}
            </div>
            <Link
              href={`/subscriptions/${r.id}/add`}
              className="inline-flex items-center px-3 h-9 rounded-2xl bg-sage text-white text-xs"
            >
              Add
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => skip(r.id)}
              disabled={pending}
            >
              {pending ? "…" : "Skip"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
