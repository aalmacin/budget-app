"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reports/monthly", label: "Monthly" },
  { href: "/reports/spend-over-time", label: "Spend" },
  { href: "/reports/cashflow", label: "Cashflow" },
  { href: "/reports/per-person", label: "Per-person" },
  { href: "/reports/essentials", label: "Essentials" },
];

export function ReportsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Reports">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
            pathname === t.href
              ? "bg-ink text-white shadow-none"
              : "bg-surface shadow-sm text-ink-2 hover:bg-surface-soft"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
