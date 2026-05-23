"use client";

import { Bar } from "@/components/ui/Bar";
import { formatCAD } from "@/lib/money";

export type CategoryRowData = {
  category_id: string;
  category_name: string;
  monthly_budget_cents: bigint | null;
  spent_cents: bigint;
};

type Props = {
  row: CategoryRowData;
  onClick?: () => void;
};

export function CategoryRow({ row, onClick }: Props) {
  const ratio =
    row.monthly_budget_cents && row.monthly_budget_cents > 0n
      ? Number(row.spent_cents) / Number(row.monthly_budget_cents)
      : 0;
  const over = ratio > 1;

  const body = (
    <div className="rounded-2xl bg-surface p-3 shadow-sm flex flex-col gap-2 w-full text-left">
      <div className="flex items-baseline justify-between">
        <div className="text-sm text-ink">{row.category_name}</div>
        <div
          className={`font-mono text-xs ${over ? "text-brick" : "text-faint"}`}
        >
          {formatCAD(row.spent_cents).replace("CA$", "$")}
          {row.monthly_budget_cents
            ? ` / ${formatCAD(row.monthly_budget_cents).replace("CA$", "$")}`
            : ""}
        </div>
      </div>
      {row.monthly_budget_cents ? (
        <Bar
          value={Math.min(ratio, 1)}
          color={over ? "var(--color-brick)" : "var(--color-sage)"}
        />
      ) : (
        <div className="text-[11px] text-faint">No monthly limit set</div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full">
        {body}
      </button>
    );
  }
  return body;
}
