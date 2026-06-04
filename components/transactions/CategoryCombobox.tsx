"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/Input";

export type CategoryOption = { id: string; name: string };

type Props = {
  categories: CategoryOption[];
  required?: boolean;
  /** Optional initial value (canonical name of an existing category). */
  defaultValue?: string;
};

/**
 * Combo input for picking an existing expense category or creating a new one.
 *
 * Submission contract:
 *   - `category_id` (hidden) — set to the matching category's UUID when the
 *     typed text exactly matches an existing name (case-insensitive). Empty
 *     otherwise.
 *   - `category_name` (hidden) — set to the trimmed text when no exact match;
 *     the server creates the category before logging the expense.
 */
export function CategoryCombobox({ categories, required, defaultValue = "" }: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();
  const filtered = trimmed
    ? categories.filter((c) => c.name.toLowerCase().includes(lowerQuery))
    : categories;
  const exact = categories.find((c) => c.name.toLowerCase() === lowerQuery);
  const showAddNew = trimmed.length > 0 && !exact;
  const totalItems = filtered.length + (showAddNew ? 1 : 0);

  const categoryId = exact?.id ?? "";
  const categoryName = exact ? "" : trimmed;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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
        if (highlight < filtered.length) {
          setQuery(filtered[highlight].name);
        }
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search or add category"
        required={required}
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
          className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl bg-surface shadow-lg ring-1 ring-black/5"
        >
          {filtered.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(c.name);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={`px-4 py-2 cursor-pointer text-sm text-ink ${i === highlight ? "bg-sage/10" : ""}`}
            >
              {c.name}
            </li>
          ))}
          {showAddNew && (
            <li
              role="option"
              aria-selected={highlight === filtered.length}
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              onMouseEnter={() => setHighlight(filtered.length)}
              className={`px-4 py-2 cursor-pointer text-sm text-sage ${highlight === filtered.length ? "bg-sage/10" : ""}`}
            >
              + Add &ldquo;{trimmed}&rdquo;
            </li>
          )}
        </ul>
      )}
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="category_name" value={categoryName} />
    </div>
  );
}
