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
- `ALTER TABLE budget.categories FORCE ROW LEVEL SECURITY;` — applies RLS to the table owner too, so SECURITY DEFINER RPCs (running as `postgres`) are still filtered.
- Policy `categories_owner FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` — FR-010. `TO public` (not `TO authenticated`) so the policy applies even when the SECURITY DEFINER RPC runs as `postgres`.
- **No direct grants** to `authenticated` or `anon` — see migration `20260522000005_lockdown_budget_grants.sql`. All CRUD must go through SECURITY DEFINER RPCs (Principle III). Closes Supabase Advisor lint `pg_graphql_authenticated_table_exposed`.

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
- `ALTER TABLE budget.transactions FORCE ROW LEVEL SECURITY;` — applies RLS to the table owner too.
- Policy `transactions_owner FOR ALL TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);` — FR-010.
- **No direct grants** to `authenticated` or `anon` — see migration `20260522000005_lockdown_budget_grants.sql`. All CRUD must go through SECURITY DEFINER RPCs (Principle III).

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
- ~~No views, RPC functions, or materialized aggregates~~ **Superseded by Phase 7**: ~25 SECURITY DEFINER RPCs cover every client mutation and every household-scoped read (research.md R10/R14).
- ~~No `updated_at` columns~~ **Superseded by Phase 7**: every new table carries `updated_at` (maintained by `budget.update_timestamp()`).

---

## Phase 7 entities — Household model

These entities are introduced by Phase 7 (see `tasks.md` Phase 7 and `spec.md` US4–US8). They supersede the user-owned versions of `budget.categories` and `budget.transactions` defined in Phase 4: those tables are dropped (T058) and recreated with `household_id` ownership.

**Common conventions for Phase 7 tables**

- All tables enable AND `FORCE ROW LEVEL SECURITY` (matches the R10 lockdown pattern from Phase 6).
- All policies are scoped `TO public` (so SECURITY DEFINER RPCs running as `budget_function_owner` are still subject to RLS).
- No direct grants to `authenticated`/`anon` — every CRUD path goes through a SECURITY DEFINER RPC owned by `budget_function_owner` (FR-025, FR-026).
- `created_at` and `updated_at` default to `now()`; `updated_at` is maintained by a `BEFORE UPDATE` trigger calling `budget.update_timestamp()` (T055).

---

### `budget.household` (NEW — T056)

A budgeting unit, typically a family. Created in US4 onboarding.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | |
| `name` | `text` | `NOT NULL` | User-supplied display name |
| `currency` | `text` | `NOT NULL`, `DEFAULT 'CAD'` | v1 is CAD-only (settings page documents this) |
| `owner_user_id` | `uuid` | `NOT NULL`, `REFERENCES auth.users(id)` | Audit field; not used by RLS |
| `created_at`, `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |

**RLS**: policy `household_household_isolation FOR ALL TO public USING (id IN (SELECT * FROM budget.auth_user_household_ids())) WITH CHECK (same)`.

### `budget.household_member` (NEW — T057)

A person who belongs to a household.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | |
| `household_id` | `uuid` | `NOT NULL`, `REFERENCES budget.household(id) ON DELETE CASCADE` | |
| `user_id` | `uuid` | nullable, `REFERENCES auth.users(id)` | NULL for kids without accounts |
| `role` | `text` | `NOT NULL`, `CHECK (role IN ('adult','kid'))` | |
| `display_name` | `text` | `NOT NULL` | |
| `age_years` | `smallint` | `CHECK (age_years BETWEEN 0 AND 25)`, nullable | Required for kids, forbidden for adults (FR-027) |
| `avatar_url` | `text` | nullable | |
| `monthly_income_cents` | `bigint` | `NOT NULL`, `DEFAULT 0`, `CHECK (>=0)` | Used by US8 income-split |
| `deleted_at` | `timestamptz` | nullable | Soft-delete; preserves historical attribution (FR-028) |
| `created_at`, `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |

**Constraint** `household_member_age_for_kid_only`: kids must have `age_years`, adults must not.

