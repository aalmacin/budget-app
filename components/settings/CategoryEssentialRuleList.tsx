"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { setCategoryEssentialPctAction } from "@/app/(app)/settings/actions";

export type CategoryRule = {
  id: string;
  name: string;
  default_essential_pct: number;
};

type Props = { categories: CategoryRule[] };

export function CategoryEssentialRuleList({ categories }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState(100);
  const [pending, startTransition] = useTransition();

  const open = (c: CategoryRule) => {
    setEditing(c.id);
    setValue(c.default_essential_pct);
  };

  const save = () => {
    if (!editing) return;
    startTransition(async () => {
      await setCategoryEssentialPctAction(editing, value);
      setEditing(null);
    });
  };

  return (
    <div className="space-y-2">
      {categories.map((c) => (
        <div key={c.id} className="rounded-2xl bg-surface p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-ink">{c.name}</div>
              <div className="text-[11px] text-faint">
                Default {c.default_essential_pct}% essential
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => open(c)}>
              Edit
            </Button>
          </div>
          {editing === c.id && (
            <div className="mt-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={value}
                onChange={(e) => setValue(Number(e.target.value))}
                className="w-full"
                aria-label={`Essential percent for ${c.name}`}
              />
              <div className="text-[11px] text-muted text-center mt-1">
                {value}% essential
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={save} disabled={pending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
