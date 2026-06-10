"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppSelector } from "@/store";
import { TxnRow } from "@/components/transactions/TxnRow";
import { EditTxnSheet, type EditableTxn } from "@/components/transactions/EditTxnSheet";
import type { ActivityRowData } from "@/components/transactions/ActivityRow";
import { Button } from "@/components/ui/Button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type RawTxn = {
  id: string;
  type: "expense" | "income";
  amount_cents: number | string;
  category_id: string | null;
  category_name: string;
  notes: string;
  for_member_ids: string[] | null;
  for_member_display_name: string | null;
  paid_by_member_id: string | null;
  paid_by_display_name: string | null;
  split_rule: string | null;
  income_source: string | null;
  occurred_on: string;
  essential_pct: number;
  total_count: number | string;
};

type RowWithPaid = ActivityRowData & {
  essential_pct: number;
  paid_by_display_name: string | null;
  category_id: string | null;
  for_member_ids: string[];
  paid_by_member_id: string | null;
  split_rule: string | null;
  income_source: string | null;
};

export type CategoryOption = { id: string; name: string };
export type MemberOption = { id: string; display_name: string; role: "adult" | "kid" };

type Props = {
  initial: RawTxn[];
  members: MemberOption[];
  expenseCategories: CategoryOption[];
  merchants: string[];
};

const PAGE_SIZE = 50;

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
    category_id: r.category_id,
    for_member_ids: r.for_member_ids ?? [],
    paid_by_member_id: r.paid_by_member_id,
    split_rule: r.split_rule,
    income_source: r.income_source,
  }));
}

function totalFrom(data: RawTxn[]): number {
  const v = data[0]?.total_count;
  if (v === undefined) return 0;
  return typeof v === "string" ? Number(v) : v;
}

export function TransactionsList({
  initial,
  members,
  expenseCategories,
  merchants,
}: Props) {
  const [rows, setRows] = useState<RowWithPaid[]>(toRows(initial));
  const [total, setTotal] = useState<number>(totalFrom(initial));
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<EditableTxn | null>(null);
  const [loading, setLoading] = useState(false);
  const filters = useAppSelector((s) => s.filters);

  // Always fetch from the DB. No client cache, no optimistic local mutations.
  const fetchPage = useCallback(
    async (pageIndex: number) => {
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.rpc("list_transactions", {
        p_filters: {
          search: filters.search || undefined,
          // The RPC only understands "essential" / "treats" / NULL — "all" is
          // a client-side label that must be stripped, otherwise the SQL
          // filter evaluates to FALSE and every row disappears.
          essential: filters.essential === "all" ? undefined : filters.essential,
          for_member_id: filters.forMember ?? undefined,
          category_id: filters.categoryId ?? undefined,
          from: filters.fromDate ?? undefined,
          to: filters.toDate ?? undefined,
          limit: PAGE_SIZE,
          offset: pageIndex * PAGE_SIZE,
        },
      });
      const raw = (data ?? []) as RawTxn[];
      setRows(toRows(raw));
      setTotal(totalFrom(raw));
      setLoading(false);
    },
    [filters.search, filters.essential, filters.forMember, filters.categoryId, filters.fromDate, filters.toDate],
  );

  // Reset to page 0 whenever filters change, then refetch. The setPage call
  // is the intent (filter change should rewind the offset) — the lint rule
  // is conservative about setState-in-effect but doesn't apply cleanly here
  // because there is no shared state to derive from.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    void fetchPage(0);
  }, [fetchPage]);

  const handleSave = async (
    id: string,
    patch: Record<string, string | number | null | string[]>,
  ) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("update_transaction", { p_id: id, p_patch: patch });
    await fetchPage(page);
  };

  const handleDelete = async (id: string) => {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("delete_transaction", { p_id: id });
    // If we just deleted the last row on the current page, step back one.
    const remainingOnPage = rows.length - 1;
    const nextPage = remainingOnPage === 0 && page > 0 ? page - 1 : page;
    setPage(nextPage);
    await fetchPage(nextPage);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstIndex = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastIndex = Math.min(total, (page + 1) * PAGE_SIZE);

  const groups = new Map<string, RowWithPaid[]>();
  for (const r of rows) {
    const day = r.occurred_on;
    const arr = groups.get(day) ?? [];
    arr.push(r);
    groups.set(day, arr);
  }

  return (
    <>
      {rows.length === 0 ? (
        <p className="text-sm text-muted text-center py-12">
          {loading ? "Loading…" : "No matching transactions."}
        </p>
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
                      type: r.type,
                      amount_cents: r.amount_cents,
                      notes: r.notes,
                      essential_pct: r.essential_pct,
                      occurred_on: r.occurred_on,
                      category_id: r.category_id,
                      category_name: r.category_name,
                      for_member_ids: r.for_member_ids,
                      paid_by_member_id: r.paid_by_member_id,
                      split_rule: r.split_rule,
                      income_source: r.income_source,
                    })
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}

      {total > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 mt-2">
          <div className="text-xs font-mono text-muted">
            {firstIndex}–{lastIndex} of {total}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const p = Math.max(0, page - 1);
                setPage(p);
                void fetchPage(p);
              }}
              disabled={page === 0 || loading}
            >
              Prev
            </Button>
            <span className="text-xs font-mono text-muted tabular-nums">
              {page + 1}/{totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const p = Math.min(totalPages - 1, page + 1);
                setPage(p);
                void fetchPage(p);
              }}
              disabled={page >= totalPages - 1 || loading}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <EditTxnSheet
        txn={editing}
        members={members}
        expenseCategories={expenseCategories}
        merchants={merchants}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
}
