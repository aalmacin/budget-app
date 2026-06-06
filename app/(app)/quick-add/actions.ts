"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DeleteSavedExpenseResult = { ok: true } | { ok: false; error: string };

export async function deleteSavedExpenseAction(
  id: string,
): Promise<DeleteSavedExpenseResult> {
  if (!id) return { ok: false, error: "Missing template id" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_saved_expense", { p_id: id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/quick-add");
  return { ok: true };
}
