"use client";

import { Chip } from "@/components/ui/Chip";

export type SplitRule = "adult_a" | "adult_b" | "50_50" | "by_income";

type Props = {
  value: SplitRule | null;
  onChange: (next: SplitRule | null) => void;
  /** Display names for Adult A / Adult B (display_order 1 and 2). */
  adultALabel?: string;
  adultBLabel?: string;
  /** When true, also renders a hidden input named `split_rule`. */
  asFormField?: boolean;
};

/**
 * The four FR-015 split-rule chips. Selecting one drives `apply_split_rule`
 * on the server side; the chip set is the only UI surface for choosing.
 */
export function SplitRuleChips({
  value,
  onChange,
  adultALabel = "Adult A 100%",
  adultBLabel = "Adult B 100%",
  asFormField,
}: Props) {
  return (
    <>
      <div className="flex gap-2 overflow-x-auto py-1">
        <Chip selected={value === null} onClick={() => onChange(null)}>
          Unsplit
        </Chip>
        <Chip selected={value === "adult_a"} onClick={() => onChange("adult_a")}>
          {adultALabel}
        </Chip>
        <Chip selected={value === "adult_b"} onClick={() => onChange("adult_b")}>
          {adultBLabel}
        </Chip>
        <Chip selected={value === "50_50"} onClick={() => onChange("50_50")}>
          50/50
        </Chip>
        <Chip selected={value === "by_income"} onClick={() => onChange("by_income")}>
          By income
        </Chip>
      </div>
      {asFormField && (
        <input type="hidden" name="split_rule" value={value ?? ""} />
      )}
    </>
  );
}
