"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icons";

export function AddFAB() {
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
    <div ref={containerRef} className="absolute right-5" style={{ bottom: 28 }}>
      {open && (
        <nav
          aria-label="Add options"
          className="absolute bottom-[calc(100%+8px)] right-0 bg-surface rounded-2xl shadow-xl overflow-hidden min-w-[152px]"
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
      <button
        type="button"
        aria-label={open ? "Close add menu" : "Open add menu"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="h-14 w-14 rounded-full bg-sage text-white flex items-center justify-center shadow-[0_8px_24px_-6px_rgba(42,61,51,0.45)]"
      >
        {open ? Icon.close(20) : Icon.plus(20)}
      </button>
    </div>
  );
}
