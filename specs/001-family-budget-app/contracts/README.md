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
  - `23505` — unique violation (e.g. duplicate invite)
  - `P0001` — function-raised validation error; `error.message` is user-facing
  - other Postgres error codes for unexpected issues
- Every mutation runs in a single SQL transaction. If anything inside the function `RAISE EXCEPTION`s, the whole call rolls back.

## Authorization

- `security invoker` is the **default**. Functions run as the calling user; RLS applies.
- `security definer` is used **only** for:
  - `accept_invite(token)` — must read an invite row the caller doesn't yet own
  - `create_household()` — must insert the calling user as the first `household_member` row before any RLS policy can grant access
  - `materialize_due_subscriptions()` — runs from `pg_cron` with no user session
  Each `security definer` function pins `search_path = public, pg_temp` and re-validates `auth.uid()` against expected ownership.

## Files

- [auth.md](./auth.md) — signup, signin, signout, current-user
- [household.md](./household.md) — create_household, create_invite, accept_invite, add_member, update_member_income, update_household
- [transactions.md](./transactions.md) — log_expense, log_income, update_transaction, delete_transaction, list_transactions
- [budgets.md](./budgets.md) — set_category_budget, set_category_essential_pct, get_budget_progress
- [subscriptions.md](./subscriptions.md) — register_subscription, pause_subscription, resume_subscription, materialize_due_subscriptions, list_overlapping_subscriptions
- [tax.md](./tax.md) — set_tax_profile, log_deduction, list_deductions, gst_hst_running_total
- [reports.md](./reports.md) — spend_over_time, cashflow_kpis, per_person_breakdown, essentials_breakdown
