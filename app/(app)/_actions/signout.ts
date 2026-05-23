"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Sign-out server action — invalidates the Supabase session and clears
 * cookies via the SSR client. Then redirects to /login.
 *
 * Consumed by `components/layout/AppDrawer.tsx` via `<form action={signOutAction}>`.
 */
export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
