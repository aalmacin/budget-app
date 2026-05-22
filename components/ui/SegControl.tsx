"use client";

type SegControlProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Mono label style (uppercase, small, tracking). Defaults to true to match the design. */
  mono?: boolean;
};

/**
 * Pill-style segmented control. Equal-width segments; selected segment lifts
 * on a white background.
 */
export function SegControl<T extends string>({
  options,
  value,
  onChange,
  mono = true,
}: SegControlProps<T>) {
  return (
    <div
      role="tablist"
      className="flex gap-1 p-1 bg-surface-soft rounded-xl"
    >
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt)}
            className={`flex-1 py-2 px-1 rounded-lg font-medium transition-colors ${
              mono
                ? "font-mono text-[10px] uppercase tracking-[0.8px]"
                : "text-xs"
            } ${
              selected
                ? "bg-surface text-ink shadow-sm"
                : "bg-transparent text-muted"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