**Indexes**:
- `UNIQUE (household_id, user_id) WHERE user_id IS NOT NULL` — each linked auth user appears at most once per household.
- `(household_id) WHERE deleted_at IS NULL` — supports the active-member queries.

**Triggers**:
- `enforce_adult_cap` `BEFORE INSERT OR UPDATE` — rejects a 3rd active adult with `P0001 'Households are limited to 2 adults'` (FR-027).
- `forbid_undelete_of_adult_when_capped` `BEFORE UPDATE OF deleted_at` — rejects flipping deleted_at non-null→null on an adult if it would breach the cap (FR-027).
- `update_timestamp` trigger.

**RLS**: policy `household_member_household_isolation FOR ALL TO public USING (household_id IN (SELECT * FROM budget.auth_user_household_ids())) WITH CHECK (same)`.

### `budget.category` (REDESIGNED — T058 drops the Phase 4 version, T059 recreates)

Now household-scoped, with `household_id IS NULL` rows serving as system-global seeds.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | |
| `household_id` | `uuid` | nullable, `REFERENCES budget.household(id) ON DELETE CASCADE` | NULL = system-global seed (FR-024) |
| `name` | `text` | `NOT NULL` | |
| `default_essential_pct` | `smallint` | `NOT NULL`, `DEFAULT 100`, `CHECK (0..100)` | |
| `monthly_budget_cents` | `bigint` | nullable, `CHECK (null or >=0)` | NULL = no budget set |
| `kind` | `text` | `NOT NULL`, `DEFAULT 'expense'`, `CHECK (kind IN ('expense','income'))` | |
| `created_at`, `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |

**Indexes**: `(household_id)`.

**Seed rows**: 13 system-global categories per legacy `0003_transactions.sql:42–56` (Groceries, Utilities, Transport, Kids, Health, Subscriptions, Eating Out, Entertainment, Rogers, Bell, RESP, TFSA, Income).

**RLS**:
- `category_select_visible FOR SELECT TO public USING (household_id IS NULL OR household_id IN (SELECT * FROM budget.auth_user_household_ids()))`
- `category_write_own_household FOR ALL TO public USING (household_id IN (...)) WITH CHECK (household_id IN (...))` — note this excludes system seeds from writes; clone-on-write happens at the RPC layer.

### `budget.transaction` (REDESIGNED — T058 drops the Phase 4 version, T061 recreates)

Now household-scoped with the full attribute set.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK — **NO default; client-supplied UUID v7** | FR-031 — offline-replay idempotency |
| `household_id` | `uuid` | `NOT NULL`, `REFERENCES budget.household(id) ON DELETE CASCADE` | |
| `type` | `text` | `NOT NULL`, `CHECK (type IN ('expense','income'))` | |
| `amount_cents` | `bigint` | `NOT NULL`, `CHECK (>0)` | Always positive; sign encoded by `type` |
| `occurred_on` | `date` | `NOT NULL` | |
| `category_id` | `uuid` | `NOT NULL`, `REFERENCES budget.category(id) ON DELETE RESTRICT` | FR-030 |
| `notes` | `text` | `NOT NULL`, `DEFAULT ''` | |
| `paid_by_member_id` | `uuid` | nullable, `REFERENCES budget.household_member(id)` | FR-029 |
| `for_member_id` | `uuid` | nullable, `REFERENCES budget.household_member(id)` | FR-029 |
| `essential_pct` | `smallint` | `NOT NULL`, `DEFAULT 100`, `CHECK (0..100)` | |
| `split_rule` | `text` | nullable, `CHECK (IN ('adult_a','adult_b','50_50','by_income'))` | |
| `income_source` | `text` | nullable, `CHECK (IN ('Salary','Contract','Self_employed','Benefit','Refund','Gift'))` | Only for `type='income'` |
| `subscription_id` | `uuid` | nullable | Set on auto-materialized rows (FR-032) |
| `occurrence_date` | `date` | nullable | Set on auto-materialized rows (FR-032) |
| `created_at`, `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |

