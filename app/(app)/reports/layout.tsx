import type { ReactNode } from "react";
import Link from "next/link";
import { AppBar } from "@/components/ui/AppBar";
import { MenuButton } from "@/components/layout/AppDrawer";
import { PageTitle } from "@/components/ui/PageTitle";

const TABS = [
  { href: "/reports/spend-over-time", label: "Spend" },
  { href: "/reports/cashflow", label: "Cashflow" },
  { href: "/reports/per-person", label: "Per-person" },
  { href: "/reports/essentials", label: "Essentials" },
];

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pt-3 pb-16">
      <AppBar left={<MenuButton />} />
      <PageTitle title="Reports" />
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3" aria-label="Reports">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface shadow-sm text-ink-2 hover:bg-surface-soft whitespace-nowrap"
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
