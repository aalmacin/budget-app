import type { ReactNode } from "react";
import Link from "next/link";

type FABProps = {
  href: string;
  icon: ReactNode;
  label?: string;
  /** Bottom offset in px. Defaults to 28. */
  bottom?: number;
};

/**
 * Floating action button — sage filled circle with optional label.
 * Defaults to navigating to a route (the dashboard FAB goes to /quick-add).
 */
export function FAB({ href, icon, label, bottom = 28 }: FABProps) {
  return (
    <Link
      href={href}
      style={{ bottom }}
      className="absolute right-5 h-14 min-w-14 px-5 rounded-full bg-sage text-white flex items-center justify-center gap-2 font-medium text-sm shadow-[0_8px_24px_-6px_rgba(42,61,51,0.45)]"
      aria-label={label ?? "Add"}
    >
      {icon}
      {label && <span>{label}</span>}
    </Link>
  );
}
