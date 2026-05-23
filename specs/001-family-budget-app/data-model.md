# Phase 1 Data Model — Family Budget App

All tables live in schema `public`, RLS is enabled on every table, and every row carries a `household_id` (directly or via FK chain) used by RLS policies. Money is stored as **`bigint` cents (CAD subunits)**. Timestamps are `timestamptz` in UTC; CRA deadlines are computed in `America/Toronto` via `date-fns-tz` at the application edge.

Conventions:
- Primary keys are `uuid` defaulting to `gen_random_uuid()` unless noted.
- Foreign keys cascade on delete only when the child is genuinely owned by the parent (`transaction → household` cascades; `transaction → category` restricts).
- `created_at timestamptz not null default now()` and `updated_at timestamptz not null default now()` are added to every table; an `update_timestamp()` trigger maintains `updated_at`.
- Every table gets an RLS policy named `<table>_household_isolation` of the form `using (household_id in (select household_id from household_member where user_id = auth.uid() and deleted_at is null))`. Variants are noted below where they differ.

The schema reflects all clarifications in `spec.md`: admin-only account creation (no `household_invite` table), member soft-delete (`deleted_at` on `household_member`), 2-adult cap counted across active members only, exact-sum split-residual handled in `apply_split_rule`, **US8 removal** (no `deduction` or `gst_hst_setaside` tables, no province/tax_profile columns on `household`), and **net-income semantics** on `transaction.amount_cents` for `type='income'`.

---

## 1. `household`

