# Phase 1 Data Model — Family Budget App

All tables live in schema `public`, RLS is enabled on every table, and every row carries a `household_id` (directly or via FK chain) used by RLS policies. Money is stored as **`bigint` cents (CAD subunits)**. Timestamps are `timestamptz` in UTC; CRA deadlines are computed in `America/Toronto` via `date-fns-tz` at the application edge.

Conventions:
- Primary keys are `uuid` defaulting to `gen_random_uuid()` unless noted.
- Foreign keys cascade on delete only when the child is genuinely owned by the parent (`transaction → household` cascades; `transaction → category` restricts).
- `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` are added to every table; an `update_timestamp()` trigger maintains `updated_at`.
- Every table gets an RLS policy named `<table>_household_isolation` of the form `using (household_id in (select household_id from household_member where user_id = auth.uid()))`. Variants are noted below where they differ.

---

## 1. `household`

A shared financial unit.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | "The Almacin household" etc. |
| `currency` | `text` not null default `'CAD'` | v1 hard-codes CAD; column kept for forward compat |
| `province` | `text` not null default `'ON'` | ISO-3166-2 subdivision code (`ON`, `BC`, `AB`, `QC`, ...) |
| `tax_profile` | `text` not null default `'employee'` | One of `employee`, `sole_proprietor`, `mixed`. Drives Taxes screen. |
| `gst_hst_registrant` | `boolean` not null default `false` | |
| `owner_user_id` | `uuid` not null | `auth.users.id` — set at creation |

**RLS**: row is visible iff `id in (select household_id from household_member where user_id = auth.uid())`.

**Constraints**: `tax_profile in ('employee','sole_proprietor','mixed')`.

---

## 2. `household_member`

Joins `auth.users` to a household. Has at most 2 rows with `role = 'adult'` per household (CHECK enforced by trigger; see "Constraints" section at end).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `user_id` | `uuid` nullable FK→`auth.users.id` | Null for kids; set for adults |
| `role` | `text` not null | `'adult'` or `'kid'` |
| `display_name` | `text` not null | |
| `age_years` | `smallint` nullable | Required when `role = 'kid'` |
| `avatar_url` | `text` nullable | |
| `monthly_income_cents` | `bigint` not null default 0 | Used by `compute_income_split`. Stays 0 for kids. |

**RLS**: same household-isolation policy. Plus a stricter policy on `UPDATE` of `monthly_income_cents`: only adults of the same household may update an adult member's income.

**Constraints**:
- `role in ('adult','kid')`
- `age_years` not null when `role = 'kid'`
- `monthly_income_cents >= 0`
- Trigger: at most 2 rows per `household_id` with `role = 'adult'`

---

## 3. `household_invite`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `email` | `citext` not null | Invitee email (case-insensitive) |
| `token` | `text` not null unique | Opaque, ~32 bytes base64url, generated server-side |
| `expires_at` | `timestamptz` not null | `now() + interval '7 days'` default |
| `accepted_at` | `timestamptz` nullable | Set by `accept_invite()` |
| `revoked_at` | `timestamptz` nullable | Set when owner cancels |

**RLS**: visible only to owners of the household; INSERT only via `create_invite()` RPC.

---

## 4. `category`

