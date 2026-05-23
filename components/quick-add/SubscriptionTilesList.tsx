"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { MerchantIcon } from "@/components/ui/MerchantIcon";
import { formatCAD } from "@/lib/money";
import { dispatchOrEnqueue } from "@/lib/pwa/dispatch";
import type { QuickAddTileData } from "./QuickAddTile";

type Props = { tiles: QuickAddTileData[] };

/**
 * Subscription rows have two affordances per spec clarification §9:
 *  - primary row tap → re-log an immediate transaction (occurrence_date stays
 *    null so the cron auto-log isn't blocked)
 *  - pencil-icon secondary tap → navigate to the subscription edit sheet
 */
export function SubscriptionTilesList({ tiles }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (tiles.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        No subscriptions due in the next 30 days.
      </p>
    );
  }

  const reLog = (tile: QuickAddTileData) => {
    startTransition(async () => {
      const today = new Date().toISOString().slice(0, 10);
      await dispatchOrEnqueue("log_expense", {
        amount_cents: tile.amount_cents.toString(),
        occurred_on: today,
        category_id: tile.category_id,
        notes: tile.merchant,
        paid_by_member_id: tile.paid_by_member_id,
        for_member_id: tile.for_member_id,
        essential_pct: tile.essential_pct,
        split_rule: tile.split_rule,
        subscription_id: tile.source_id,
        occurrence_date: null,
      });
      router.push("/dashboard");
    });
  };

  return (
    <ul className="px-4 space-y-2">
      {tiles.map((t) => (
        <li
          key={t.source_id}
          className="flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm"
        >
          <button
            type="button"
            onClick={() => reLog(t)}
            className="flex-1 flex items-center gap-3 text-left min-w-0"
          >
            <MerchantIcon icon={Icon.receipt(16)} size={32} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-ink truncate">{t.merchant}</div>
              <div className="text-[11px] text-faint truncate">
                {t.category_name} · next {t.last_occurred}
              </div>
            </div>
            <div className="font-mono text-sm text-ink">
              {formatCAD(t.amount_cents).replace("CA$", "$")}
            </div>
          </button>
          <Link
            href={`/subscriptions/${t.source_id}/edit`}
            aria-label={`Edit ${t.merchant}`}
            className="p-2 text-muted hover:text-ink"
          >
            {Icon.pencil(16)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
