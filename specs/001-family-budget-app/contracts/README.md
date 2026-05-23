# Contracts — RPC Surface

Per Constitution Principle III, client→backend communication is **Supabase RPC** into PostgreSQL functions. This directory enumerates every function the v1 app calls, its arguments, its return shape, and its error semantics.

## Calling convention

All RPCs follow this shape from the client:

```ts
const { data, error } = await supabase.rpc('<fn_name>', { /* args */ });
```

- Args are passed as a JSON object with prefix-less keys (`{ amount_cents }`, never `{ p_amount_cents }` from the client; we keep `p_` prefixes inside SQL but expose unprefixed names via PostgREST aliases).
- Returns are typed end-to-end via generated `Database` types from Supabase.
- Errors set `error.code` to one of:
  - `42501` — RLS denial (translated to "Not allowed" in the UI)
  - `23505` — unique violation
  - `P0001` — function-raised validation error; `error.message` is user-facing
  - other Postgres error codes for unexpected issues
- Every mutation runs in a single SQL transaction. If anything inside the function `RAISE EXCEPTION`s, the whole call rolls back.

## Authorization

- `security invoker` is the **default**. Functions run as the calling user; RLS applies.
- `security definer` is used **only** for:
  - `create_household()` — must insert the calling user as the first `household_member` row before any RLS policy can grant access.
  - `add_adult_by_email(email)` — must read `auth.users` (privileged) to resolve the email to a user id, then insert under household RLS.
  - `materialize_due_subscriptions()` — runs from `pg_cron` with no user session.

  Each `security definer` function pins `search_path = public, pg_temp` and re-validates `auth.uid()` against expected ownership.

## Files

- [auth.md](./auth.md) — sign-in, sign-out, current-user (no signup in v1)
- [household.md](./household.md) — `create_household`, `add_adult_by_email`, `add_kid`, `soft_delete_member`, `update_member_income`, `update_household`
- [transactions.md](./transactions.md) — `log_expense`, `log_income`, `update_transaction`, `delete_transaction`, `list_transactions`
- [quickadd.md](./quickadd.md) — `list_quick_add_options` (powers the FR-011a Quick Add tile grid)
- [budgets.md](./budgets.md) — `set_category_budget`, `set_category_essential_pct`, `get_budget_progress`, `get_dashboard_summary`
- [subscriptions.md](./subscriptions.md) — `register_subscription`, `pause_subscription`, `resume_subscription`, `materialize_due_subscriptions`, `list_overlapping_subscriptions`
- [reports.md](./reports.md) — `spend_over_time`, `cashflow_kpis`, `per_person_breakdown`, `essentials_breakdown`, `apply_split_rule`

> The previous `tax.md` is gone — US8 (Canadian tax tracking) was removed from v1.
