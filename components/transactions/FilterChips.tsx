"use client";

import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { useAppDispatch, useAppSelector } from "@/store";
import { filtersActions, type EssentialFilter } from "@/store/slices/filters";

type Props = {
  members: Array<{ id: string; display_name: string }>;
};

const FILTERS: EssentialFilter[] = ["all", "essential", "treats"];

type RangeKey = "all" | "this_month" | "last_month" | "this_year";

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function rangeBounds(key: RangeKey): { from: string | null; to: string | null } {
  if (key === "all") return { from: null, to: null };
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (key === "this_month") {
    const nextMonthYear = m === 12 ? y + 1 : y;
    const nextMonth = m === 12 ? 1 : m + 1;
    return { from: isoDate(y, m, 1), to: isoDate(nextMonthYear, nextMonth, 1) };
  }
  if (key === "last_month") {
    const lastMonthYear = m === 1 ? y - 1 : y;
    const lastMonth = m === 1 ? 12 : m - 1;
    return { from: isoDate(lastMonthYear, lastMonth, 1), to: isoDate(y, m, 1) };
  }
  // this_year
  return { from: isoDate(y, 1, 1), to: isoDate(y + 1, 1, 1) };
}

function activeRange(from: string | null, to: string | null): RangeKey {
  if (from === null && to === null) return "all";
  for (const key of ["this_month", "last_month", "this_year"] as const) {
    const b = rangeBounds(key);
    if (b.from === from && b.to === to) return key;
  }
  return "all";
}

export function FilterChips({ members }: Props) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);
  const range = activeRange(filters.fromDate, filters.toDate);

  const applyRange = (key: RangeKey) => {
    const b = rangeBounds(key);
    dispatch(filtersActions.setFromDate(b.from));
    dispatch(filtersActions.setToDate(b.to));
  };

  return (
    <div className="px-4 space-y-2">
      <Input
        type="search"
        placeholder="Search merchant or note"
        value={filters.search}
        onChange={(e) => dispatch(filtersActions.setSearch(e.target.value))}
      />

      <div className="flex gap-2 overflow-x-auto py-1">
        <Chip selected={range === "all"} onClick={() => applyRange("all")}>All time</Chip>
        <Chip selected={range === "this_month"} onClick={() => applyRange("this_month")}>This month</Chip>
        <Chip selected={range === "last_month"} onClick={() => applyRange("last_month")}>Last month</Chip>
        <Chip selected={range === "this_year"} onClick={() => applyRange("this_year")}>This year</Chip>
      </div>

      <div className="flex gap-2 overflow-x-auto py-1">
        {FILTERS.map((f) => (
          <Chip
            key={f}
            selected={filters.essential === f}
            onClick={() => dispatch(filtersActions.setEssential(f))}
          >
            {f === "all" ? "All" : f === "essential" ? "Essential" : "Treats"}
          </Chip>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto py-1">
        <Chip
          selected={filters.forMember === null}
          onClick={() => dispatch(filtersActions.setForMember(null))}
        >
          Anyone
        </Chip>
        {members.map((m) => (
          <Chip
            key={m.id}
            selected={filters.forMember === m.id}
            onClick={() => dispatch(filtersActions.setForMember(m.id))}
          >
            for {m.display_name}
          </Chip>
        ))}
      </div>
    </div>
  );
}
