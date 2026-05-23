"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  revalidatePath("/settings");
  return {};
}
