"use client";

import { useEffect, type ReactNode } from "react";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** ARIA label or labelled-by-id for the sheet container. */
  ariaLabel: string;
  children: ReactNode;
};

/**
 * Bottom sheet modal — slides up from the bottom on mobile. Plain CSS, no
 * portal (rendering inline keeps SSR simple). Esc closes; click on backdrop
 * closes.
 */
export function Sheet({ open, onClose, ariaLabel, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-end"
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div className="relative w-full bg-surface rounded-t-3xl shadow-2xl max-h-[85vh] overflow-auto pb-safe">
        {children}
      </div>
    </div>
  );
}
