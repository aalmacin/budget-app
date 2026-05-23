# Phase 1 Data Model: Supabase Foundation for Budget App

**Feature**: 001-setup-supabase
**Date**: 2026-05-22
**Schema**: all tables live in `budget` (FR-013)

---

## Entities

### `auth.users` (managed by Supabase Auth)

Not owned by this feature. Referenced for ownership constraints. Relevant fields used by this app:

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` (PK) | Stable user identifier. Used as the owner reference in all app tables. Provided by `auth.uid()` inside RLS-evaluated queries. |
| `email` | `text` | The sign-in handle. Displayed in the app shell header. |

---

### `budget.categories` (NEW)

A user-owned classification used to group transactions.

| Field | Type | Constraints | Source FR / Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | Surrogate identifier |
| `name` | `text` | `NOT NULL`, length 1..100 | Human-readable label (e.g., "Groceries", "Salary") |
| `kind` | `text` | `NOT NULL`, `CHECK (kind IN ('income','expense'))` | Income vs expense classification (Key Entities definition) |
| `user_id` | `uuid` | `NOT NULL`, `DEFAULT auth.uid()`, `REFERENCES auth.users(id) ON DELETE CASCADE` | FR-008, FR-009 |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | Audit |

**Indexes / Constraints**

- `PRIMARY KEY (id)`
- `UNIQUE (user_id, name)` — FR-016 (uniqueness is per-user; two users may each have "Groceries")
- `INDEX (user_id)` — supports per-user listings under RLS

**RLS**

- `ALTER TABLE budget.categories ENABLE ROW LEVEL SECURITY;`
- Policy `categories_owner FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` — FR-010
- Grant `SELECT, INSERT, UPDATE, DELETE` to `authenticated`. No grants to `anon`.

---

### `budget.transactions` (NEW)

A single user-owned monetary event, classified by exactly one Category owned by the same user.

| Field | Type | Constraints | Source FR / Notes |
|---|---|---|---|
| `id` | `bigserial` | PK | Surrogate identifier |
| `amount` | `numeric(14,2)` | `NOT NULL` | Signed monetary amount (sign convention enforced at the application layer in a later feature; database accepts any sign here) |
| `occurred_on` | `date` | `NOT NULL` | The date the transaction took place (calendar date, not timestamp) |
| `note` | `text` | nullable, length ≤ 500 | Optional short description |
| `category_id` | `bigint` | `NOT NULL`, `REFERENCES budget.categories(id) ON DELETE RESTRICT` | FR-017 — RESTRICT means a category with transactions cannot be deleted |
| `user_id` | `uuid` | `NOT NULL`, `DEFAULT auth.uid()`, `REFERENCES auth.users(id) ON DELETE CASCADE` | FR-008, FR-009 |
| `created_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | Audit |

**Indexes / Constraints**

- `PRIMARY KEY (id)`
- `INDEX (user_id, occurred_on DESC)` — supports per-user date-ordered listings
- `INDEX (category_id)` — supports per-category aggregations later

**Cross-user reference guard (FR-017)**

A row-level trigger `budget.assert_transaction_category_owner` runs `BEFORE INSERT OR UPDATE` on `budget.transactions` and asserts:

```sql
SELECT user_id INTO category_owner FROM budget.categories WHERE id = NEW.category_id;
IF category_owner IS DISTINCT FROM NEW.user_id THEN
  RAISE EXCEPTION 'category_id % does not belong to user %', NEW.category_id, NEW.user_id;
END IF;
```

This guard is in addition to RLS, not a replacement: RLS would already block selecting a category owned by another user, but the trigger gives a clear error even for privileged direct inserts (e.g., admin scripts) and documents the invariant.

**RLS**

- `ALTER TABLE budget.transactions ENABLE ROW LEVEL SECURITY;`
- Policy `transactions_owner FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` — FR-010
- Grant `SELECT, INSERT, UPDATE, DELETE` to `authenticated`. No grants to `anon`.

---

## Relationships

```text
auth.users (1) ─── (M) budget.categories
auth.users (1) ─── (M) budget.transactions
budget.categories (1) ─── (M) budget.transactions   [same user_id enforced]
```

- A user can have any number of categories and transactions.
- A transaction has exactly one category. Cascade-delete of `auth.users` cascades to both tables; deleting a category that still has transactions is rejected (`ON DELETE RESTRICT`).

---

## Lifecycle / State Transitions

Neither entity has explicit lifecycle states beyond create/update/delete. There is no soft-delete, archive, or status column in this feature.

---

## Validation Rules (mapped to FRs)

| Rule | Enforced at | Source |
|---|---|---|
| Ownership defaults to the current authenticated user on insert | DB default `auth.uid()` on `user_id` | FR-009 |
| A user only sees their own rows | RLS `USING (auth.uid() = user_id)` | FR-010 / SC-002 |
| A user can only modify their own rows | RLS `WITH CHECK (auth.uid() = user_id)` | FR-010 |
| Category name unique per user | `UNIQUE (user_id, name)` | FR-016 |
| Transaction's category belongs to the same user | trigger `assert_transaction_category_owner` | FR-017 |
| Category with transactions cannot be deleted | `ON DELETE RESTRICT` on FK | FR-017 |
| All app tables live in `budget` schema | Schema-qualified DDL; PostgREST exposes `budget` only | FR-013 / SC-005 |
| No hardcoded user UUIDs in migrations | Reviewed during code review of migration files | FR-012a |

---

## What this feature does **not** define

- No transaction `currency`, `account_id`, `payee`, `tags`, `budget_amount`, or `period` — those are deliberately out of scope per Q2 clarification (Categories + Transactions only).
- No views, RPC functions, or materialized aggregates — Principle III's RPC layer is introduced when the first client CRUD UI lands (see research.md R8).
- No `updated_at` columns — would require a generic update trigger; deferred until first feature that actually displays "last updated".
