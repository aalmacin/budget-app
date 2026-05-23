"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logIncomeSchema } from "@/lib/validators/transaction";

export type LogIncomeState = { error: string | null };

export async function logIncomeAction(
  _prev: LogIncomeState,
  formData: FormData,
): Promise<LogIncomeState> {
  const raw = Object.fromEntries(formData);
  const parsed = logIncomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_income", {
    p: {
      ...parsed.data,
      amount_cents: parsed.data.amount_cents.toString(),
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
