import type { ButtonHTMLAttributes, ReactNode } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  icon?: ReactNode;
};

/**
 * Filter / selection chip. Matches the HIFI design language:
 *   - unselected: surface bg, ink2 text
 *   - selected: ink bg, white text
 */
export function Chip({
  selected = false,
  icon,
  className = "",
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-colors ${
        selected
          ? "bg-ink text-white shadow-none"
          : "bg-surface text-ink-2 hover:bg-surface-soft"
      } ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
