"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";
import { drawerActions } from "@/store/slices/drawer";
import { useAppDispatch, useAppSelector } from "@/store";
import { signOutAction } from "@/app/(app)/_actions/signout";

type DrawerLink = {
  href: string;
  label: string;
  /** Section grouping for visual divider in the drawer. */
  section: "main" | "money" | "household";
};

// NOTE: Taxes is intentionally absent per spec clarification §6 (US8 removed in v1).
const LINKS: DrawerLink[] = [
  { href: "/dashboard", label: "Dashboard", section: "main" },
  { href: "/transactions", label: "Transactions", section: "money" },
  { href: "/reports/monthly", label: "Reports", section: "money" },
  { href: "/recurring-transactions", label: "Recurring Transactions", section: "money" },
  { href: "/family", label: "Family", section: "household" },
  { href: "/settings", label: "Settings", section: "household" },
];

export function MenuButton() {
  const dispatch = useAppDispatch();
  return (
    <IconButton
      icon={Icon.menu(18)}
      aria-label="Open navigation"
      onClick={() => dispatch(drawerActions.open())}
    />
  );
}

export function AppDrawer() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.drawer.open);
  const pathname = usePathname();

  // Auto-close on route change.
  useEffect(() => {
    dispatch(drawerActions.close());
  }, [pathname, dispatch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch(drawerActions.close());
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dispatch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        type="button"
        aria-label="Dismiss navigation"
        className="absolute inset-0 bg-ink/40"
        onClick={() => dispatch(drawerActions.close())}
      />
      <nav className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-line">
          <span className="font-mono text-xs uppercase tracking-[4px] text-sage font-medium">
            Budget
          </span>
          <IconButton
            icon={Icon.close(18)}
            aria-label="Close navigation"
            onClick={() => dispatch(drawerActions.close())}
          />
        </div>
        <ul className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {LINKS.map((link, i) => {
            const prev = LINKS[i - 1];
            const showDivider = prev && prev.section !== link.section;
            const active = pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                {showDivider && (
                  <hr className="my-2 mx-3 border-line" aria-hidden="true" />
                )}
                <Link
                  href={link.href}
                  className={`block px-3 py-2.5 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-sage text-white font-medium"
                      : "text-ink hover:bg-surface-soft"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <form action={signOutAction} className="px-3 py-3 border-t border-line">
          <button
            type="submit"
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-ink-2 hover:bg-surface-soft"
          >
            Sign out
          </button>
        </form>
      </nav>
    </div>
  );
}
