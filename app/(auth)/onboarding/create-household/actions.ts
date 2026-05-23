"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createHouseholdSchema } from "@/lib/validators/household";

export type CreateHouseholdState = {
  error: string | null;
};

export async function createHouseholdAction(
  _prev: CreateHouseholdState,
  formData: FormData,
): Promise<CreateHouseholdState> {
  const parsed = createHouseholdSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.rpc("create_household", {
    p_name: parsed.data.name,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}
