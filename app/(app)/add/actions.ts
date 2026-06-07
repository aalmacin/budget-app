"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logExpenseSchema, recurringSchema } from "@/lib/validators/transaction";

export type LogExpenseState = { error: string | null };
export type CreateCategoryResult =
  | { ok: true; id: string; name: string }
  | { ok: false; error: string };

const CATEGORY_NAME_MAX = 100;

export async function createExpenseCategoryAction(
  name: string,
): Promise<CreateCategoryResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Category name is required" };
  if (trimmed.length > CATEGORY_NAME_MAX) {
    return {
      ok: false,
      error: `Category name must be ${CATEGORY_NAME_MAX} characters or fewer`,
    };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("ensure_category", {
    p_name: trimmed,
    p_kind: "expense",
  });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create category" };
  }
  revalidatePath("/add");
  return { ok: true, id: data as string, name: trimmed };
}

export async function logExpenseAction(
  _prev: LogExpenseState,
  formData: FormData,
): Promise<LogExpenseState> {
  const raw = Object.fromEntries(formData);
  const supabase = await createSupabaseServerClient();

  let categoryId = (raw.category_id as string | undefined) ?? "";
  const categoryName = ((raw.category_name as string | undefined) ?? "").trim();

  if (!categoryId) {
    if (!categoryName) {
      return { error: "Pick or add a category" };
    }
    if (categoryName.length > CATEGORY_NAME_MAX) {
      return { error: `Category name must be ${CATEGORY_NAME_MAX} characters or fewer` };
    }
    const { data: ensuredId, error: ensureErr } = await supabase.rpc("ensure_category", {
      p_name: categoryName,
      p_kind: "expense",
    });
    if (ensureErr || !ensuredId) {
      return { error: ensureErr?.message ?? "Could not create category" };
    }
    categoryId = ensuredId as string;
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

    const { error } = await supabase.rpc("log_expense_with_subscription", {
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
    const { error } = await supabase.rpc("log_expense", {
      p: {
        ...parsed.data,
        amount_cents: parsed.data.amount_cents.toString(),
      },
    });
    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/subscriptions");
  redirect("/dashboard");
}
