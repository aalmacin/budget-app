"use client";

import { useState, useRef, useEffect } from "react";
import { formatCAD } from "@/lib/money";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CategorySummary = { id: string; name: string; spent_cents: number };
export type PersonSummary   = { id: string; name: string; spent_cents: number };

export type MonthRow = {
  year: number;
  month: number;
  total_cents: number;
  essential_cents: number;
  non_essential_cents: number;
  categories: CategorySummary[];
  people: PersonSummary[];
};

type ColDef = { id: string; label: string };

// ─── Exported utility functions (also unit-tested) ───────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatMonthLabel(
  year: number, month: number,
  currentYear: number, currentMonth: number,
): string {
  if (year === currentYear && month === currentMonth) {
    return `MTD (${MONTH_NAMES[month - 1]} ${year})`;
  }
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function buildColumnOrder(
  selected: Set<string>,
  categories: { id: string; name: string }[],
  people: { id: string; name: string }[],
): ColDef[] {
  const cols: ColDef[] = [];

  // Categories — sorted alphabetically, only if selected
  [...categories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((c) => selected.has(c.id))
    .forEach((c) => cols.push({ id: c.id, label: c.name }));

  // People — sorted alphabetically, only if selected
  [...people]
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter((p) => selected.has(p.id))
    .forEach((p) => cols.push({ id: p.id, label: p.name }));

  // Essentials / Non-essentials — only if selected
  if (selected.has("ess"))     cols.push({ id: "ess",     label: "Essentials" });
  if (selected.has("non_ess")) cols.push({ id: "non_ess", label: "Non-ess." });

  // Total always last
  cols.push({ id: "total", label: "Total" });

  return cols;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(cents: number): string {
  return formatCAD(BigInt(Math.trunc(cents))).replace("CA$", "$");
}

function cellValue(col: ColDef, row: MonthRow): string {
  if (col.id === "total")   return fmt(row.total_cents);
  if (col.id === "ess")     return fmt(row.essential_cents);
  if (col.id === "non_ess") return fmt(row.non_essential_cents);
  const cat = row.categories.find((c) => c.id === col.id);
  if (cat) return fmt(cat.spent_cents);
  const person = row.people.find((p) => p.id === col.id);
  if (person) return fmt(person.spent_cents);
  return "—";
}

// ─── Component ───────────────────────────────────────────────────────────────

type Props = {
  rows: MonthRow[];
  allCategories: { id: string; name: string }[];
  allPeople: { id: string; name: string }[];
  currentYear: number;
  currentMonth: number;
};

const DEFAULT_SELECTED = new Set(["ess", "non_ess"]);

export function MonthlyComparisonClient({
  rows,
  allCategories,
  allPeople,
  currentYear,
  currentMonth,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const columns = buildColumnOrder(selected, allCategories, allPeople);

  if (rows.length === 0) {
    return <p className="text-sm text-muted px-4">No data yet.</p>;
  }

  return (
    <div className="px-4">
      <div className="flex justify-end mb-3 relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            panelOpen
              ? "bg-ink text-white"
              : "bg-surface shadow-sm text-ink-2 hover:bg-surface-soft"
          }`}
        >
          ⊞ Columns
        </button>

        {panelOpen && (
          <div className="absolute top-9 right-0 z-20 bg-surface border border-border rounded-2xl shadow-lg p-3 w-52">
            <PickerGroup label="Categories">
              {allCategories.map((c) => (
                <Pill key={c.id} label={c.name} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
              ))}
            </PickerGroup>
            <PickerGroup label="Per person">
              {allPeople.map((p) => (
                <Pill key={p.id} label={p.name} selected={selected.has(p.id)} onToggle={() => toggle(p.id)} />
              ))}
            </PickerGroup>
            <PickerGroup label="Defaults">
              <Pill label="Essentials"     selected={selected.has("ess")}     onToggle={() => toggle("ess")} />
              <Pill label="Non-essentials" selected={selected.has("non_ess")} onToggle={() => toggle("non_ess")} />
            </PickerGroup>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs font-mono">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 bg-ink text-white rounded-tl-lg whitespace-nowrap">Month</th>
              {columns.map((col, i) => (
                <th
                  key={col.id}
                  className={`text-right px-2 py-2 bg-ink text-white whitespace-nowrap ${
                    i === columns.length - 1 ? "rounded-tr-lg" : ""
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const isMtd = row.year === currentYear && row.month === currentMonth;
              const isAlt = ri % 2 === 1;
              return (
                <tr
                  key={`${row.year}-${row.month}`}
                  className={
                    isMtd
                      ? "bg-yellow-100 font-semibold"
                      : isAlt
                      ? "bg-surface-soft"
                      : "bg-surface"
                  }
                >
                  <td className="px-2 py-2 text-ink whitespace-nowrap">
                    {formatMonthLabel(row.year, row.month, currentYear, currentMonth)}
                  </td>
                  {columns.map((col) => (
                    <td key={col.id} className="px-2 py-2 text-right text-ink tabular-nums">
                      {cellValue(col, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PickerGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[9px] font-mono uppercase tracking-[1.4px] text-muted mb-1">{label}</div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Pill({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
        selected
          ? "bg-ink text-white border-ink"
          : "bg-surface text-ink-2 border-border hover:bg-surface-soft"
      }`}
    >
      {label}
    </button>
  );
}
