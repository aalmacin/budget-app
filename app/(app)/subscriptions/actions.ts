"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logExpenseSchema } from "@/lib/validators/transaction";
import type { LogExpenseState } from "../add/actions";

export async function registerSubscriptionAction(p: {
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  cadence: string;
  next_renewal_at: string;
  paid_by_member_id?: string | null;
  for_member_id?: string | null;
  essential_pct?: number;
  interval_days?: number | null;
}): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_subscription", {
    p: {
      ...p,
      amount_cents: p.amount_cents.toString(),
      interval_days: p.interval_days ?? null,
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return {};
}

export async function pauseSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("pause_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}

export async function resumeSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resume_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}

export async function skipSubscriptionOccurrenceAction(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("skip_subscription_occurrence", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return {};
}

export async function logSubscriptionExpenseAction(
  subscriptionId: string,
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const supabase = await createSupabaseServerClient();

  // The subscription prefill always supplies a real category_id, so we don't
  // need the create-on-the-fly path that /add has. If the user happened to
  // type a new category name, we surface a friendly error.
  const categoryId = (raw.category_id as string | undefined) ?? "";
  if (!categoryId) {
    return { error: "Pick an existing category (subscription prefill required)" };
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
      subscription_id: subscriptionId,
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
  revalidatePath("/subscriptions");
  revalidatePath("/transactions");
  redirect("/dashboard");
}
