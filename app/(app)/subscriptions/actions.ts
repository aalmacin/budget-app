"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Online-only by design: this is a server action, so it can't queue through
// the IndexedDB outbox (which is client-side). If you want offline support,
// move the submit handler to a "use client" component and call dispatchOrEnqueue
// directly — but you'll also need to update lib/pwa/outbox.ts OutboxRpc and
// have register_subscription accept a client-supplied id for idempotency.
export async function registerSubscriptionAction(p: {
  merchant: string;
  amount_cents: bigint;
  category_id: string;
  cadence: string;
  next_renewal_at: string;
  paid_by_member_id?: string | null;
  for_member_id?: string | null;
  essential_pct?: number;
}): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("register_subscription", {
    p: {
      ...p,
      amount_cents: p.amount_cents.toString(),
    },
  });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  revalidatePath("/dashboard");
  return {};
}

export async function pauseSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("pause_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}

export async function resumeSubscriptionAction(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resume_subscription", { p_id: id });
  if (error) return { error: error.message };
  revalidatePath("/subscriptions");
  return {};
}
