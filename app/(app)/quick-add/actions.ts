"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, qaTag, recTag } from "@/lib/supabase/cache";

export type DeleteSavedExpenseResult = { ok: true } | { ok: false; error: string };

export async function deleteSavedExpenseAction(
  id: string,
): Promise<DeleteSavedExpenseResult> {
  if (!id) return { ok: false, error: "Missing template id" };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_saved_expense", { p_id: id });
  if (error) return { ok: false, error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(qaTag(hid));
    updateTag(recTag(hid));
  }
  return { ok: true };
}
