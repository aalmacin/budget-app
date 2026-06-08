"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  logIncomeSchema,
  recurringSchema,
} from "@/lib/validators/transaction";

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
  const isRecurring = raw.recurring === "on";

  if (isRecurring) {
    const recurringParsed = recurringSchema.safeParse({
      cadence: raw.cadence,
      interval_days: raw.interval_days || undefined,
      start_date: raw.start_date,
    });
    if (!recurringParsed.success) {
      return { error: recurringParsed.error.issues[0]?.message ?? "Invalid recurring fields" };
    }
    const r = recurringParsed.data;
    if (r.cadence === "custom_days") {
      if (!r.interval_days || r.interval_days < 1) {
        return { error: "interval_days is required for custom cadence" };
      }
    } else if (r.interval_days != null) {
      return { error: "interval_days only allowed when cadence=custom_days" };
    }

    const { error } = await supabase.rpc("log_income_with_subscription", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
        cadence: r.cadence,
        interval_days: r.cadence === "custom_days" ? r.interval_days : null,
        start_date: r.start_date,
      },
    });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.rpc("log_income", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
      },
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/recurring-transactions");
  redirect("/dashboard");
}
