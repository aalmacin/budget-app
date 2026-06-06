"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FamilyAvatar } from "@/components/ui/FamilyAvatar";

export type MemberCardData = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
  age_years: number | null;
};

type Props = {
  member: MemberCardData;
  onSaveDisplayName: (memberId: string, name: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
};

export function MemberCard({ member, onSaveDisplayName, onRemove }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.display_name);
  const [pending, startTransition] = useTransition();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) return;
    startTransition(async () => {
      await onSaveDisplayName(member.id, trimmed);
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
        {member.role === "kid" && (
          <div className="text-[11px] text-faint">
            {member.age_years ?? "?"} years old
          </div>
        )}
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
          <label className="text-xs text-muted font-mono uppercase">Display name</label>
          <Input
            type="text"
            value={name}
            maxLength={100}
            onChange={(e) => setName(e.target.value)}
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
