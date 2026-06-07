"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { TypePill } from "@/components/transactions/TypePill";
import { formatCAD } from "@/lib/money";
import {
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipSubscriptionOccurrenceAction,
} from "./actions";

export type SubscriptionRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_name: string;
  income_source: string | null;
};

export type DueRow = {
  id: string;
  type: "expense" | "income";
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
  income_source: string | null;
};

export type UpcomingRow = DueRow;

export type Overlap = {
  category_name: string;
  count: number;
  monthly_total_cents: bigint;
};

type Props = {
  due: DueRow[];
  upcoming: UpcomingRow[];
  others: SubscriptionRow[];
  overlaps: Overlap[];
};

function cadenceLabel(c: string): string {
  return c === "custom_days" ? "custom" : c;
}

function rowMeta(r: { type: string; category_name: string; income_source: string | null; cadence: string }) {
  const label = r.type === "income" ? (r.income_source ?? "—") : r.category_name;
  return `${label} · ${cadenceLabel(r.cadence)}`;
}

export function SubscriptionsClient({ due, upcoming, others, overlaps }: Props) {
  const [pending, startTransition] = useTransition();

  const togglePause = (s: SubscriptionRow) => {
    startTransition(async () => {
      if (s.active) await pauseSubscriptionAction(s.id);
      else await resumeSubscriptionAction(s.id);
    });
  };

  const skipDue = (id: string) => {
    startTransition(async () => {
      await skipSubscriptionOccurrenceAction(id);
    });
  };

  return (
    <div className="px-4 space-y-3">
      {overlaps.length > 0 && (
        <div className="rounded-2xl bg-sand-soft p-3 shadow-sm">
          <div className="text-xs text-ink font-medium mb-1">Possible savings</div>
          <ul className="text-xs text-ink-2 space-y-1">
            {overlaps.map((o) => (
              <li key={o.category_name}>
                {o.count} overlapping {o.category_name} subs · review to save{" "}
                {formatCAD(o.monthly_total_cents).replace("CA$", "$")}/mo
              </li>
            ))}
          </ul>
        </div>
      )}

      {due.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-brick">
            Due now
          </h2>
          <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40 ring-1 ring-brick/20">
            {due.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · was {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
                <Link
                  href={`/subscriptions/${s.id}/add`}
                  className="inline-flex items-center px-3 h-9 rounded-2xl bg-sage text-white text-xs"
                >
                  Add
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => skipDue(s.id)}
                  disabled={pending}
                >
                  Skip
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            Upcoming
          </h2>
          <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40">
            {upcoming.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · renews {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1">
        {(due.length > 0 || upcoming.length > 0) && (
          <h2 className="text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
            All others
          </h2>
        )}
        <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40">
          {others.length === 0 ? (
            <p className="p-4 text-sm text-muted text-center">
              {due.length === 0 && upcoming.length === 0
                ? "No subscriptions yet. Create one from Add Expense or Add Income with the Recurring checkbox."
                : "Nothing else."}
            </p>
          ) : (
            others.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <TypePill type={s.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {rowMeta(s)} · next {s.next_renewal_at}
                  </div>
                </div>
                <div className="font-mono text-sm text-ink">
                  {formatCAD(s.amount_cents).replace("CA$", "$")}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => togglePause(s)}
                  disabled={pending}
                >
                  {s.active ? "Pause" : "Resume"}
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
