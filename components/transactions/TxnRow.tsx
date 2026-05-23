"use client";

import { MerchantIcon } from "@/components/ui/MerchantIcon";
import { Icon } from "@/components/ui/icons";
import { formatCAD } from "@/lib/money";
import type { ActivityRowData } from "./ActivityRow";

type TxnRowProps = {
  row: ActivityRowData & {
    essential_pct?: number;
    paid_by_display_name?: string | null;
  };
  /** Optional click handler (e.g. opens EditTxnSheet). */
  onClick?: () => void;
};

const TODAY = new Date().toISOString().slice(0, 10);

/**
 * Full row used on the Transactions list page. Renders the merchant, the
 * category + for-member attribution, the date, and the signed amount.
 */
export function TxnRow({ row, onClick }: TxnRowProps) {
  const sign = row.type === "expense" ? "−" : "+";
  const dateLabel =
    row.occurred_on === TODAY ? "Today" : row.occurred_on;

  const body = (
    <div className="flex items-center gap-3 py-3 px-4 w-full text-left">
      <MerchantIcon icon={Icon.receipt(16)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">
          {row.notes || row.category_name}
        </div>
        <div className="text-xs text-muted truncate">
          {dateLabel} · {row.category_name}
          {row.for_member_display_name ? ` · for ${row.for_member_display_name}` : ""}
        </div>
      </div>
      <div
        className={`font-mono text-sm tabular-nums ${
          row.type === "expense" ? "text-ink" : "text-sage"
        }`}
      >
        {sign}
        {formatCAD(row.amount_cents).replace("CA$", "$")}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full hover:bg-surface-soft">
        {body}
      </button>
    );
  }
  return body;
}
