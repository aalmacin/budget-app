"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";

export function AddMenuButton() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <IconButton
        icon={open ? Icon.close(18) : Icon.plus(18)}
        aria-label={open ? "Close add menu" : "Open add menu"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <nav
          aria-label="Add options"
          className="absolute top-[calc(100%+8px)] right-0 z-40 bg-surface rounded-2xl shadow-xl overflow-hidden min-w-[152px]"
        >
          <Link
            href="/quick-add"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink border-b border-line hover:bg-surface-soft"
          >
            Quick Add
          </Link>
          <Link
            href="/add"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink border-b border-line hover:bg-surface-soft"
          >
            Add Expense
          </Link>
          <Link
            href="/add-income"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-ink hover:bg-surface-soft"
          >
            Add Income
          </Link>
        </nav>
      )}
    </div>
  );
}