A shared financial unit.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` not null | "The Almacin household" etc. |
| `currency` | `text` not null default `'CAD'` | v1 hard-codes CAD; column kept for forward compat |
| `owner_user_id` | `uuid` not null | `auth.users.id` — set at creation by `create_household()` |

**RLS**: row is visible iff `id in (select household_id from household_member where user_id = auth.uid() and deleted_at is null)`.

> `province`, `tax_profile`, and `gst_hst_registrant` columns were dropped when US8 was removed from v1. Re-introduce only if Canadian tax tracking comes back in a future spec.

---

## 2. `household_member`

Joins `auth.users` to a household. Active members are those with `deleted_at IS NULL`. At most 2 **active** rows with `role = 'adult'` per household (CHECK enforced by trigger; see "Constraints" section at end).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `user_id` | `uuid` nullable FK→`auth.users.id` | Null for kids; set for adults. Each `user_id` may appear at most once per household. |
| `role` | `text` not null | `'adult'` or `'kid'` |
| `display_name` | `text` not null | |
| `age_years` | `smallint` nullable | Required when `role = 'kid'`; null for adults |
| `avatar_url` | `text` nullable | |
| `monthly_income_cents` | `bigint` not null default 0 | Used by `compute_income_split`. Stays 0 for kids. |
| `deleted_at` | `timestamptz` nullable | Soft-delete sentinel (clarification §1). NULL = active. |

**RLS**: standard household-isolation. Plus a stricter policy on `UPDATE` of `monthly_income_cents`: only active adults of the same household may update an adult member's income. Soft-deleted rows remain readable so historical reports can resolve display names.

**Constraints**:
- `role in ('adult','kid')`
- `age_years not null` when `role = 'kid'`; `age_years between 0 and 25`
- `monthly_income_cents >= 0`
- Unique partial index: `(household_id, user_id) where user_id is not null` — one user can't have two member rows in the same household, soft-deleted or not.
- Trigger `enforce_adult_cap`: rejects INSERT/UPDATE that would result in more than 2 rows with `role='adult' AND deleted_at IS NULL` per `household_id`.
- Trigger `forbid_undelete_of_adult_when_capped`: prevents flipping `deleted_at` from non-null to null on an adult if it would breach the cap.

**Selector behavior**: every UI selector ("paid by", "for whom", Family screen list, filter chips) adds `AND deleted_at IS NULL`. Historical reports (`per_person_breakdown`, `transaction_view`) join without that filter so prior spend stays attributable.

---

## 3. `category`

System-seeded categories live with `household_id = null` and are read-only to everyone. Per-household overrides clone them when a user changes `default_essential_pct` or `monthly_budget_cents` (clone-on-write).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `household_id` | `uuid` nullable FK→`household.id` ON DELETE CASCADE | Null = system-seeded global |
| `name` | `text` not null | "Groceries", "Utilities", "Kids · RESP", etc. |
| `default_essential_pct` | `smallint` not null default 100 | 0..100. Auto-applied to new expenses when not overridden. |
| `monthly_budget_cents` | `bigint` nullable | When set, drives the budget overview |
| `kind` | `text` not null default `'expense'` | `'expense'` or `'income'` |

**Seed data** (system-global, `household_id = null`): Groceries(80), Utilities(100), Transport(70), Kids(90), Health(100), Subscriptions(40), Eating Out(20), Entertainment(0), Rogers(100), Bell(100), RESP(100), TFSA(100). Income source labels live on the `transaction.income_source` column rather than as `category` rows: `Salary | Contract | Self_employed | Benefit | Refund | Gift`.

**RLS**: visible if `household_id is null` OR row's household is one the caller belongs to (active membership).

---

## 4. `transaction`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Client-generated (UUID v7) to make offline replays idempotent |
| `household_id` | `uuid` not null FK→`household.id` ON DELETE CASCADE | |
| `type` | `text` not null | `'expense'` or `'income'` |
| `amount_cents` | `bigint` not null | Always > 0; `type` carries the sign |
| `occurred_on` | `date` not null | The transaction's user-facing date |
| `category_id` | `uuid` not null FK→`category.id` ON DELETE RESTRICT | |
| `notes` | `text` not null default `''` | Free-form merchant/note text, indexed for search |
| `paid_by_member_id` | `uuid` nullable FK→`household_member.id` | Adult who paid (expense) or earner (income). May reference soft-deleted member for historical rows. |
| `for_member_id` | `uuid` nullable FK→`household_member.id` | Null = whole household; else the specific Member. May reference soft-deleted member. |
| `essential_pct` | `smallint` not null | 0..100 — portion that counts as essential |
| `split_rule` | `text` nullable | `'adult_a' \| 'adult_b' \| '50_50' \| 'by_income' \| null` (null = unsplit / single-adult household) |
| `income_source` | `text` nullable | For `type='income'`: `Salary \| Contract \| Self_employed \| Benefit \| Refund \| Gift` — **descriptive metadata only.** v1 does NOT drive any tax / GST set-aside / auto-aside logic from this column. `amount_cents` for income is the **net** (post-tax) amount the user received. Friendlier labels replace the prior CRA-flavored `T4 / T4A / CCB` per spec clarification §9 (design v2 alignment). |
| `subscription_id` | `uuid` nullable FK→`subscription.id` ON DELETE SET NULL | Set by auto-log OR by Quick Add when the user manually re-runs a subscription tile (in which case `occurrence_date` stays null) |
| `occurrence_date` | `date` nullable | Set only by the cron-driven `materialize_due_subscriptions`; participates in the unique idempotency index below. Quick-Add manual re-runs leave this null to avoid colliding with a future auto-log on the same date. |

**Indexes**:
- `(household_id, occurred_on desc)` — transactions list pagination
- `(household_id, category_id, occurred_on)` — budget progress
- `unique (subscription_id, occurrence_date) where subscription_id is not null` — idempotent auto-log
- `gin (to_tsvector('simple', notes))` — search by merchant/notes (FR-022)

**RLS**: standard household-isolation. INSERT/UPDATE/DELETE only via RPC; direct DML is blocked by policy. The `for_member_id` / `paid_by_member_id` FK targets are NOT filtered by `deleted_at` — historical transactions must keep their member attribution intact (clarification §1).

**Constraints**:
- `essential_pct between 0 and 100`
- `amount_cents > 0`
- `type in ('expense','income')`
- `split_rule in ('adult_a','adult_b','50_50','by_income')` when set
- `for_member_id` / `paid_by_member_id` belong to same household (deferred trigger)

---

## 5. `subscription`

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
| `paid_by_member_id` | `uuid` nullable FK→`household_member.id` | If member is soft-deleted, `materialize_due_subscriptions` leaves it as-is (auto-logs still tag the historical adult). Pausing the sub is the user's remedy. |
| `for_member_id` | `uuid` nullable FK→`household_member.id` | Same rule as above |
| `essential_pct` | `smallint` not null | 0..100 |
| `split_rule` | `text` nullable | Same domain as `transaction.split_rule` |
| `active` | `boolean` not null default true | Paused subs do not auto-log |

**RLS**: standard.

---

## 6. ~~`deduction`~~ and ~~`gst_hst_setaside`~~ (REMOVED)

Removed when US8 was dropped from v1 (spec clarification §6). No `deduction` table, no GST/HST set-aside ledger, no `log_deduction` / `gst_hst_running_total` RPCs. Income `amount_cents` is net by definition; no transaction-side trigger auto-creates set-aside rows.

If Canadian tax tracking comes back in a future spec, both tables would be re-introduced here with the same shapes they had in the v0 draft.

---

## 7. Derived / virtual: income-proportional split

Not a table — a function. Re-derives ratios on every read. Only active adults participate.

```sql
create or replace function compute_income_split(p_household_id uuid)
returns table(adult_id uuid, ratio numeric(10,8), display_order int)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  with adults as (
    select id, monthly_income_cents,
           row_number() over (order by created_at, id) as display_order
    from household_member
    where household_id = p_household_id
      and role = 'adult'
      and deleted_at is null
  ),
  total as (select sum(monthly_income_cents) as t from adults)
  select
    a.id,
    case
      when (select t from total) = 0 then 1.0 / nullif((select count(*) from adults), 0)
      else a.monthly_income_cents::numeric / (select t from total)
    end as ratio,
    a.display_order
  from adults a;
