"use client";

import { useState } from "react";
import { SavedTilesGrid, type SavedTileData } from "@/components/quick-add/SavedTilesGrid";
import { SubscriptionTilesList } from "@/components/quick-add/SubscriptionTilesList";
import type { QuickAddTileData } from "@/components/quick-add/QuickAddTile";
import { Chip } from "@/components/ui/Chip";

type Props = {
  saved: SavedTileData[];
  subscriptions: QuickAddTileData[];
};

export function QuickAddTabs({ saved, subscriptions }: Props) {
  const [tab, setTab] = useState<"saved" | "subs">("saved");
  const [editMode, setEditMode] = useState(false);

  const onTabClick = (next: "saved" | "subs") => {
    setTab(next);
    if (next !== "saved") setEditMode(false);
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex gap-2">
          <Chip selected={tab === "saved"} onClick={() => onTabClick("saved")}>
            Saved
          </Chip>
          <Chip selected={tab === "subs"} onClick={() => onTabClick("subs")}>
            Subs
          </Chip>
        </div>
        {tab === "saved" && saved.length > 0 ? (
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className="text-xs text-muted hover:text-ink"
          >
            {editMode ? "Done" : "Edit"}
          </button>
        ) : null}
      </div>
      {tab === "saved" ? (
        <SavedTilesGrid tiles={saved} editMode={editMode} />
      ) : (
        <SubscriptionTilesList tiles={subscriptions} />
      )}
    </>
  );
}
