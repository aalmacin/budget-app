"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, finTag, txnTag, mchTag, catTag } from "@/lib/supabase/cache";

export async function updateTransactionAction(
  id: string,
  patch: Record<string, string | number | null | string[]>,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_transaction", { p_id: id, p_patch: patch });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(finTag(hid));
    updateTag(txnTag(hid));
    updateTag(mchTag(hid));
    updateTag(catTag(hid));
  }
  return {};
}

export async function deleteTransactionAction(id: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("delete_transaction", { p_id: id });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) {
    updateTag(finTag(hid));
    updateTag(txnTag(hid));
  }
  return {};
}
