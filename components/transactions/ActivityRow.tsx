import { MerchantIcon } from "@/components/ui/MerchantIcon";
import { Icon } from "@/components/ui/icons";
import { formatCAD } from "@/lib/money";

export type ActivityRowData = {
  id: string;
  type: "expense" | "income";
  amount_cents: bigint;
  category_name: string;
  notes: string;
  for_member_display_name: string | null;
  occurred_on: string;
};

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Compact row used on the dashboard recent-activity strip. Shows merchant,
 * category, optional "for" attribution, and the signed amount.
 */
export function ActivityRow({ row }: { row: ActivityRowData }) {
  const sign = row.type === "expense" ? "−" : "+";
  const dateLabel =
    row.occurred_on === TODAY ? "Today" : row.occurred_on.slice(5);

  return (
    <div className="flex items-center gap-3 py-2">
      <MerchantIcon icon={Icon.receipt(16)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">
          {row.notes || row.category_name}
        </div>
        <div className="text-xs text-muted truncate">
          {row.category_name}
          {row.for_member_display_name ? ` · for ${row.for_member_display_name}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div
          className={`font-mono text-sm tabular-nums ${
            row.type === "expense" ? "text-ink" : "text-sage"
          }`}
        >
          {sign}
          {formatCAD(row.amount_cents).replace("CA$", "$")}
        </div>
        <div className="text-[10px] text-faint font-mono uppercase">{dateLabel}</div>
      </div>
    </div>
  );
}
