"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { centsToDollars, formatCAD } from "@/lib/money";
import { CategoryCombobox } from "@/components/transactions/CategoryCombobox";
import { MerchantCombobox } from "@/components/transactions/MerchantCombobox";
import { ForWhomChips } from "@/components/transactions/ForWhomChips";
import { SplitSlider } from "@/components/transactions/SplitSlider";
import { SplitRuleChips, type SplitRule } from "@/components/transactions/SplitRuleChips";
import { createExpenseCategoryAction } from "@/app/(app)/add/actions";

export type EditableTxn = {
  id: string;
  type: "expense" | "income";
  amount_cents: bigint;
  notes: string;
  essential_pct: number;
  occurred_on: string;
  category_id: string | null;
  category_name: string;
  for_member_id: string | null;
  paid_by_member_id: string | null;
  split_rule: string | null;
  income_source: string | null;
};

export type CategoryOption = { id: string; name: string };
export type MemberOption = { id: string; display_name: string; role: "adult" | "kid" };

type SavePatch = Record<string, string | number | null>;

type Props = {
  txn: EditableTxn | null;
  members: MemberOption[];
  expenseCategories: CategoryOption[];
  merchants: string[];
  onClose: () => void;
  onSave: (id: string, patch: SavePatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

const INCOME_SOURCES = [
  "Salary",
  "Contract",
  "Self_employed",
  "Benefit",
  "Refund",
  "Gift",
] as const;

const SELECT_CLS =
  "w-full h-12 px-4 rounded-2xl bg-surface text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-sage/40";

export function EditTxnSheet({
  txn,
  members,
  expenseCategories,
  merchants,
  onClose,
  onSave,
  onDelete,
}: Props) {
  if (!txn) return null;
  return (
    <EditTxnSheetInner
      key={txn.id}
      txn={txn}
      members={members}
      expenseCategories={expenseCategories}
      merchants={merchants}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
    />
  );
}

type InnerProps = Omit<Props, "txn"> & { txn: EditableTxn };

function EditTxnSheetInner(props: InnerProps) {
  const { txn, members, expenseCategories, merchants, onClose, onSave, onDelete } = props;

  const isIncome = txn.type === "income";
  const adults = members.filter((m) => m.role === "adult");
  const adultA = adults[0];
  const adultB = adults[1];

  const [amount, setAmount] = useState<string>(centsToDollars(txn.amount_cents).toFixed(2));
  const [date, setDate] = useState<string>(txn.occurred_on);
  const [essential, setEssential] = useState<number>(txn.essential_pct);
  const [forMember, setForMember] = useState<string | null>(txn.for_member_id);
  const [splitRule, setSplitRule] = useState<SplitRule | null>(
    (txn.split_rule as SplitRule | null) ?? null,
  );
  const [earner, setEarner] = useState<string>(txn.paid_by_member_id ?? adultA?.id ?? "");
  const [incomeSource, setIncomeSource] = useState<string>(txn.income_source ?? "Salary");

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const close = () => {
    setError(null);
    setConfirmingDelete(false);
    onClose();
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const cents = BigInt(Math.round(Number(amount) * 100));
    if (!Number.isFinite(Number(amount)) || cents <= 0n) {
      setError("Amount must be positive");
      return;
    }

    const form = e.currentTarget;
    const data = new FormData(form);

    const patch: SavePatch = {
      amount_cents: cents.toString(),
      notes: (data.get("notes") as string | null)?.toString() ?? "",
      occurred_on: date,
    };

    if (isIncome) {
      patch.paid_by_member_id = earner || null;
      patch.income_source = incomeSource;
    } else {
      const categoryId = (data.get("category_id") as string | null)?.toString() ?? "";
      if (!categoryId) {
        setError("Pick or add a category");
        return;
      }
      patch.category_id = categoryId;
      patch.for_member_id = forMember;
      patch.essential_pct = essential;
      patch.split_rule = splitRule;
      patch.paid_by_member_id =
        splitRule === "adult_a"
          ? adultA?.id ?? null
          : splitRule === "adult_b"
            ? adultB?.id ?? null
            : null;
    }

    startTransition(async () => {
      try {
        await onSave(txn.id, patch);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onDelete(txn.id);
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setConfirmingDelete(false);
      }
    });
  };

  const deletePreview = `${formatCAD(txn.amount_cents).replace("CA$", "$")}${
    txn.notes ? ` · ${txn.notes}` : ""
  }`;

  return (
    <>
      <Sheet open={!confirmingDelete} onClose={close} ariaLabel="Edit transaction">
        <form onSubmit={handleSubmit} noValidate className="p-4 space-y-3">
          <h2 className="text-base font-medium text-ink">
            Edit {isIncome ? "income" : "expense"}
          </h2>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">$ Amount</span>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>

          {isIncome ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">Earner</span>
                <select
                  value={earner}
                  onChange={(e) => setEarner(e.target.value)}
                  required
                  className={SELECT_CLS}
                >
                  {adults.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">Source</span>
                <select
                  value={incomeSource}
                  onChange={(e) => setIncomeSource(e.target.value)}
                  required
                  className={SELECT_CLS}
                >
                  {INCOME_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">Notes</span>
                <Input type="text" name="notes" defaultValue={txn.notes} maxLength={200} />
              </label>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">Category</span>
                <CategoryCombobox
                  categories={expenseCategories}
                  required
                  defaultValue={txn.category_name}
                  onCreate={createExpenseCategoryAction}
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">
                  Merchant / notes
                </span>
                <MerchantCombobox merchants={merchants} defaultValue={txn.notes} />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">For whom</span>
                <ForWhomChips
                  members={members}
                  value={forMember}
                  onChange={setForMember}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">
                  Essential split
                </span>
                <SplitSlider value={essential} onChange={setEssential} />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted font-mono uppercase tracking-wider">
                  Paid by · split
                </span>
                <SplitRuleChips
                  value={splitRule}
                  onChange={setSplitRule}
                  adultALabel={`${adultA?.display_name ?? "Adult A"} 100%`}
                  adultBLabel={`${adultB?.display_name ?? "Adult B"} 100%`}
                />
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-brick">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending} className="flex-1">
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              variant="danger"
            >
              Delete
            </Button>
          </div>
        </form>
      </Sheet>
      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this transaction?"
        message={`${deletePreview} — this cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmingDelete(false)}
        pending={pending}
      />
    </>
  );
}
