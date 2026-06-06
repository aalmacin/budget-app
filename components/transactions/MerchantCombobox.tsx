"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/Input";

type Props = {
  merchants: string[];
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  maxLength?: number;
};

/**
 * Free-text combobox for the "Merchant / notes" field. The visible input owns
 * the form value (no hidden mirror) — merchants are stored inline in
 * `transaction.notes`, so there's no separate id to track. Suggestions are
 * previous merchants used by the household; picking one fills the input.
 */
export function MerchantCombobox({
  merchants,
  name = "notes",
  defaultValue = "",
  placeholder = "e.g. Whole Foods",
  maxLength = 200,
}: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  const filtered = trimmed
    ? merchants.filter((m) => m.toLowerCase().includes(lowerQuery))
    : merchants;
  const totalItems = filtered.length;

  function pick(value: string) {
    setQuery(value);
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (totalItems === 0 ? 0 : Math.min(h + 1, totalItems - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && totalItems > 0) {
        e.preventDefault();
        pick(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <Input
        ref={inputRef}
        name={name}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
      />
      {open && totalItems > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl bg-surface shadow-lg ring-1 ring-black/5"
        >
          {filtered.map((m, i) => (
            <li key={m} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full text-left px-4 py-2 text-sm text-ink ${i === highlight ? "bg-sage/10" : ""}`}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
