"use client";

import { Chip } from "@/components/ui/Chip";

export type ForWhomOption = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
};

type Props = {
  members: ForWhomOption[];
  /** Selected member ids. Empty array = "whole household". */
  value: string[];
  onChange: (next: string[]) => void;
  /** When true, renders hidden inputs named `for_member_ids[]` for native form posts. */
  asFormField?: boolean;
};

export function ForWhomChips({ members, value, onChange, asFormField }: Props) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <>
      <div className="flex flex-wrap gap-2 py-1">
        <Chip selected={value.length === 0} onClick={() => onChange([])}>
          Household
        </Chip>
        {members.map((m) => (
          <Chip
            key={m.id}
            selected={value.includes(m.id)}
            onClick={() => toggle(m.id)}
          >
            {m.display_name}
          </Chip>
        ))}
      </div>
      {asFormField &&
        value.map((id) => (
          <input key={id} type="hidden" name="for_member_ids[]" value={id} />
        ))}
    </>
  );
}
