"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/store";
import { TxnRow } from "@/components/transactions/TxnRow";
import { EditTxnSheet, type EditableTxn } from "@/components/transactions/EditTxnSheet";
import type { ActivityRowData } from "@/components/transactions/ActivityRow";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RawTxn = {
  id: string;
  type: "expense" | "income";
  amount_cents: number | string;
  category_name: string;
  notes: string;
  for_member_display_name: string | null;
  occurred_on: string;
  essential_pct: number;
  paid_by_display_name: string | null;
};

type RowWithPaid = ActivityRowData & {
  essential_pct: number;
  paid_by_display_name: string | null;
};

function toRows(data: RawTxn[]): RowWithPaid[] {
  return data.map((r) => ({
    id: r.id,
    type: r.type,
    amount_cents: BigInt(typeof r.amount_cents === "string" ? r.amount_cents : r.amount_cents),
    category_name: r.category_name,
    notes: r.notes,
    for_member_display_name: r.for_member_display_name,
    occurred_on: r.occurred_on,
    essential_pct: r.essential_pct,
    paid_by_display_name: r.paid_by_display_name,
  }));
}

export function TransactionsList({ initial }: { initial: RawTxn[] }) {
  const [rows, setRows] = useState<RowWithPaid[]>(toRows(initial));
  const [editing, setEditing] = useState<EditableTxn | null>(null);
  const filters = useAppSelector((s) => s.filters);

  // Re-fetch via RPC whenever the filters change.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase
      .rpc("list_transactions", {
        p_filters: {
          search: filters.search || undefined,
          essential: filters.essential,
          for_member_id: filters.forMember ?? undefined,
          from: filters.fromDate ?? undefined,
          to: filters.toDate ?? undefined,
        },
      })
      .then((res: { data: unknown }) => {
        if (res.data) setRows(toRows(res.data as RawTxn[]));
      });
  }, [filters.search, filters.essential, filters.forMember, filters.fromDate, filters.toDate]);

  // Group by day for the list rendering.
  const groups = new Map<string, RowWithPaid[]>();
  for (const r of rows) {
    const day = r.occurred_on;
    const arr = groups.get(day) ?? [];
    arr.push(r);
    groups.set(day, arr);
  }

  const handleSave = async (id: string, patch: { amount_cents: bigint; notes: string; essential_pct: number; occurred_on: string }) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("update_transaction", {
      p_id: id,
      p_patch: {
        amount_cents: patch.amount_cents.toString(),
        notes: patch.notes,
        essential_pct: patch.essential_pct,
        occurred_on: patch.occurred_on,
      },
    });
    // Refresh.
    const { data } = await supabase.rpc("list_transactions", { p_filters: {} });
    if (data) setRows(toRows(data as RawTxn[]));
  };

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("delete_transaction", { p_id: id });
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">No matching transactions.</p>
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day} className="mb-4">
            <div className="px-4 mb-1 text-[11px] font-mono uppercase tracking-[1.4px] text-muted">
              {day}
            </div>
            <div className="bg-surface rounded-2xl mx-4 shadow-sm divide-y divide-line/40">
              {list.map((r) => (
                <TxnRow
                  key={r.id}
                  row={r}
                  onClick={() =>
                    setEditing({
                      id: r.id,
                      amount_cents: r.amount_cents,
                      notes: r.notes,
                      essential_pct: r.essential_pct,
                      occurred_on: r.occurred_on,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
      <EditTxnSheet
        txn={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
}
