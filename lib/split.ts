/**
 * Pure mirror of the SQL `apply_split_rule` and `compute_income_split`
 * functions (see specs/001-family-budget-app/data-model.md §8). Used for
 * live UI previews while the user drags the "Paid by · split" card; the SQL
 * is authoritative at write time.
 *
 * Invariants enforced (must match `apply_split_rule` exactly):
 *   1. Per-adult share = floor(amount * income_ratio) in whole cents.
 *   2. Residual cents go to the highest-earning active adult.
 *   3. On ties (equal income or both-zero fallback), the residual goes to
 *      the adult with the lowest display_order (i.e., the earliest
 *      created_at; "Adult A in display order").
 *   4. sum(shares) === amount_cents, always.
 */

import { floorShareCents } from "@/lib/money";

export type SplitRule = "adult_a" | "adult_b" | "50_50" | "by_income";

export type Adult = {
  /** household_member.id */
  id: string;
  /** Monthly net income in whole cents. Zero is allowed. */
  monthlyIncomeCents: bigint;
  /**
   * Display order — 1-indexed, derived from row_number() over
   * (order by created_at, id). Used as the tie-breaker for residual cent
   * assignment.
   */
  displayOrder: number;
};

export type Share = {
  adultId: string;
  owedCents: bigint;
};

/**
 * Compute each adult's income ratio as a numerator/denominator pair (so the
 * caller can reason in integer math). Both-zero income falls back to equal
 * split per the SQL function spec.
 */
export function computeIncomeSplit(
  adults: Adult[],
): { adultId: string; numerator: bigint; denominator: bigint }[] {
  if (adults.length === 0) return [];
  const total = adults.reduce(
    (acc, a) => acc + a.monthlyIncomeCents,
    0n,
  );
  if (total === 0n) {
    const n = BigInt(adults.length);
    return adults.map((a) => ({
      adultId: a.id,
      numerator: 1n,
      denominator: n,
    }));
  }
  return adults.map((a) => ({
    adultId: a.id,
    numerator: a.monthlyIncomeCents,
    denominator: total,
  }));
}

/**
 * Apply a split rule to a transaction amount and return the resolved
 * per-adult owed shares. Must satisfy `sum(owedCents) === amountCents`.
 *
 * @param amountCents total transaction amount in whole cents (must be > 0)
 * @param rule one of the four split rules; `null` returns a single-share for
 *             the "paid by" adult — caller handles that case
 * @param adults all ACTIVE adults in the household (already filtered for
 *               `deleted_at is null` upstream)
 */
export function applySplitRule(
  amountCents: bigint,
  rule: SplitRule,
  adults: Adult[],
): Share[] {
  if (amountCents <= 0n) {
    throw new Error("applySplitRule: amountCents must be positive");
  }
  if (adults.length === 0) {
    throw new Error("applySplitRule: at least one adult required");
  }

  // Sort adults by displayOrder so "Adult A" tie-break is deterministic.
  const ordered = [...adults].sort((a, b) => a.displayOrder - b.displayOrder);

  switch (rule) {
    case "adult_a":
      return [{ adultId: ordered[0].id, owedCents: amountCents }];
    case "adult_b":
      if (ordered.length < 2) {
        throw new Error("applySplitRule: 'adult_b' requires two active adults");
      }
      return [{ adultId: ordered[1].id, owedCents: amountCents }];
    case "50_50":
      return distributeWithResidual(amountCents, ordered, (a) => ({
        // Equal weights → fall back to numerator=1, denominator=n.
        numerator: 1n,
        denominator: BigInt(ordered.length),
        adultId: a.id,
        // For the tie-break ranking: equal income → display_order asc.
        income: 0n,
        displayOrder: a.displayOrder,
      }));
    case "by_income": {
      const ratios = computeIncomeSplit(ordered);
      return distributeWithResidual(amountCents, ordered, (a, i) => ({
        numerator: ratios[i].numerator,
        denominator: ratios[i].denominator,
        adultId: a.id,
        income: a.monthlyIncomeCents,
        displayOrder: a.displayOrder,
      }));
    }
  }
}

type Allocation = {
  adultId: string;
  numerator: bigint;
  denominator: bigint;
  income: bigint;
  displayOrder: number;
};

function distributeWithResidual(
  amountCents: bigint,
  ordered: Adult[],
  derive: (adult: Adult, index: number) => Allocation,
): Share[] {
  const allocs = ordered.map(derive);
  const flooredShares = allocs.map((a) => ({
    adultId: a.adultId,
    base: floorShareCents(amountCents, a.numerator, a.denominator),
    income: a.income,
    displayOrder: a.displayOrder,
  }));
  const baseSum = flooredShares.reduce((acc, s) => acc + s.base, 0n);
  const residual = amountCents - baseSum;

  // Pick the residual recipient: highest income wins; ties broken by lowest
  // displayOrder. Stable in O(n) — we sort a shallow copy to avoid mutating
  // the original ordering used for the output shape.
  const ranking = [...flooredShares].sort((a, b) => {
    if (b.income !== a.income) return b.income > a.income ? 1 : -1;
    return a.displayOrder - b.displayOrder;
  });
  const winnerId = ranking[0].adultId;

  return flooredShares.map((s) => ({
    adultId: s.adultId,
    owedCents: s.adultId === winnerId ? s.base + residual : s.base,
  }));
}
