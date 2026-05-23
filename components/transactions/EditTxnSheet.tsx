"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { centsToDollars } from "@/lib/money";

export type EditableTxn = {
  id: string;
  amount_cents: bigint;
  notes: string;
  essential_pct: number;
  occurred_on: string;
};

type Props = {
  txn: EditableTxn | null;
  onClose: () => void;
  onSave: (id: string, patch: { amount_cents: bigint; notes: string; essential_pct: number; occurred_on: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function EditTxnSheet({ txn, onClose, onSave, onDelete }: Props) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [essential, setEssential] = useState(100);
  const [date, setDate] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Sync when sheet opens for a new txn.
  if (txn && date === "") {
    setAmount(centsToDollars(txn.amount_cents).toFixed(2));
    setNotes(txn.notes);
    setEssential(txn.essential_pct);
    setDate(txn.occurred_on);
  }

  const close = () => {
    setAmount("");
    setNotes("");
    setEssential(100);
    setDate("");
    setError(null);
    onClose();
  };

  if (!txn) return null;

  const handleSave = () => {
    setError(null);
    const cents = BigInt(Math.round(Number(amount) * 100));
    if (!Number.isFinite(Number(amount)) || cents <= 0n) {
      setError("Amount must be positive");
      return;
    }
    startTransition(async () => {
      try {
        await onSave(txn.id, {
          amount_cents: cents,
          notes,
          essential_pct: essential,
          occurred_on: date,
        });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this transaction?")) return;
    startTransition(async () => {
      try {
        await onDelete(txn.id);
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <Sheet open={!!txn} onClose={close} ariaLabel="Edit transaction">
      <div className="p-4 space-y-3">
        <h2 className="text-base font-medium text-ink">Edit transaction</h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-mono uppercase tracking-wider">Amount</span>
          <Input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-mono uppercase tracking-wider">Merchant / notes</span>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-mono uppercase tracking-wider">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-mono uppercase tracking-wider">Essential % ({essential})</span>
          <input type="range" min={0} max={100} step={5} value={essential} onChange={(e) => setEssential(Number(e.target.value))} className="w-full" />
        </label>
        {error && <p role="alert" className="text-sm text-brick">{error}</p>}
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={pending} className="flex-1">
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button onClick={handleDelete} disabled={pending} variant="danger">
            Delete
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
