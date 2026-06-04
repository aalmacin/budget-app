"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logExpenseSchema } from "@/lib/validators/transaction";

export type LogExpenseState = { error: string | null };

const CATEGORY_NAME_MAX = 100;

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

    const { data: householdId, error: hhErr } = await supabase.rpc("get_current_household");
    if (hhErr || !householdId) {
      return { error: hhErr?.message ?? "No active household" };
    }

    // Race-safe find-or-create: another tab may have just created the same name.
    const { data: existing } = await supabase
      .from("category")
      .select("id")
      .eq("kind", "expense")
      .eq("name", categoryName)
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      categoryId = existing.id as string;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("category")
        .insert({ household_id: householdId, name: categoryName, kind: "expense" })
        .select("id")
        .single();
      if (createErr || !created) {
        return { error: createErr?.message ?? "Could not create category" };
      }
      categoryId = created.id as string;
    }
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
