import { z } from "zod";

/** UUID v4 / v7 / etc. — Postgres accepts any valid UUID. */
export const uuidSchema = z.string().uuid();

/** Bigint cents in JSON form. Accepts string (`"4520"`) and number (`4520`).
 * Coerces to bigint and validates > 0. The cap mirrors data-model.md's
 * "≤ 9_999_999_99 (~$100M)" sanity ceiling. */
export const moneyCentsSchema = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const asNumber = typeof v === "string" ? Number(v) : v;
    if (!Number.isFinite(asNumber) || asNumber <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount must be positive",
      });
      return z.NEVER;
    }
    if (asNumber > 9_999_999_99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Amount is suspiciously large",
      });
      return z.NEVER;
    }
    return BigInt(Math.round(asNumber));
  });

/** 0..100, integer. Used for essential_pct + category default_essential_pct. */
export const percent0to100Schema = z
  .number()
  .int()
  .min(0)
  .max(100);

/** Subscription cadence enum, must mirror the SQL CHECK constraint. */
export const cadenceSchema = z.enum([
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

/** Transaction split rule. Null is allowed at the table level (unsplit /
 * single-adult households) but the chip itself only emits these four values. */
export const splitRuleSchema = z.enum([
  "adult_a",
  "adult_b",
  "50_50",
  "by_income",
]);

/** Income source label (clarification §9). Descriptive metadata only — does
 * NOT drive any tax/withholding logic. */
export const incomeSourceSchema = z.enum([
  "Salary",
  "Contract",
  "Self_employed",
  "Benefit",
  "Refund",
  "Gift",
]);

/** Member role. */
export const memberRoleSchema = z.enum(["adult", "kid"]);

/** Kid age range — same bounds as the SQL CHECK constraint. */
export const kidAgeSchema = z.number().int().min(0).max(25);
