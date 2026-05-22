"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Subscribe to Postgres changes on `transaction` for one household. Fires
 * `onChange` for every INSERT/UPDATE/DELETE the caller has RLS access to.
 *
 * The hook itself is realtime-only — it does not call `revalidateTag(...)`
 * directly because that's a server-side primitive. Consumers wire the
 * callback to a server action that calls `revalidateTag('household:<id>')`
 * (this happens in `app/(app)/layout.tsx` per T060).
 *
 * Returns nothing; cleanup is automatic on unmount or householdId change.
 */
export function useHouseholdRealtime(
  householdId: string | null,
  onChange: (event: HouseholdRealtimeEvent) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!householdId) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`household:${householdId}:transactions`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transaction",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          onChange({
            type: payload.eventType,
            new: payload.new,
            old: payload.old,
          });
        },
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [householdId, onChange]);
}

export type HouseholdRealtimeEvent = {
  type: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};
