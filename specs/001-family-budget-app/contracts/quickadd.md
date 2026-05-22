# Quick Add contracts

The FAB on the dashboard opens **Quick Add** (FR-011a). The page reads tiles via one RPC and re-logs by dispatching the existing `log_expense` RPC with copied fields and today's date — no separate write path.

## `list_quick_add_options(p_limit int default 12)` → `setof quick_add_option`

Returns a mixed list of the household's most recent unique-merchant expenses and active subscriptions due in the next 30 days, suitable for direct rendering as tiles.

- Args: `{ p_limit?: 12 }`
- Returns rows of:
  ```ts
  type QuickAddOption = {
    source: 'recent' | 'subscription';
    source_id: string;            // transaction.id for 'recent'; subscription.id for 'subscription'
    merchant: string;             // notes (for 'recent') or subscription.merchant
    amount_cents: bigint;
    category_id: string;
    category_name: string;
    for_member_id: string | null; // filtered out at the SQL level when the referenced member is soft-deleted
    paid_by_member_id: string | null;
    essential_pct: number;        // 0..100
    split_rule: 'adult_a' | 'adult_b' | '50_50' | 'by_income' | null;
    last_occurred: string;        // ISO date — last log date for 'recent', next renewal for 'subscription'
  };
  ```
- Selection rule:
  - **Recent**: most recent `transaction` row per unique `notes` value (the merchant), limited to `type='expense'`, last 60 days, ordered by `occurred_on desc`. Caps at `floor(p_limit * 0.7)` rows.
  - **Subscriptions**: every `subscription` with `active = true AND next_renewal_at <= current_date + interval '30 days'`. Caps at the remaining slots.
- Filters out any option whose `for_member_id` references a soft-deleted member (clarification §1 — soft-deleted members must not appear in new-entry UI).
- RLS: standard household-isolation via `security invoker`.

## Tile-tap write path (no new RPC)

When the user taps a tile, the client constructs a `log_expense` payload by copying every field from the source option, setting `occurred_on = current_date` and minting a fresh client-side UUID v7 as `id`. For `source = 'subscription'`, the client additionally sets `subscription_id = source_id` and leaves `occurrence_date = null` (so the cron-driven idempotency index on `(subscription_id, occurrence_date)` does not collide when the next scheduled auto-log fires).

- No special server-side handling is required: `log_expense` enforces all the usual RLS and validation rules.
- The tile-tap path participates in the offline outbox like any other expense write — if the device is offline, the entry queues and replays on reconnect with the same client-generated UUID.

## What this contract does NOT need

- No `log_quick_add` RPC. Reusing `log_expense` keeps the write surface single-sourced.
- No per-tile delete / hide RPC for v1. A merchant tile naturally rotates out as newer transactions push it past the 60-day window.
- No "favorites" / pinning. If usage shows this is needed post-v1, it would be a new column on `transaction` and a sort-key tweak in `list_quick_add_options`.
