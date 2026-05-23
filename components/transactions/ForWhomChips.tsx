"use client";

import { Chip } from "@/components/ui/Chip";

export type ForWhomOption = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
};

type Props = {
  members: ForWhomOption[];
  /** Selected member id, or `null` = "whole household". */
  value: string | null;
  onChange: (next: string | null) => void;
  /** When true, also renders a hidden input named `for_member_id` for native form posts. */
  asFormField?: boolean;
};

/**
 * "For whom" chip selector: Household + one chip per active member. Soft-
 * deleted members are assumed already filtered out at the data source.
 */
export function ForWhomChips({ members, value, onChange, asFormField }: Props) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto py-1">
        <Chip selected={value === null} onClick={() => onChange(null)}>
          Household
        </Chip>
        {members.map((m) => (
          <Chip
            key={m.id}
            selected={value === m.id}
            onClick={() => onChange(m.id)}
          >
            {m.display_name}
          </Chip>
        ))}
      </div>
      {asFormField && (
        <input type="hidden" name="for_member_id" value={value ?? ""} />
      )}
    </>
  );
}
