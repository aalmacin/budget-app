"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { centsToDollars } from "@/lib/money";

type Props = {
  categoryId: string | null;
  categoryName: string;
  currentLimitCents: bigint | null;
  onClose: () => void;
  onSave: (categoryId: string, cents: bigint | null) => Promise<void>;
};

export function EditLimitSheet({
  categoryId,
  categoryName,
  currentLimitCents,
  onClose,
  onSave,
}: Props) {
  const [value, setValue] = useState(
    currentLimitCents ? centsToDollars(currentLimitCents).toFixed(2) : "",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!categoryId) return;
    setError(null);
    const n = Number(value);
    let cents: bigint | null = null;
    if (value !== "" && (!Number.isFinite(n) || n < 0)) {
      setError("Limit must be a non-negative number");
      return;
    }
    if (value !== "" && n > 0) cents = BigInt(Math.round(n * 100));
    startTransition(async () => {
      try {
        await onSave(categoryId, cents);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <Sheet open={!!categoryId} onClose={onClose} ariaLabel="Edit monthly limit">
      <div className="p-4 space-y-3">
        <h2 className="text-base font-medium text-ink">
          {categoryName} · monthly limit
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted font-mono uppercase tracking-wider">
            Limit (leave blank to clear)
          </span>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 800.00"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-brick">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending} className="flex-1">
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
