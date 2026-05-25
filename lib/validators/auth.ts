import { z } from "zod";

// Sign-in is not a password-creation site. Supabase is the source of truth
// for what passwords are valid (config.toml [auth].password_requirements);
// the form only enforces basic length sanity. See research.md R11.
const MIN_LEN = 8;
const MAX_LEN = 64;

export const passwordSchema = z
  .string()
  .min(MIN_LEN, `At least ${MIN_LEN} characters`)
  .max(MAX_LEN, `At most ${MAX_LEN} characters`);

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
