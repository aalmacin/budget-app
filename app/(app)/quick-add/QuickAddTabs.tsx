"use client";

import { useState } from "react";
import { RecentTilesGrid } from "@/components/quick-add/RecentTilesGrid";
import { SubscriptionTilesList } from "@/components/quick-add/SubscriptionTilesList";
import type { QuickAddTileData } from "@/components/quick-add/QuickAddTile";
import { Chip } from "@/components/ui/Chip";

type Props = {
  recent: QuickAddTileData[];
  subscriptions: QuickAddTileData[];
};

/**
 * Tabs `Recent | Subs` — the two MVP filter chips per FR-011a / spec
 * clarification §9. `Per kid | Merchants | Categories` are post-MVP and
 * deliberately omitted.
 */
export function QuickAddTabs({ recent, subscriptions }: Props) {
  const [tab, setTab] = useState<"recent" | "subs">("recent");

  return (
    <>
      <div className="flex gap-2 px-4 mb-3">
        <Chip selected={tab === "recent"} onClick={() => setTab("recent")}>
          Recent
        </Chip>
        <Chip selected={tab === "subs"} onClick={() => setTab("subs")}>
          Subs
        </Chip>
      </div>
      {tab === "recent" ? (
        <RecentTilesGrid tiles={recent} />
      ) : (
        <SubscriptionTilesList tiles={subscriptions} />
      )}
    </>
  );
}
