import { z } from "zod";

/**
 * Sign-in / password schemas.
 *
 * Password policy mirrors FR-001a (spec clarification §4): ≥8 chars, ≥1
 * digit, ≥1 symbol (any non-alphanumeric printable), paste allowed, max
 * length 64. The same policy is enforced at the Supabase Auth project level
 * (T042a) so admin-set and admin-reset passwords also conform.
 */
const MIN_LEN = 8;
const MAX_LEN = 64;
const HAS_DIGIT = /\d/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export const passwordSchema = z
  .string()
  .min(MIN_LEN, `At least ${MIN_LEN} characters`)
  .max(MAX_LEN, `At most ${MAX_LEN} characters`)
  .refine((v) => HAS_DIGIT.test(v), "Include at least one number")
  .refine((v) => HAS_SYMBOL.test(v), "Include at least one symbol");

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email("Enter a valid email");

export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
