"use client";

import { useEffect, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { PerPersonPie } from "@/components/reports/charts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Row = {
  member_id: string;
  display_name: string;
  role: "adult" | "kid";
  spent_cents: number | string;
  share_of_general_cents: number | string;
};

type Props = {
  year: number;
  month: number;
  initial: Row[];
};

export function PerPersonClient({ year, month, initial }: Props) {
  const [includeGeneral, setIncludeGeneral] = useState(false);
  const [rows, setRows] = useState<Row[]>(initial);

  useEffect(() => {
    const start = performance.now();
    const supabase = getSupabaseBrowserClient();
    void supabase
      .rpc("per_person_breakdown", { p_year: year, p_month: month, p_include_general: includeGeneral })
      .then((res: { data: unknown }) => {
        if (res.data) setRows(res.data as Row[]);
        if (process.env.NODE_ENV !== "production") {
          // SC-006: 500 ms target. Log for manual verification.

          console.info(`per-person recompose: ${Math.round(performance.now() - start)}ms`);
        }
      });
  }, [year, month, includeGeneral]);

  const data = rows.map((r) => ({
    name: r.display_name,
    value: Number(r.spent_cents) + Number(r.share_of_general_cents),
  }));

  return (
    <div className="px-4">
      <div className="flex justify-end mb-2">
        <Chip selected={includeGeneral} onClick={() => setIncludeGeneral((v) => !v)}>
          Include general
        </Chip>
      </div>
      <PerPersonPie data={data} />
    </div>
  );
}
