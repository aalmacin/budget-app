"use server";

import { updateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentHousehold, catTag, mbrTag } from "@/lib/supabase/cache";

export async function setTimezoneAction(
  timezone: string,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_household_timezone", {
    p_timezone: timezone,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(mbrTag(hid));
  return {};
}

export async function setCategoryEssentialPctAction(
  categoryId: string,
  pct: number,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_category_essential_pct", {
    p_category_id: categoryId,
    p_pct: pct,
  });
  if (error) return { error: error.message };
  const hid = await getCurrentHousehold();
  if (hid) updateTag(catTag(hid));
  return {};
}
