"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logExpenseSchema } from "@/lib/validators/transaction";

export type LogExpenseState = { error: string | null };

export async function logExpenseAction(
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const parsed = logExpenseSchema.safeParse({
    ...raw,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_id: raw.for_member_id || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_expense", {
    p: {
      ...parsed.data,
      amount_cents: parsed.data.amount_cents.toString(),
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  redirect("/dashboard");
}
