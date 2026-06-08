"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  logExpenseSchema,
  logIncomeSchema,
} from "@/lib/validators/transaction";
import type { LogExpenseState } from "../add/actions";
import type { LogIncomeState } from "../add-income/actions";

export async function pauseRecurringTransactionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("pause_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/recurring-transactions");
  return {};
}

export async function resumeRecurringTransactionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resume_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/recurring-transactions");
  return {};
}

export async function skipRecurringTransactionOccurrenceAction(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_subscription_occurrence", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/recurring-transactions");
  revalidatePath("/dashboard");
  return {};
}

export async function logRecurringTransactionExpenseAction(
  recurringTransactionId: string,
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const supabase = await createSupabaseServerClient();

  const categoryId = (raw.category_id as string | undefined) ?? "";
  if (!categoryId) {
    return { error: "Pick an existing category (recurring transaction prefill required)" };
  }

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_id: raw.for_member_id || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase.rpc("log_subscription_expense", {
    p: {
      subscription_id: recurringTransactionId,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      occurred_on: parsed.data.occurred_on,
      notes: parsed.data.notes,
      paid_by_member_id: parsed.data.paid_by_member_id ?? null,
      for_member_id: parsed.data.for_member_id ?? null,
      essential_pct: parsed.data.essential_pct ?? 100,
      split_rule: parsed.data.split_rule ?? null,
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/recurring-transactions");
  revalidatePath("/transactions");
  redirect("/dashboard");
}

export async function logRecurringTransactionIncomeAction(
  recurringTransactionId: string,
  _prev: LogIncomeState,
  formData: FormData,
): Promise<LogIncomeState> {
  const raw = Object.fromEntries(formData);
  const parsed = logIncomeSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("log_subscription_income", {
    p: {
      subscription_id: recurringTransactionId,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      occurred_on: parsed.data.occurred_on,
      notes: parsed.data.notes,
      paid_by_member_id: parsed.data.paid_by_member_id,
    },
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/recurring-transactions");
  revalidatePath("/transactions");
  redirect("/dashboard");
}
