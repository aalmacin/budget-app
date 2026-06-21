"use client";

import { useRouter } from "next/navigation";
import { useHouseholdRealtime } from "@/lib/supabase/realtime";

// Subscribes to realtime household changes and refreshes the RSC tree when
// a remote write arrives. The eager mount refresh was removed — the 30s cache
// TTL handles staleness without forcing a redundant server render on every
// dashboard visit.
export function RealtimeRefresher({ householdId }: { householdId: string }) {
  const router = useRouter();
  useHouseholdRealtime(householdId, () => {
    router.refresh();
  });
  return null;
}
