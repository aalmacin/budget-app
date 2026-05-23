"use client";

import {
  enqueueOutboxEntry,
  removeOutboxEntry,
  listOutboxEntries,
  markOutboxError,
  type OutboxEntry,
  type OutboxRpc,
} from "@/lib/pwa/outbox";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Mint a UUID v7 (time-ordered) for offline-replay idempotency.
 * Used as both the outbox key and the eventual transaction.id.
 */
export function uuidV7(): string {
  const ts = BigInt(Date.now());
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);
  bytes[6] = (0x70 | (bytes[6]! & 0x0f)) & 0xff; // version 7
  bytes[8] = (0x80 | (bytes[8]! & 0x3f)) & 0xff; // RFC variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Dispatch an `log_expense` / `log_income` RPC, falling back to the IndexedDB
 * outbox when the browser is offline or the call fails. The supplied UUID is
 * both the outbox key and the eventual `transaction.id`, so replay is
 * idempotent against the table's PK.
 */
export async function dispatchOrEnqueue(
  rpc: OutboxRpc,
  payload: Record<string, unknown>,
): Promise<{ queued: boolean; id: string }> {
  const id = (payload.id as string | undefined) ?? uuidV7();
  const fullPayload = { ...payload, id };
  const entry: OutboxEntry = {
    id,
    rpc,
    payload: fullPayload,
    enqueuedAt: new Date().toISOString(),
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await enqueueOutboxEntry(entry);
    return { queued: true, id };
  }

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc(rpc, { p: fullPayload });
  if (error) {
    await enqueueOutboxEntry({ ...entry, lastError: error.message });
    return { queued: true, id };
  }
  return { queued: false, id };
}

/**
 * Drain every queued entry through the appropriate RPC. Called by
 * `OnlineReplayMounter` on `online` events and at mount-time.
 */
export async function replayPendingOutbox(): Promise<{ replayed: number; failed: number }> {
  const supabase = getSupabaseBrowserClient();
  const entries = await listOutboxEntries();
  let replayed = 0;
  let failed = 0;
  for (const entry of entries) {
    const { error } = await supabase.rpc(entry.rpc, { p: entry.payload });
    if (error) {
      await markOutboxError(entry.id, error.message);
      failed += 1;
    } else {
      await removeOutboxEntry(entry.id);
      replayed += 1;
    }
  }
  return { replayed, failed };
}
