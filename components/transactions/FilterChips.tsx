"use client";

import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { useAppDispatch, useAppSelector } from "@/store";
import { filtersActions, type EssentialFilter } from "@/store/slices/filters";

type Props = {
  members: Array<{ id: string; display_name: string }>;
};

const FILTERS: EssentialFilter[] = ["all", "essential", "treats"];

export function FilterChips({ members }: Props) {
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);

  return (
    <div className="px-4 space-y-2">
      <Input
        type="search"
        placeholder="Search merchant or note"
        value={filters.search}
        onChange={(e) => dispatch(filtersActions.setSearch(e.target.value))}
      />

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