$$;
```

Used by `apply_split_rule(p_transaction_id uuid)` and by the per-person pie when "include general expenses" is toggled on.

---

## 8. Exact-sum residual rule for split calculations

`apply_split_rule(p_transaction_id uuid)` returns each adult's owed share as a record set, with the invariant that the shares sum **exactly** to the transaction's `amount_cents`. Per clarification §3:

1. For each adult, compute `floor(amount_cents * ratio)` to whole cents.
2. Compute `residual = amount_cents - sum(floored_shares)`.
3. Distribute the residual to the **higher-earning adult**. If incomes are equal (or both zero, which uses the fallback `1/n` ratio), the residual goes to **Adult A in display order** (lowest `created_at`, then PK id as tie-break — this is the `display_order = 1` row from `compute_income_split`).

Sketch:

```sql
create or replace function apply_split_rule(p_transaction_id uuid)
returns table(adult_id uuid, owed_cents bigint)
language plpgsql stable security invoker
set search_path = public, pg_temp
as $$
declare
  v_amount bigint;
  v_household uuid;
  v_rule text;
begin
  select amount_cents, household_id, split_rule
    into v_amount, v_household, v_rule
    from transaction where id = p_transaction_id;

  if v_rule is null then
    return query select paid_by_member_id, v_amount from transaction where id = p_transaction_id;
    return;
  end if;

  -- Compute integer-floor shares + residual, assigning residual to the
  -- highest-income adult (ties broken by display_order ascending).
  return query
    with split as (
      select adult_id, ratio, display_order,
             (select monthly_income_cents from household_member m where m.id = adult_id) as income
      from compute_income_split(v_household)
    ),
    floored as (
      select adult_id, ratio, display_order, income,
             floor(v_amount * ratio)::bigint as base
      from split
    ),
    totals as (
      select sum(base) as base_sum from floored
    ),
    ranked as (
      select adult_id, base, income, display_order,
             row_number() over (order by income desc, display_order asc) as winner_rank
      from floored
    )
    select adult_id,
           case when winner_rank = 1 then base + (v_amount - (select base_sum from totals))
                else base end as owed_cents
    from ranked
    order by display_order;
end;
$$;
```

The same algorithm is mirrored in pure TypeScript in `lib/split.ts` for live UI preview while the user is dragging the "Paid by · split" card. Both are covered by `tests/unit/split.test.ts` and a Playwright spec that asserts `sum(owed_cents) == amount_cents` on a deliberately-odd amount like 999¢.

---

## State transitions

- `household_member.deleted_at`: `null → now()` via `soft_delete_member(member_id)`. Reversal allowed only when it would not breach the 2-adult cap (enforced by trigger). Hard delete is disallowed at the policy level — only the cascade from `household` deletion can remove rows.
- `subscription.active`: toggled by `pause_subscription` / `resume_subscription`; `materialize_due_subscriptions` skips `active = false`.
- `transaction` is mutable in place; edits update `updated_at` and trigger a Realtime broadcast. Deletes are hard (no soft-delete in v1).

---

## Validation rules (summary, mirrored in Zod)

| Rule | Source |
|---|---|
| Email is RFC-valid lowercase (citext) | FR-001 |
| Password ≥ 8 chars + ≥ 1 digit + ≥ 1 symbol; max ≥ 64 | FR-001a, clarification §4 |
| Amount > 0 and ≤ 9_999_999_99 (≈ $100M, sanity) | FR-008/009 |
| `essential_pct` ∈ [0, 100] | FR-011 |
| `split_rule` ∈ enum | FR-015 |
| Kid `age_years` ∈ [0, 25] | FR-006 |
| Subscription `cadence` ∈ enum | FR-027 |

---

## Cross-table invariants (enforced by triggers + DB functions)

1. **`for_member_id` and `paid_by_member_id` must belong to the same household as the transaction.** Deferred constraint trigger. Soft-delete state is NOT checked here — historical attribution must survive.
2. **At most 2 active adult members per household.** Trigger on `household_member` insert/update/`deleted_at`-toggle.
3. **A household's `owner_user_id` must also have a `household_member` row with `role = 'adult'`.** Enforced by `create_household()` RPC, which does both inserts in a transaction.
4. **A subscription auto-log is idempotent.** Unique index `(subscription_id, occurrence_date) where subscription_id is not null` on `transaction`.
5. **`split_rule = 'by_income'` shares must sum exactly to `amount_cents`.** Guaranteed by `apply_split_rule`'s residual-assignment step; covered by tests.
6. **`add_adult_by_email` is idempotent.** RPC returns success without insert if the email is already an active member of the caller's household (clarification §5 + FR-004b).

---

## Realtime channels

- Channel: `household:<household_id>:transactions`
- Events: `INSERT | UPDATE | DELETE` on `transaction`
- Subscribers: every authenticated client whose `auth.uid()` belongs to that household (active membership); Supabase's RLS enforcement is applied to realtime payloads.

This is the only realtime channel for v1. Budget, reports, and subscriptions all derive from `transaction` data, so a single subscription is enough to keep dashboards live (SC-003).