**Indexes**:
- `(household_id, occurred_on DESC)` — per-household timeline
- `(household_id, category_id, occurred_on)` — per-category drill-down
- `UNIQUE (subscription_id, occurrence_date) WHERE subscription_id IS NOT NULL AND occurrence_date IS NOT NULL` — FR-032 idempotency
- GIN `to_tsvector('simple', notes)` — `list_transactions` free-text search

**Trigger**: `enforce_member_household` (constraint trigger, `DEFERRABLE INITIALLY DEFERRED`, `AFTER INSERT OR UPDATE OF household_id, for_member_id, paid_by_member_id`) — both member references must belong to the same household as the transaction (FR-029).

**RLS**: `transaction_select FOR SELECT TO public USING (household_id IN (...))`. **No write policy** — writes go through RPCs (FR-025, FR-026). The grant lockdown (T063) is what prevents direct DML.

### `budget.subscription` (NEW — T062)

A recurring expense materialized by cron.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, `DEFAULT gen_random_uuid()` | |
| `household_id` | `uuid` | `NOT NULL`, `REFERENCES budget.household(id) ON DELETE CASCADE` | |
| `merchant` | `text` | `NOT NULL` | |
| `amount_cents` | `bigint` | `NOT NULL`, `CHECK (>0)` | |
| `category_id` | `uuid` | `NOT NULL`, `REFERENCES budget.category(id) ON DELETE RESTRICT` | |
| `cadence` | `text` | `NOT NULL`, `CHECK (IN ('weekly','biweekly','monthly','quarterly','yearly'))` | |
| `next_renewal_at` | `date` | `NOT NULL` | Driver for the materialization cron |
| `paid_by_member_id`, `for_member_id` | `uuid` | nullable | Propagated onto materialized transactions |
| `essential_pct` | `smallint` | `NOT NULL`, `DEFAULT 100`, `CHECK (0..100)` | |
| `split_rule` | `text` | nullable, same enum as `transaction.split_rule` | |
| `active` | `boolean` | `NOT NULL`, `DEFAULT true` | `pause_subscription` flips to false |
| `created_at`, `updated_at` | `timestamptz` | `NOT NULL`, `DEFAULT now()` | |

**Indexes**: `(household_id, next_renewal_at) WHERE active = true` — supports both UI sorting and the cron scan.

**RLS**: policy `subscription_household_isolation FOR ALL TO public USING (...) WITH CHECK (...)`.

### `budget.auth_user_household_ids()` (NEW helper — T060, fixed in `20260524000016`)

```sql
RETURNS setof uuid
LANGUAGE sql
STABLE
SECURITY DEFINER         -- owner = postgres → bypasses RLS, breaks helper/policy recursion
SET search_path = ''
AS $$
  SELECT hm.household_id
  FROM budget.household_member hm
  WHERE hm.user_id = auth.uid()
    AND hm.deleted_at IS NULL;
$$;
```

Every household-scoped RLS policy reads from this helper. Marked `STABLE` (deterministic within a statement, safe to memoize).

**Why `SECURITY DEFINER`** (not the legacy `SECURITY INVOKER`): the policy on `budget.household_member` references this helper, and the helper itself selects from `budget.household_member`. As `SECURITY INVOKER` under any non-superuser role, the inner SELECT triggers the policy that calls the helper — infinite recursion. Owning the function as `postgres` (a superuser) makes the inner SELECT bypass RLS, breaking the cycle. The helper only ever returns the caller's own household ids — there's no further filtering RLS could meaningfully add. `auth.uid()` still resolves to the caller because it reads `request.jwt.claims` from session state, not from the function's effective role.

---

## Relationships (Phase 7)

```text
auth.users (1) ─── (M) budget.household_member (M) ─── (1) budget.household
                                                              │
                                       ┌──────────────────────┼──────────────────────┐
                                       ▼                      ▼                      ▼
                              budget.category         budget.transaction      budget.subscription
                              (household-scoped               │                      │
                               + system seeds)                ▼                      │
                                       ▲             (M references budget.category   │
                                       └───────────────────── via category_id)       │
                                                              ▲                      │
                                                              │ (subscription_id     │
                                                              │  on materialized     │
                                                              │  rows)               │
                                                              └──────────────────────┘
```
