"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signInSchema } from "@/lib/validators/auth";

export type SignInState = {
  error: string | null;
};

const GENERIC_ERROR = "Email or password is incorrect.";

/**
 * Sign in with email + password.
 *
 * We deliberately collapse every Supabase Auth failure into one generic
 * message to avoid account enumeration (contracts/auth.md). The only
 * exception is unconfirmed-email, which is actionable and admin-resolvable.
 */
export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: GENERIC_ERROR };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        error: "Confirm your email first — ask the admin to resend confirmation.",
      };
    }
    return { error: GENERIC_ERROR };
  }

  redirect("/");
}
