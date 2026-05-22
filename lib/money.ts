/**
 * Money primitives. All amounts in the app travel as `bigint` cents to avoid
 * floating-point drift across split / ratio operations. Conversion to/from
 * dollars and display formatting live here so the rest of the codebase
 * touches only one set of helpers.
 *
 * v1 is CAD-only (FR-037). When multi-currency lands, swap the locale +
 * currency code via parameters.
 */

const CAD_FORMATTER = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Convert whole-cent integer to a dollars number. Loses precision past
 * Number.MAX_SAFE_INTEGER (~$90 trillion CAD), which is fine for v1. */
export function centsToDollars(cents: bigint): number {
  return Number(cents) / 100;
}

/** Convert a dollar amount entered by a human (string or number) to cents.
 * Throws on NaN; rounds half-to-even at the cent boundary. */
export function dollarsToCents(dollars: number | string): bigint {
  const n = typeof dollars === "string" ? Number(dollars) : dollars;
  if (!Number.isFinite(n)) {
    throw new Error(`dollarsToCents: invalid input ${String(dollars)}`);
  }
  // Multiply, round to nearest cent, then convert. Math.round handles the
  // ±0.5 cases consistently across platforms (banker's rounding via toFixed
  // is also acceptable but slower).
  return BigInt(Math.round(n * 100));
}

/** Format a cents amount as "CA$1,234.56" using Intl.NumberFormat. Always
 * renders exactly two decimal places per FR-037 + edge case. */
export function formatCAD(cents: bigint): string {
  return CAD_FORMATTER.format(centsToDollars(cents));
}

/** Helper: floor `amount * ratio` to whole cents using bigint math.
 * `ratio` is a rational number expressed as numerator/denominator so we never
 * touch floating-point in the split path. Used by `lib/split.ts`. */
export function floorShareCents(
  amountCents: bigint,
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= 0n) {
    throw new Error("floorShareCents: denominator must be positive");
  }
  return (amountCents * numerator) / denominator;
}
