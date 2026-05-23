"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FamilyAvatar } from "@/components/ui/FamilyAvatar";
import { formatCAD, centsToDollars } from "@/lib/money";

export type MemberCardData = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
  age_years: number | null;
  monthly_income_cents: bigint;
};

type Props = {
  member: MemberCardData;
  /** Called when the user saves a new income for an adult. */
  onSaveIncome: (memberId: string, cents: bigint) => Promise<void>;
  /** Called when the user removes the member. */
  onRemove: (memberId: string) => Promise<void>;
};

export function MemberCard({ member, onSaveIncome, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [income, setIncome] = useState(centsToDollars(member.monthly_income_cents).toFixed(2));
  const [pending, startTransition] = useTransition();

  const save = () => {
    const n = Number(income);
    if (!Number.isFinite(n) || n < 0) return;
    startTransition(async () => {
      await onSaveIncome(member.id, BigInt(Math.round(n * 100)));
      setEditing(false);
    });
  };

  const remove = () => {
    if (!window.confirm(`Remove ${member.display_name}?`)) return;
    startTransition(async () => onRemove(member.id));
  };

  return (
    <div className="rounded-2xl bg-surface p-3 shadow-sm flex items-center gap-3">
      <FamilyAvatar
        initial={member.display_name.charAt(0).toUpperCase()}
        tone={member.role === "adult" ? "sage" : "sand"}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink truncate">{member.display_name}</div>
        <div className="text-[11px] text-faint">
          {member.role === "adult"
            ? `Income ${formatCAD(member.monthly_income_cents).replace("CA$", "$")}/mo`
            : `${member.age_years ?? "?"} years old`}
        </div>
      </div>
      {member.role === "adult" && !editing && (
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${member.display_name}`}
      >
        Remove
      </Button>
      {editing && (
        <div className="absolute inset-x-4 mt-32 bg-surface rounded-2xl p-3 shadow-lg">
          <label className="text-xs text-muted font-mono uppercase">Monthly income</label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={save} disabled={pending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
