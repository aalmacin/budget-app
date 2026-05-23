"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCAD } from "@/lib/money";
import {
  registerSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
} from "./actions";

export type SubscriptionRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  active: boolean;
  category_name: string;
};

export type Overlap = {
  category_name: string;
  count: number;
  monthly_total_cents: bigint;
};

type Props = {
  subscriptions: SubscriptionRow[];
  overlaps: Overlap[];
  categories: Array<{ id: string; name: string }>;
};

const CADENCES = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];

export function SubscriptionsClient({ subscriptions, overlaps, categories }: Props) {
  const [adding, setAdding] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [cadence, setCadence] = useState("monthly");
  const [nextRenewal, setNextRenewal] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  const add = () => {
    startTransition(async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return;
      await registerSubscriptionAction({
        merchant,
        amount_cents: BigInt(Math.round(n * 100)),
        category_id: categoryId,
        cadence,
        next_renewal_at: nextRenewal,
      });
      setMerchant("");
      setAmount("0.00");
      setAdding(false);
    });
  };

  const togglePause = (s: SubscriptionRow) => {
    startTransition(async () => {
      if (s.active) await pauseSubscriptionAction(s.id);
      else await resumeSubscriptionAction(s.id);
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

      <div className="rounded-2xl bg-surface shadow-sm divide-y divide-line/40">
        {subscriptions.length === 0 ? (
          <p className="p-4 text-sm text-muted text-center">
            No subscriptions yet.
          </p>
        ) : (
          subscriptions.map((s) => (
            <div key={s.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{s.merchant}</div>
                <div className="text-[11px] text-faint">
                  {s.category_name} · {s.cadence} · next {s.next_renewal_at}
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

      {adding ? (
        <div className="rounded-2xl bg-surface p-3 shadow-sm space-y-2">
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Merchant (Netflix)" />
          <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input type="date" value={nextRenewal} onChange={(e) => setNextRenewal(e.target.value)} />
          <div className="flex gap-2">
            <Button onClick={add} disabled={pending || !merchant || !categoryId} className="flex-1">
              {pending ? "Adding…" : "Add subscription"}
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setAdding(true)} size="lg" className="w-full">
          Add subscription
        </Button>
      )}
    </div>
  );
}
