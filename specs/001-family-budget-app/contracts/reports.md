# Reports contracts

All four reports are read-only RPCs. Each returns a shape designed to drop directly into Recharts.

## `spend_over_time(range text)` → `setof spend_over_time_row`

- Args: `{ range: '7d'|'30d'|'90d'|'365d'|'mtd'|'ytd' }`
- Returns `{ bucket_start date, spent_cents bigint, income_cents bigint }` rows ordered chronologically.
- Bucketing rule: `7d`/`30d` bucket by day; `90d`/`mtd` bucket by week; `365d`/`ytd` bucket by month.
- Drives FR-023.

## `cashflow_kpis(range text)` → record

- Args: same as above.
- Returns:
  ```ts
  {
    income_cents: bigint;
    expense_cents: bigint;
    net_cents: bigint;
    avg_daily_spend_cents: bigint;
    largest_expense: { id: uuid; merchant: string; amount_cents: bigint; occurred_on: date };
    top_category: { category_id: uuid; name: string; spent_cents: bigint };
    insights: string[];  // pre-formatted "You spent 22% more on Eating Out vs last 30d" — generated server-side
  }
  ```
- Drives FR-024.

## `per_person_breakdown(year smallint, month smallint, include_general boolean)` → `setof per_person_row`

- Args: `{ year, month, include_general }`
- Returns one row per household member (adults + kids):
  ```ts
  { member_id: uuid; display_name: string; role: 'adult'|'kid'; spent_cents: bigint; share_of_general_cents: bigint }
  ```
- When `include_general = false`: `share_of_general_cents = 0` and `spent_cents` counts only transactions where `for_member_id = member.id`.
- When `include_general = true`: `share_of_general_cents` for each adult is computed as `sum(general_expense.amount_cents) * compute_income_split(household_id).ratio`. Kids' share stays 0 (kids do not absorb general expenses). The UI sums `spent_cents + share_of_general_cents` for the pie slice.
- Drives FR-025. The 500ms recompose target (SC-006) is met because the same RPC is hit with the toggle flipped, and the result set is small (≤ ~10 rows).

## `essentials_breakdown(year smallint, month smallint)` → record

- Returns:
  ```ts
  {
    overall: { essential_cents: bigint; treats_cents: bigint };
    recurring: {
      essential: SubscriptionLine[];
      treats: SubscriptionLine[];
      essential_total_cents: bigint;
      treats_total_cents: bigint;
      treats_percent: number;  // 0..100
    };
  }
  ```
  where `SubscriptionLine = { subscription_id, merchant, amount_cents, cadence }`.
- Drives FR-026 and the savings callout in FR-029 (combined with `list_overlapping_subscriptions()`).
