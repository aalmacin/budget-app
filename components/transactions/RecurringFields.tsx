"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";

const CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom_days",
] as const;

type Cadence = (typeof CADENCES)[number];

/**
 * Shared "Recurring" block for the Add Expense and Add Income forms.
 *
 * Uncontrolled w.r.t. the parent form — fields post via FormData under their
 * `name` attributes. When the checkbox is off, inner fields are unmounted so
 * the parent form never sees stale recurring values.
 */
export function RecurringFields({ todayIso }: { todayIso: string }) {
  const [recurring, setRecurring] = useState(false);
  const [cadence, setCadence] = useState<Cadence>("monthly");

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          name="recurring"
          checked={recurring}
          onChange={(e) => setRecurring(e.target.checked)}
          className="h-4 w-4"
        />
        Recurring
      </label>

      {recurring && (
        <div className="flex flex-col gap-2 pl-6">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">
              Cadence
            </span>
            <select
              name="cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as Cadence)}
              className="w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40"
            >
              {CADENCES.map((c) => (
                <option key={c} value={c}>
                  {c === "custom_days" ? "custom (days)" : c}
                </option>
              ))}
            </select>
          </label>

          {cadence === "custom_days" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted font-mono uppercase tracking-wider">
                Interval days
              </span>
              <Input
                type="number"
                name="interval_days"
                inputMode="numeric"
                step="1"
                min="1"
                defaultValue="30"
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">
              Start date
            </span>
            <Input
              type="date"
              name="start_date"
              defaultValue={todayIso}
              required
            />
          </label>
        </div>
      )}
    </div>
  );
}
