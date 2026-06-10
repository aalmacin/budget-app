import { describe, it, expect } from "vitest";
import {
  formatMonthLabel,
  buildColumnOrder,
} from "@/components/reports/MonthlyComparisonClient";

describe("formatMonthLabel", () => {
  it("labels current month as MTD", () => {
    expect(formatMonthLabel(2026, 6, 2026, 6)).toBe("MTD (Jun 2026)");
  });

  it("labels past months as Mon YYYY", () => {
    expect(formatMonthLabel(2026, 5, 2026, 6)).toBe("May 2026");
    expect(formatMonthLabel(2025, 12, 2026, 6)).toBe("Dec 2025");
    expect(formatMonthLabel(2026, 1, 2026, 6)).toBe("Jan 2026");
  });
});

describe("buildColumnOrder", () => {
  const categories = [
    { id: "cat-1", name: "Groceries" },
    { id: "cat-2", name: "Transport" },
  ];
  const people = [
    { id: "per-1", name: "Alice" },
    { id: "per-2", name: "Bob" },
  ];

  it("returns only fixed columns when nothing extra is selected", () => {
    const cols = buildColumnOrder(new Set(["ess", "non_ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["ess", "non_ess", "total"]);
  });

  it("inserts selected categories before essentials, sorted alphabetically", () => {
    const cols = buildColumnOrder(new Set(["cat-2", "cat-1", "ess", "non_ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["cat-1", "cat-2", "ess", "non_ess", "total"]);
  });

  it("inserts selected people after categories and before essentials", () => {
    const cols = buildColumnOrder(new Set(["per-2", "per-1", "ess"]), categories, people);
    expect(cols.map((c) => c.id)).toEqual(["per-1", "per-2", "ess", "total"]);
  });

  it("total column is always last and always present", () => {
    const cols = buildColumnOrder(new Set(), categories, people);
    expect(cols.at(-1)?.id).toBe("total");
  });
});
