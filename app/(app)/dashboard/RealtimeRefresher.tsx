"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHouseholdRealtime } from "@/lib/supabase/realtime";

/**
 * Mounts the realtime channel for the current household and, on any
 * incoming change, calls `router.refresh()` so the RSC re-fetches
 * `get_dashboard_summary` and the recent-activity strip updates within
 * SC-003's 5 s budget.
 *
 * T060: the constitution and plan describe revalidateTag-based refresh, but
 * the dashboard summary is a JSONB RPC return — router.refresh is the
 * equivalent App Router primitive for an RSC tree.
 */
export function RealtimeRefresher({ householdId }: { householdId: string }) {
  const router = useRouter();
  useHouseholdRealtime(householdId, () => {
    router.refresh();
  });
  useEffect(() => {
    // First-mount refresh in case the user navigated back to a stale RSC.
    router.refresh();
  }, [router]);
  return null;
}
