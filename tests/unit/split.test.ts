import { describe, it, expect } from "vitest";
import { computeIncomeSplit, applySplitRule, type Adult } from "@/lib/split";

const alex: Adult = { id: "alex", incomeCents: 580_000n, displayOrder: 1 };
const bea:  Adult = { id: "bea",  incomeCents: 248_500n, displayOrder: 2 };

describe("lib/split", () => {
  describe("computeIncomeSplit", () => {
    it("returns income-proportional ratios when both have income", () => {
      const ratios = computeIncomeSplit([alex, bea]);
      expect(ratios.length).toBe(2);
      expect(ratios[0].numerator).toBe(580_000n);
      expect(ratios[0].denominator).toBe(828_500n);
    });
    it("falls back to 1/n when total income is zero", () => {
      const zero: Adult[] = [
        { id: "a", incomeCents: 0n, displayOrder: 1 },
        { id: "b", incomeCents: 0n, displayOrder: 2 },
      ];
      const ratios = computeIncomeSplit(zero);
      expect(ratios.every((r) => r.numerator === 1n && r.denominator === 2n)).toBe(true);
    });
    it("returns empty array for empty input", () => {
      expect(computeIncomeSplit([])).toEqual([]);
    });
  });

  describe("applySplitRule — exact-sum invariant", () => {
    it("by_income: shares sum exactly to amount (residual to higher earner)", () => {
      const shares = applySplitRule(4520n, "by_income", [alex, bea]);
      const sum = shares.reduce((acc, s) => acc + s.owedCents, 0n);
      expect(sum).toBe(4520n);
      const alexShare = shares.find((s) => s.adultId === "alex")!.owedCents;
      const beaShare = shares.find((s) => s.adultId === "bea")!.owedCents;
      // Alex earns more, so Alex absorbs the residual cent.
      expect(alexShare > beaShare).toBe(true);
    });

    it("by_income on an odd amount: residual lands on higher-earning adult", () => {
      // 999 cents with 70/30 → 699.3 / 299.7 → floor: 699 / 299 = 998. Residual 1 → Alex.
      const shares = applySplitRule(999n, "by_income", [alex, bea]);
      const sum = shares.reduce((acc, s) => acc + s.owedCents, 0n);
      expect(sum).toBe(999n);
      const alexShare = shares.find((s) => s.adultId === "alex")!.owedCents;
      expect(alexShare).toBe(700n);
    });

    it("by_income zero-income fallback: equal split, residual to display-order Adult A", () => {
      const zero: Adult[] = [
        { id: "a", incomeCents: 0n, displayOrder: 1 },
        { id: "b", incomeCents: 0n, displayOrder: 2 },
      ];
      const shares = applySplitRule(3n, "by_income", zero);
      expect(shares.find((s) => s.adultId === "a")!.owedCents).toBe(2n);
      expect(shares.find((s) => s.adultId === "b")!.owedCents).toBe(1n);
    });

    it("50_50 with odd amount sends residual cent to Adult A", () => {
      const shares = applySplitRule(101n, "50_50", [alex, bea]);
      const sum = shares.reduce((acc, s) => acc + s.owedCents, 0n);
      expect(sum).toBe(101n);
      expect(shares.find((s) => s.adultId === "alex")!.owedCents).toBe(51n);
    });

    it("adult_a / adult_b: full amount goes to the chosen adult", () => {
      expect(applySplitRule(500n, "adult_a", [alex, bea])).toEqual([
        { adultId: "alex", owedCents: 500n },
      ]);
      expect(applySplitRule(500n, "adult_b", [alex, bea])).toEqual([
        { adultId: "bea", owedCents: 500n },
      ]);
    });

    it("adult_b throws when there is only one active adult", () => {
      expect(() => applySplitRule(100n, "adult_b", [alex])).toThrow();
    });

    it("single-adult degeneracy: by_income returns 100% to the single adult", () => {
      const shares = applySplitRule(500n, "by_income", [alex]);
      expect(shares).toEqual([{ adultId: "alex", owedCents: 500n }]);
    });

    it("throws on non-positive amount", () => {
      expect(() => applySplitRule(0n, "by_income", [alex, bea])).toThrow();
    });
  });
});
