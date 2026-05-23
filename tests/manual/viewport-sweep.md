# Viewport sweep — manual checklist (T112)

Verify every authenticated screen renders without horizontal scroll at a
**340 px-wide** viewport (Chrome DevTools → device toolbar → custom 340×740),
across household sizes 0, 2, 6, 8 kids. Also captures the SC-006 perf check.

## Setup

1. `npm run dev` and sign in as Alex.
2. Add 2 adults + N kids via the Family screen.
3. Log ~10 mixed expenses + 2 incomes so all screens have data.

## Screens to verify (no horizontal scroll, no truncation)

| Screen | 0 kids | 2 kids | 6 kids | 8 kids |
|---|---|---|---|---|
| Dashboard | [ ] | [ ] | [ ] | [ ] |
| Quick Add (Recent tab) | [ ] | [ ] | [ ] | [ ] |
| Quick Add (Subs tab) | [ ] | [ ] | [ ] | [ ] |
| Add Expense | [ ] | [ ] | [ ] | [ ] |
| Add Income | [ ] | [ ] | [ ] | [ ] |
| Transactions | [ ] | [ ] | [ ] | [ ] |
| Budget | [ ] | [ ] | [ ] | [ ] |
| Family | [ ] | [ ] | [ ] | [ ] |
| Reports · Spend | [ ] | [ ] | [ ] | [ ] |
| Reports · Cashflow | [ ] | [ ] | [ ] | [ ] |
| Reports · Per-person | [ ] | [ ] | [ ] | [ ] |
| Reports · Essentials | [ ] | [ ] | [ ] | [ ] |
| Subscriptions | [ ] | [ ] | [ ] | [ ] |
| Settings | [ ] | [ ] | [ ] | [ ] |

## SC-006: Per-person pie recompose ≤500 ms

On `/reports/per-person`, toggle the "Include general" chip three times.
Capture the console-logged timing (`per-person recompose: <n>ms`).

| Run | Timing |
|---|---|
| 1 | __ ms |
| 2 | __ ms |
| 3 | __ ms |

Pass if all three < 500 ms on a mid-range device.
