"use server";

import { redirect } from "next/navigation";
import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, finTag, txnTag, catTag, mchTag, recTag, qaTag } from "@/lib/supabase/cache";
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
  const hid = await getCurrentHousehold();
  if (hid) updateTag(catTag(hid));
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

  const forMemberIds = formData.getAll("for_member_ids[]") as string[];

  const parsed = logExpenseSchema.safeParse({
    ...raw,
    category_id: categoryId,
    essential_pct: raw.essential_pct ? Number(raw.essential_pct) : undefined,
    paid_by_member_id: raw.paid_by_member_id || undefined,
    for_member_ids: forMemberIds.filter(Boolean),
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

  const templateId = ((raw.template_id as string | undefined) ?? "").trim();
  const saveAsTemplate = raw.save_as_template === "on";
  const overrideTemplate = raw.override_template === "on";

  if ((templateId && overrideTemplate) || (!templateId && saveAsTemplate)) {
    const merchant = (parsed.data.notes ?? "").trim();
    if (!merchant) {
      return { error: "Merchant is required to save as template" };
    }
    const templatePayload = {
      merchant,
      amount_cents: parsed.data.amount_cents.toString(),
      category_id: parsed.data.category_id,
      paid_by_member_id: parsed.data.paid_by_member_id ?? null,
      for_member_ids: parsed.data.for_member_ids ?? [],
      essential_pct: parsed.data.essential_pct ?? 100,
      split_rule: parsed.data.split_rule ?? null,
    };

    if (templateId) {
      const { error } = await supabase.rpc("update_saved_expense", {
        p_id: templateId,
        p: templatePayload,
      });
      if (error) {
        return { error: `Expense saved, but updating template failed: ${error.message}` };
      }
    } else {
      const { error } = await supabase.rpc("create_saved_expense", {
        p: templatePayload,
      });
      if (error) {
        return { error: `Expense saved, but template creation failed: ${error.message}` };
      }
    }
  }

  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(finTag(hid));
    updateTag(txnTag(hid));
    updateTag(catTag(hid));
    updateTag(mchTag(hid));
    updateTag(recTag(hid));
    updateTag(qaTag(hid));
  }
  redirect("/dashboard");
}
