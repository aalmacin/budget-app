"use client";

import { Input } from "@/components/ui/Input";
import { useAppDispatch, useAppSelector } from "@/store";
import { filtersActions, type EssentialFilter } from "@/store/slices/filters";

type Props = {
  members: Array<{ id: string; display_name: string }>;
  categories: Array<{ id: string; name: string }>;
};

type RangeKey = "all" | "this_month" | "last_month" | "this_year";

const SELECT_CLASS =
  "w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40";
const LABEL_CLASS = "text-xs text-muted font-mono uppercase tracking-wider";

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

export function FilterChips({ members, categories }: Props) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);
  const range = activeRange(filters.fromDate, filters.toDate);

  const applyRange = (key: RangeKey) => {
    const b = rangeBounds(key);
    dispatch(filtersActions.setFromDate(b.from));
    dispatch(filtersActions.setToDate(b.to));
  };

  return (
    <div className="px-4">
      <div className="rounded-2xl bg-sand-soft p-3 shadow-sm space-y-2">
        <Input
          type="search"
          placeholder="Search merchant or note"
          value={filters.search}
          onChange={(e) => dispatch(filtersActions.setSearch(e.target.value))}
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Range</span>
            <select
              value={range}
              onChange={(e) => applyRange(e.target.value as RangeKey)}
              className={SELECT_CLASS}
              aria-label="Date range"
            >
              <option value="all">All time</option>
              <option value="this_month">This month</option>
              <option value="last_month">Last month</option>
              <option value="this_year">This year</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>Type</span>
            <select
              value={filters.essential}
              onChange={(e) =>
                dispatch(filtersActions.setEssential(e.target.value as EssentialFilter))
              }
              className={SELECT_CLASS}
              aria-label="Essential or treats"
            >
              <option value="all">All</option>
              <option value="essential">Essential</option>
              <option value="treats">Treats</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_CLASS}>For</span>
            <select
              value={filters.forMember ?? ""}
              onChange={(e) =>
                dispatch(filtersActions.setForMember(e.target.value === "" ? null : e.target.value))
              }
              className={SELECT_CLASS}
              aria-label="For member"
            >
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  for {m.display_name}
                </option>
              ))}
            </select>
          </label>

          {categories.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className={LABEL_CLASS}>Category</span>
              <select
                value={filters.categoryId ?? ""}
                onChange={(e) =>
                  dispatch(filtersActions.setCategory(e.target.value === "" ? null : e.target.value))
                }
                className={SELECT_CLASS}
                aria-label="Category"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
