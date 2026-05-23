"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { QuickAddTile, type QuickAddTileData } from "./QuickAddTile";
import { dispatchOrEnqueue } from "@/lib/pwa/dispatch";

type Props = {
  tiles: QuickAddTileData[];
};

/**
 * Re-log on tap: copies merchant/amount/category/for/paid_by/essential/split
 * from the source tile, sets today's date and a fresh UUID v7, dispatches
 * log_expense. Falls back to the offline outbox if the network is down.
 */
export function RecentTilesGrid({ tiles }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (tiles.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        No recent expenses yet — use the “+” to add one manually.
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
      });
      router.push("/dashboard");
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {tiles.map((t) => (
        <QuickAddTile key={t.source_id} tile={t} onPrimaryTap={() => reLog(t)} />
      ))}
    </div>
  );
}
