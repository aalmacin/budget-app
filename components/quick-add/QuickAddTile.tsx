"use client";

import { MerchantIcon } from "@/components/ui/MerchantIcon";
import { Icon } from "@/components/ui/icons";
import { formatCAD } from "@/lib/money";

export type QuickAddTileData = {
  source: "recent" | "subscription";
  source_id: string;
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  category_name: string;
  for_member_ids: string[];
  paid_by_member_id: string | null;
  essential_pct: number;
  split_rule: "adult_a" | "adult_b" | "50_50" | "by_income" | null;
  last_occurred: string;
};

type Props = {
  tile: QuickAddTileData;
  onPrimaryTap: () => void;
};

/**
 * Single Quick Add tile. Primary tap re-logs (handler comes from the parent
 * grid). Subscription tile renders a pencil button as a sibling — handled in
 * RecurringTransactionsTilesList, not here, to keep this component dumb.
 */
export function QuickAddTile({ tile, onPrimaryTap }: Props) {
  return (
    <button
      type="button"
      onClick={onPrimaryTap}
      className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-3 shadow-sm hover:bg-surface-soft w-full text-left"
    >
      <div className="flex items-center gap-2 w-full min-w-0">
        <MerchantIcon icon={Icon.receipt(16)} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink truncate">{tile.merchant}</div>
          <div className="text-[11px] text-faint truncate">{tile.category_name}</div>
        </div>
      </div>
      <div className="font-mono text-sm text-ink">
        {formatCAD(tile.amount_cents).replace("CA$", "$")}
      </div>
    </button>
  );
}
