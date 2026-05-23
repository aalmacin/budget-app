# Subscription contracts

## `register_subscription(payload)` → `uuid`

- Args: `{ merchant, amount_cents, category_id, cadence, next_renewal_at, paid_by_member_id?, for_member_id?, essential_pct?, split_rule? }`
- If `essential_pct` omitted, takes the category default.
- Returns the new id.
- Errors:
  - `P0001` "Cadence not supported" if not in enum.
  - `P0001` "Amount must be positive".

## `update_subscription(id uuid, patch)` → `void`

- Args: `{ id, patch: { merchant?, amount_cents?, category_id?, cadence?, next_renewal_at?, paid_by_member_id?, for_member_id?, essential_pct?, split_rule? } }`
- Same validation as `register_subscription`.

## `pause_subscription(id uuid)` → `void`

- Sets `active = false`. `materialize_due_subscriptions` will skip the row.

## `resume_subscription(id uuid)` → `void`

- Sets `active = true`. If `next_renewal_at` is in the past, the next cron tick will catch up.

## `materialize_due_subscriptions()` → `int`

**`security definer`** — runs from `pg_cron` (no user session).

- No args.
- Iterates active subscriptions with `next_renewal_at <= current_date`.
- For each:
  1. INSERT a `transaction` row tagged with `subscription_id` and `occurrence_date = next_renewal_at`. Unique index `(subscription_id, occurrence_date)` makes this idempotent across retries / overlapping cron runs.
  2. Advance `next_renewal_at` by the cadence.
- Returns the number of transactions created on this run (for monitoring).
- Scheduled hourly: `select cron.schedule('subscriptions-hourly', '0 * * * *', 'select materialize_due_subscriptions();');`

## `list_overlapping_subscriptions()` → `setof overlap_callout`

Powers the FR-029 callout on the subscriptions / essentials-breakdown report.

- Returns clusters of "likely-overlapping" subscriptions. v1 heuristic:
  - Same category (e.g., "Subscriptions" or "Entertainment")
  - Two or more `active = true` rows
  - Aggregated monthly-equivalent amount on top so the UI can say "4 overlapping streaming subs · review to save $52/mo"
- Each row: `{ category_name, count, monthly_total_cents, subscription_ids[] }`.
