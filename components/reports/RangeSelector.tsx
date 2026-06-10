"use client";

import { useRouter, usePathname } from "next/navigation";
import { Chip } from "@/components/ui/Chip";

const RANGES = [
  { value: "mtd", label: "MTD" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "ytd", label: "YTD" },
] as const;

export type ReportRange = (typeof RANGES)[number]["value"];

export function RangeSelector({ current }: { current: ReportRange }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="flex gap-2 overflow-x-auto pb-3">
      {RANGES.map((r) => (
        <Chip
          key={r.value}
          selected={current === r.value}
          onClick={() => router.push(`${pathname}?range=${r.value}`)}
        >
          {r.label}
        </Chip>
      ))}
    </div>
  );
}
