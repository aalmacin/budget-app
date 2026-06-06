"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MerchantIcon } from "@/components/ui/MerchantIcon";
import { Icon } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { formatCAD } from "@/lib/money";
import { deleteSavedExpenseAction } from "@/app/(app)/quick-add/actions";

export type SavedTileData = {
  id: string;
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  category_name: string;
};

type Props = {
  tiles: SavedTileData[];
  editMode: boolean;
};

export function SavedTilesGrid({ tiles, editMode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (tiles.length === 0) {
    return (
      <div className="mx-4 mt-2 rounded-2xl bg-surface p-5 shadow-sm flex flex-col items-start gap-3">
        <p className="text-sm text-ink">
          No saved expenses yet — add an expense and tick{" "}
          <span className="font-medium">Save as template</span> to keep it here.
        </p>
        <Link href="/add">
          <Button size="sm" variant="primary">
            Add expense
          </Button>
        </Link>
      </div>
    );
  }

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteSavedExpenseAction(id);
      if (result.ok) router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {tiles.map((t) => (
        <div key={t.id} className="relative">
          {editMode ? (
            <button
              type="button"
              onClick={() => remove(t.id)}
              disabled={pending}
              aria-label={`Delete ${t.merchant}`}
              className="absolute -top-1.5 -right-1.5 z-10 h-7 w-7 rounded-full bg-brick text-white shadow flex items-center justify-center disabled:opacity-60"
            >
              {Icon.close(14)}
            </button>
          ) : null}

          {editMode ? (
            <div
              aria-disabled="true"
              className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-3 shadow-sm w-full text-left opacity-60"
            >
              <TileContents tile={t} />
            </div>
          ) : (
            <Link
              href={`/add?template=${t.id}`}
              className="flex flex-col items-start gap-2 rounded-2xl bg-surface p-3 shadow-sm hover:bg-surface-soft w-full text-left"
            >
              <TileContents tile={t} />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function TileContents({ tile }: { tile: SavedTileData }) {
  return (
    <>
      <div className="flex items-center gap-2 w-full min-w-0">
        <MerchantIcon icon={Icon.receipt(16)} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink truncate">{tile.merchant}</div>
          <div className="text-[11px] text-faint truncate">
            {tile.category_name}
          </div>
        </div>
      </div>
      <div className="font-mono text-sm text-ink">
        {formatCAD(tile.amount_cents).replace("CA$", "$")}
      </div>
    </>
  );
}
