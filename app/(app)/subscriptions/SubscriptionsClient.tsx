"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { formatCAD } from "@/lib/money";
import {
  registerSubscriptionAction,
  pauseSubscriptionAction,
  resumeSubscriptionAction,
  skipSubscriptionOccurrenceAction,
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

export type DueRow = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  cadence: string;
  next_renewal_at: string;
  category_name: string;
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
  categories: Array<{ id: string; name: string }>;
  merchants: string[];
};

const CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_days",
] as const;

function cadenceLabel(c: string): string {
  return c === "custom_days" ? "custom" : c;
}

export function SubscriptionsClient({
  due,
  upcoming,
  others,
  overlaps,
  categories,
  merchants,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("0.00");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [cadence, setCadence] = useState<(typeof CADENCES)[number]>("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [nextRenewal, setNextRenewal] = useState(new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();

  const submitCreate = (formData: FormData) => {
    startTransition(async () => {
      const m = ((formData.get("merchant") as string) ?? "").trim();
      const n = Number(amount);
      if (!m || !Number.isFinite(n) || n <= 0) return;
      let intervalDaysNum: number | null = null;
      if (cadence === "custom_days") {
        const n = Number(intervalDays);
        if (!Number.isInteger(n) || n < 1) return;
        intervalDaysNum = n;
      }
      await registerSubscriptionAction({
        merchant: m,
        amount_cents: BigInt(Math.round(n * 100)),
        category_id: categoryId,
        cadence,
        next_renewal_at: nextRenewal,
        interval_days: intervalDaysNum,
      });
      setAmount("0.00");
      setIntervalDays("30");
      setCadence("monthly");
      setAdding(false);
    });
  };

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
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · was {s.next_renewal_at}
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
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · renews {s.next_renewal_at}
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
                ? "No subscriptions yet."
                : "Nothing else."}
            </p>
          ) : (
            others.map((s) => (
              <div key={s.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">{s.merchant}</div>
                  <div className="text-[11px] text-faint">
                    {s.category_name} · {cadenceLabel(s.cadence)} · next {s.next_renewal_at}
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

      {adding ? (
        <form
          action={submitCreate}
          className="rounded-2xl bg-surface p-3 shadow-sm space-y-2"
        >
          <MerchantCombobox merchants={merchants} name="merchant" placeholder="Merchant (Netflix)" />
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
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
            onChange={(e) => setCadence(e.target.value as (typeof CADENCES)[number])}
            className="w-full h-12 px-4 rounded-2xl bg-bg text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
          >
            {CADENCES.map((c) => (
              <option key={c} value={c}>
                {c === "custom_days" ? "custom (days)" : c}
              </option>
            ))}
          </select>
          {cadence === "custom_days" && (
            <Input
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              placeholder="Interval days"
            />
          )}
          <Input type="date" value={nextRenewal} onChange={(e) => setNextRenewal(e.target.value)} />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                pending ||
                !categoryId ||
                !Number.isFinite(Number(amount)) ||
                Number(amount) <= 0 ||
                (cadence === "custom_days" && (!intervalDays || Number(intervalDays) < 1))
              }
              className="flex-1"
            >
              {pending ? "Adding…" : "Add subscription"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setAdding(true)} size="lg" className="w-full">
          Add subscription
        </Button>
      )}
    </div>
  );
}
