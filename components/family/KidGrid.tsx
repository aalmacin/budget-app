"use client";

import { FamilyAvatar } from "@/components/ui/FamilyAvatar";
import { formatCAD } from "@/lib/money";

export type KidCardData = {
  id: string;
  display_name: string;
  age_years: number | null;
  month_spent_cents: bigint;
  last_activity_day: string | null;
};

type Props = {
  kids: KidCardData[];
  onRemove: (id: string) => Promise<void>;
};

export function KidGrid({ kids, onRemove }: Props) {
  if (kids.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted text-center">
        No kids yet — add one below.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {kids.map((k) => (
        <div key={k.id} className="rounded-2xl bg-surface p-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FamilyAvatar
              initial={k.display_name.charAt(0).toUpperCase()}
              size={32}
              tone="sand"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink truncate">{k.display_name}</div>
              <div className="text-[10px] text-faint">{k.age_years ?? "?"} yrs</div>
            </div>
          </div>
          <div className="font-mono text-sm text-ink">
            {formatCAD(k.month_spent_cents).replace("CA$", "$")}
          </div>
          <div className="text-[10px] text-faint">
            {k.last_activity_day ? `Last ${k.last_activity_day}` : "no activity"}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove ${k.display_name}?`)) void onRemove(k.id);
            }}
            className="text-[11px] text-muted hover:text-ink mt-2"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
