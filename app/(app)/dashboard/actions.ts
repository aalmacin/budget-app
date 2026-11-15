"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, sugTag } from "@/lib/supabase/cache";
import { uuidSchema } from "@/lib/validators";

export async function dismissExpenseSuggestionAction(id: string): Promise<{ error?: string }> {
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { error: "Invalid suggestion" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("dismiss_expense_suggestion", { p_id: parsed.data });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(sugTag(hid));
  return {};
}
