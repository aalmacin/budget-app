import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppDrawer } from "@/components/layout/AppDrawer";
import { OnlineReplayMounter } from "@/components/layout/OnlineReplayMounter";
import { ReduxProvider } from "@/store/Provider";
import { AddFAB } from "@/components/ui/AddFAB";

/**
 * Authenticated route-group layout.
 *
 * Gate logic:
 *   1. No session → redirect to /login.
 *   2. Session but no active `household_member` row → redirect to
 *      /onboarding/create-household (FR-003).
 *   3. Otherwise render the app shell (drawer + Redux provider).
 *
 * Realtime wiring is done in T060 (US2) once the Realtime channel hook is
 * actually consumed by transaction-aware screens. The hook is already
 * available in lib/supabase/realtime.ts.
 */
export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Principle III: clients never read budget.* tables directly — `authenticated`
  // has no SELECT grant. Use the SECURITY DEFINER RPC instead.
  const { data: householdId } = await supabase.rpc("get_current_household");

  if (!householdId) {
    redirect("/onboarding/create-household");
  }

  return (
    <ReduxProvider>
      <div className="min-h-svh bg-bg flex flex-col">
        <main className="flex-1 relative w-full max-w-2xl mx-auto">
          {children}
          <AddFAB />
        </main>
        <AppDrawer />
        <OnlineReplayMounter />
      </div>
    </ReduxProvider>
  );
}
