import { describe, it, expect } from "vitest";
import { centsToDollars, dollarsToCents, formatCAD, floorShareCents } from "@/lib/money";

describe("lib/money", () => {
  describe("centsToDollars", () => {
    it("converts whole-cent integer to dollars number", () => {
      expect(centsToDollars(4520n)).toBe(45.2);
      expect(centsToDollars(0n)).toBe(0);
      expect(centsToDollars(100n)).toBe(1);
    });
  });

  describe("dollarsToCents", () => {
    it("converts dollar number or string to cents bigint", () => {
      expect(dollarsToCents(45.2)).toBe(4520n);
      expect(dollarsToCents("19.99")).toBe(1999n);
      expect(dollarsToCents(0)).toBe(0n);
    });
    it("rounds half-to-even at the cent boundary", () => {
      expect(dollarsToCents(0.005)).toBe(1n);
      expect(dollarsToCents(0.004)).toBe(0n);
    });
    it("throws on NaN input", () => {
      expect(() => dollarsToCents("not a number")).toThrow();
    });
  });

  describe("formatCAD", () => {
    it("renders exactly two decimal places (CAD)", () => {
      // Intl emits either "$45.20" or "CA$45.20" depending on the runtime —
      // both are correct CAD formats. We assert the dollar amount + decimals.
      expect(formatCAD(4520n)).toMatch(/\$45\.20$/);
      expect(formatCAD(0n)).toMatch(/\$0\.00$/);
      expect(formatCAD(7n)).toMatch(/\$0\.07$/); // sub-dollar edge case
    });
  });

  describe("floorShareCents", () => {
    it("computes (amount * num / den) flooring to whole cents", () => {
      expect(floorShareCents(10000n, 1n, 3n)).toBe(3333n);
      expect(floorShareCents(10000n, 2n, 3n)).toBe(6666n);
      expect(floorShareCents(45n, 1n, 1n)).toBe(45n);
    });
    it("throws on non-positive denominator", () => {
      expect(() => floorShareCents(100n, 1n, 0n)).toThrow();
    });
  });
});
