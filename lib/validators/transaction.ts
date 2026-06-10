import { z } from "zod";
import {
  uuidSchema,
  moneyCentsSchema,
  percent0to100Schema,
  splitRuleSchema,
  incomeSourceSchema,
} from "./index";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const logExpenseSchema = z.object({
  id: uuidSchema.optional(),
  amount_cents: moneyCentsSchema,
  occurred_on: isoDate.optional(),
  category_id: uuidSchema,
  notes: z.string().max(200).optional().default(""),
  paid_by_member_id: uuidSchema.nullable().optional(),
  for_member_ids: z.array(uuidSchema).optional().default([]),
  essential_pct: percent0to100Schema.optional(),
  split_rule: splitRuleSchema.nullable().optional(),
  subscription_id: uuidSchema.nullable().optional(),
  occurrence_date: isoDate.nullable().optional(),
});
export type LogExpenseInput = z.infer<typeof logExpenseSchema>;

export const logIncomeSchema = z.object({
  id: uuidSchema.optional(),
  amount_cents: moneyCentsSchema,
  occurred_on: isoDate.optional(),
  category_id: uuidSchema,
  notes: z.string().max(200).optional().default(""),
  paid_by_member_id: uuidSchema,
  income_source: incomeSourceSchema,
});
export type LogIncomeInput = z.infer<typeof logIncomeSchema>;

export const updateTransactionSchema = z.object({
  id: uuidSchema,
  patch: z.object({
    amount_cents: moneyCentsSchema.optional(),
    occurred_on: isoDate.optional(),
    category_id: uuidSchema.optional(),
    notes: z.string().max(200).optional(),
    paid_by_member_id: uuidSchema.nullable().optional(),
    for_member_ids: z.array(uuidSchema).optional(),
    essential_pct: percent0to100Schema.optional(),
    split_rule: splitRuleSchema.nullable().optional(),
  }),
});
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const deleteTransactionSchema = z.object({
  id: uuidSchema,
});

export const recurringSchema = z.object({
  cadence: z.enum([
    "weekly",
    "biweekly",
    "monthly",
    "quarterly",
    "yearly",
    "custom_days",
  ]),
  interval_days: z.coerce.number().int().positive().nullable().optional(),
  start_date: isoDate,
});
export type RecurringInput = z.infer<typeof recurringSchema>;