System-seeded categories live with `household_id = null` and are read-only to everyone. Per-household overrides clone them when a user changes `default_essential_pct` or `monthly_budget_cents`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` nullable FK→`household.id` ON DELETE CASCADE | Null = system-seeded global |
| `name` | `text` not null | "Groceries", "Utilities", "Kids · RESP", etc. |
| `default_essential_pct` | `smallint` not null default 100 | 0..100. Auto-applied to new expenses when not overridden. |
| `monthly_budget_cents` | `bigint` nullable | When set, drives the budget overview |
| `kind` | `text` not null default `'expense'` | `'expense'` or `'income'` |

**Seed data** (system-global, `household_id = null`): Groceries(80), Utilities(100), Transport(70), Kids(90), Health(100), Subscriptions(40), Eating Out(20), Entertainment(0), Rogers(100), Bell(100), RESP(100), TFSA(100). Income kinds: T4, T4A, Self-employed, CCB, Refund, Gift.

**RLS**: visible if `household_id is null` OR row's household is one the caller belongs to.

---

## 5. `transaction`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Client-generated (UUID v7) to make offline replays idempotent |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `type` | `text` not null | `'expense'` or `'income'` |
| `amount_cents` | `bigint` not null | Always > 0; `type` carries the sign |
| `occurred_on` | `date` not null | The transaction's user-facing date |
| `category_id` | `uuid` not null FK→`category.id` ON DELETE RESTRICT | |
| `notes` | `text` not null default `''` | Free-form merchant/note text, indexed for search |
| `paid_by_member_id` | `uuid` nullable FK→`household_member.id` | Adult who paid (expense) or earner (income) |
| `for_member_id` | `uuid` nullable FK→`household_member.id` | Null = whole household; else the specific Member |
| `essential_pct` | `smallint` not null | 0..100 — portion that counts as essential |
| `split_rule` | `text` nullable | `'adult_a' \| 'adult_b' \| '50_50' \| 'by_income' \| null` (null = unsplit / single-adult household) |
| `income_source` | `text` nullable | For `type='income'`: `T4 \| T4A \| Self_employed \| CCB \| Refund \| Gift` |
| `subscription_id` | `uuid` nullable FK→`subscription.id` ON DELETE SET NULL | Set by auto-log |
| `occurrence_date` | `date` nullable | Only set when subscription-auto-logged; participates in the unique index below |

**Indexes**:
- `(household_id, occurred_on desc)` — drives transactions list pagination
- `(household_id, category_id, occurred_on)` — drives budget progress
- `unique (subscription_id, occurrence_date) where subscription_id is not null` — guarantees idempotent auto-log
- `gin (to_tsvector('simple', notes))` — drives search by merchant/notes (FR-022)

**RLS**: standard household-isolation. INSERT/UPDATE/DELETE only via RPC; direct INSERTs are blocked by policy.

**Constraints**:
- `essential_pct between 0 and 100`
- `amount_cents > 0`
- `type in ('expense','income')`
- `split_rule in ('adult_a','adult_b','50_50','by_income')` when set
- `for_member_id` belongs to same household (deferred trigger)

---

## 6. `subscription`

A recurring expense template. `materialize_due_subscriptions()` inserts a `transaction` per occurrence.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `merchant` | `text` not null | "Netflix", "Bell internet" |
| `amount_cents` | `bigint` not null | |
| `category_id` | `uuid` not null FK→`category.id` ON DELETE RESTRICT | |
| `cadence` | `text` not null | `'weekly' \| 'biweekly' \| 'monthly' \| 'quarterly' \| 'yearly'` |
| `next_renewal_at` | `date` not null | Advanced by `materialize_due_subscriptions` |
| `paid_by_member_id` | `uuid` nullable FK→`household_member.id` | |
| `for_member_id` | `uuid` nullable FK→`household_member.id` | |
| `essential_pct` | `smallint` not null | 0..100 |
| `split_rule` | `text` nullable | Same domain as `transaction.split_rule` |
| `active` | `boolean` not null default true | Paused subs do not auto-log |

**RLS**: standard.

---

## 7. `deduction`

A Canadian tax-relevant entry. Independent of `transaction` because the same dollar amount may not always be a deductible (e.g., a portion of home utilities is a T2125 deduction).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `member_id` | `uuid` not null FK→`household_member.id` ON DELETE CASCADE | The filer this deduction belongs to |
| `cra_category` | `text` not null | `T2125_home_office \| T2125_vehicle \| T2202_tuition \| private_health_premium \| other` |
| `amount_cents` | `bigint` not null | |
| `occurred_on` | `date` not null | |
| `notes` | `text` not null default `''` | |
| `tax_year` | `smallint` not null | Stored for filing-year rollups |

**RLS**: standard household-isolation.

---

## 8. `gst_hst_setaside`

A running ledger of GST/HST set-aside. Append-only; positive entries from income, negative entries on remittance.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `amount_cents` | `bigint` not null | Signed; positive=set aside, negative=remitted |
| `occurred_on` | `date` not null | |
| `transaction_id` | `uuid` nullable FK→`transaction.id` ON DELETE SET NULL | Source income/expense, if any |
| `notes` | `text` not null default `''` | |

**RLS**: standard.

---

## 9. Derived / virtual: income-proportional split

Not a table — a function. Re-derives ratios on every read.

```sql
create or replace function compute_income_split(p_household_id uuid)
returns table(adult_id uuid, ratio numeric(10,8))
language sql stable security invoker
set search_path = public, pg_temp
as $$
  with adults as (
    select id, monthly_income_cents
    from household_member
    where household_id = p_household_id and role = 'adult'
  ),
  total as (select sum(monthly_income_cents) as t from adults)
  select
    a.id,
    case
      when (select t from total) = 0 then 1.0 / nullif((select count(*) from adults), 0)
      else a.monthly_income_cents::numeric / (select t from total)
    end as ratio
  from adults a;
$$;
```

Used by `apply_split_rule(p_transaction_id uuid)` and by the per-person pie when "include general expenses" is toggled on.

---

## State transitions

- `household_invite.accepted_at`: `null → now()` exactly once via `accept_invite()`. Once non-null, the token cannot be reused.
- `subscription.active`: toggled by `pause_subscription` / `resume_subscription` RPCs; `materialize_due_subscriptions` skips `active = false`.
- `transaction` is mutable in place; edits update `updated_at` and trigger a Realtime broadcast. Deletes are hard (no soft-delete in v1).

---

## Validation rules (summary, mirrored in Zod)

| Rule | Source |
|---|---|
| Email is RFC-valid lowercase | FR-001 |
| Amount > 0 and ≤ 9_999_999_99 (≈ $100M, sanity) | FR-008/009 |
| `essential_pct` ∈ [0, 100] | FR-011 |
| `split_rule` ∈ enum | FR-015 |
| Kid `age_years` ∈ [0, 25] | FR-006 |
| Province ∈ supported list (`ON`, `BC`, `AB`, `QC`, ...) | FR-032 |
| Tax profile ∈ enum | FR-032 |
| Subscription `cadence` ∈ enum | FR-027 |

---

## Cross-table invariants (enforced by triggers + DB functions)

1. **`for_member_id` and `paid_by_member_id` must belong to the same household as the transaction.** Deferred constraint trigger.
2. **At most 2 adult members per household.** Trigger on `household_member` insert/update.
3. **A household's `owner_user_id` must also have a `household_member` row with `role = 'adult'`.** Enforced by `create_household()` RPC, which does both inserts in a transaction.
4. **A subscription auto-log is idempotent.** Unique index `(subscription_id, occurrence_date)` on `transaction`.

---

## Realtime channels

- Channel: `household:<household_id>:transactions`
- Events: `INSERT | UPDATE | DELETE` on `transaction`
- Subscribers: every authenticated client whose `auth.uid()` belongs to that household; Supabase's RLS enforcement is applied to realtime payloads.

This is the only realtime channel for v1. Budget, reports, and subscriptions all derive from `transaction` data, so a single subscription is enough to keep dashboards live (SC-003).
