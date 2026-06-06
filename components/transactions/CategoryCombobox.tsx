"use client";

import { useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/Input";

export type CategoryOption = { id: string; name: string };

type CreateResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

type Props = {
  categories: CategoryOption[];
  required?: boolean;
  /** Optional initial value (canonical name of an existing category). */
  defaultValue?: string;
  /**
   * Server action that persists a new category and returns its id. When the
   * user clicks "+ Add" we call this immediately so the row exists on the
   * database before the expense form is submitted. The new option is added to
   * the local list and selected.
   */
  onCreate: (name: string) => Promise<CreateResult>;
};

/**
 * Combo input for picking an existing expense category or creating a new one.
 *
 * Submission contract:
 *   - `category_id` (hidden) — set to the matching category's UUID when the
 *     typed text exactly matches an existing name (case-insensitive). After a
 *     successful "+ Add", the newly created category becomes the exact match,
 *     so the id is populated automatically.
 *   - `category_name` (hidden) — set to the trimmed text when no exact match.
 *     Used by the server as a fallback path if the form is submitted before
 *     "+ Add" finished (or without JS).
 */
export function CategoryCombobox({
  categories: initialCategories,
  required,
  defaultValue = "",
  onCreate,
}: Props) {
  const [categories, setCategories] = useState<CategoryOption[]>(initialCategories);
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
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

  function selectExisting(name: string) {
    setQuery(name);
    setOpen(false);
    setCreateError(null);
  }

  function commitNew() {
    if (pending) return;
    const name = trimmed;
    if (!name) return;
    setCreateError(null);
    startTransition(async () => {
      const result = await onCreate(name);
      if (!result.ok) {
        setCreateError(result.error);
        return;
      }
      setCategories((prev) =>
        prev.some((c) => c.id === result.id)
          ? prev
          : [...prev, { id: result.id, name: result.name }].sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
      );
      setQuery(result.name);
      setOpen(false);
    });
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
        if (highlight < filtered.length) {
          selectExisting(filtered[highlight].name);
        } else {
          commitNew();
        }
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
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          setCreateError(null);
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
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl bg-surface shadow-lg ring-1 ring-black/5"
        >
          {filtered.map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectExisting(c.name)}
                onMouseEnter={() => setHighlight(i)}
                className={`block w-full text-left px-4 py-2 text-sm text-ink ${i === highlight ? "bg-sage/10" : ""}`}
              >
                {c.name}
              </button>
            </li>
          ))}
          {showAddNew && (
            <li role="option" aria-selected={highlight === filtered.length}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={commitNew}
                onMouseEnter={() => setHighlight(filtered.length)}
                disabled={pending}
                className={`block w-full text-left px-4 py-2 text-sm text-sage disabled:opacity-60 ${highlight === filtered.length ? "bg-sage/10" : ""}`}
              >
                {pending ? `Adding "${trimmed}"…` : <>+ Add &ldquo;{trimmed}&rdquo;</>}
              </button>
            </li>
          )}
        </ul>
      )}
      {createError && (
        <p role="alert" className="mt-1 text-xs text-brick">
          {createError}
        </p>
      )}
      <input type="hidden" name="category_id" value={categoryId} />
      <input type="hidden" name="category_name" value={categoryName} />
    </div>
  );
}
