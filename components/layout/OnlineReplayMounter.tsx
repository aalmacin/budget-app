"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store";
import { outboxActions } from "@/store/slices/outbox";
import { listOutboxEntries } from "@/lib/pwa/outbox";
import { replayPendingOutbox } from "@/lib/pwa/dispatch";

/**
 * Mounts in the authenticated layout. On every `online` event (and once on
 * mount), drains the outbox through the corresponding RPC and reflects the
 * result in the Redux slice so "queued" badges clear.
 */
export function OnlineReplayMounter() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      try {
        const entries = await listOutboxEntries();
        if (!cancelled) {
          dispatch(
            outboxActions.hydrate(
              entries.map((e) => ({
                id: e.id,
                rpc: e.rpc,
                enqueuedAt: e.enqueuedAt,
                lastError: e.lastError,
              })),
            ),
          );
        }
      } catch {
        // IndexedDB unavailable — silently skip.
      }
    };

    const replay = async () => {
      try {
        const result = await replayPendingOutbox();
        if (result.replayed > 0 && !cancelled) {
          // Re-hydrate to drop replayed entries from the slice.
          await hydrate();
        }
      } catch {
        // network blip — leave queue intact
      }
    };

    void hydrate().then(replay);

    const onOnline = () => void replay();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
  }, [dispatch]);

  return null;
}
