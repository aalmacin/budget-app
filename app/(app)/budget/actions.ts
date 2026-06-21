"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, finTag, bgtTag } from "@/lib/supabase/cache";

export async function setCategoryBudgetAction(
  categoryId: string,
  cents: bigint | null,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_category_budget", {
    p_category_id: categoryId,
    p_monthly_budget_cents: cents === null ? null : cents.toString(),
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(bgtTag(hid));
    updateTag(finTag(hid));
  }
  return {};
}
