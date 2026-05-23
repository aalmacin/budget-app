"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { CategoryRow, type CategoryRowData } from "@/components/budget/CategoryRow";
import { EditLimitSheet } from "@/components/budget/EditLimitSheet";
import { useAppDispatch, useAppSelector } from "@/store";
import { filtersActions, type EssentialFilter } from "@/store/slices/filters";
import { setCategoryBudgetAction } from "./actions";

type Props = {
  rows: CategoryRowData[];
};

const FILTERS: EssentialFilter[] = ["all", "essential", "treats"];

export function BudgetClient({ rows }: Props) {
  const dispatch = useAppDispatch();
  const essential = useAppSelector((s) => s.filters.essential);
  const [editing, setEditing] = useState<CategoryRowData | null>(null);

  const onSave = async (categoryId: string, cents: bigint | null) => {
    await setCategoryBudgetAction(categoryId, cents);
  };

  return (
    <div className="px-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto py-1">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            selected={essential === f}
            onClick={() => dispatch(filtersActions.setEssential(f))}
          >
            {f === "all" ? "All" : f === "essential" ? "Essential" : "Treats"}
          </Chip>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">No categories yet.</p>
      ) : (
        rows.map((r) => (
          <CategoryRow
            key={r.category_id}
            row={r}
            onClick={() => setEditing(r)}
          />
        ))
      )}

      <EditLimitSheet
        categoryId={editing?.category_id ?? null}
        categoryName={editing?.category_name ?? ""}
        currentLimitCents={editing?.monthly_budget_cents ?? null}
        onClose={() => setEditing(null)}
        onSave={onSave}
      />
    </div>
  );
}
