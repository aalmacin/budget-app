"use client";

import { useEffect } from "react";

type ToastVariant = "info" | "success" | "error";

type ToastProps = {
  open: boolean;
  onClose: () => void;
  message: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-close. Defaults to 3500. */
  durationMs?: number;
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: "bg-sage text-white",
  success: "bg-sage text-white",
  error: "bg-brick text-white",
};

/**
 * Minimal toast — single line, fixed bottom. Caller owns the `open` state and
 * dismissal is handled via `onClose` (auto-fires on a timer after open=true).
 */
export function Toast({
  open,
  onClose,
  message,
  variant = "info",
  durationMs = 3500,
}: ToastProps) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(id);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 ${VARIANT_CLASSES[variant]}`}
    >
      {message}
    </div>
  );
}
