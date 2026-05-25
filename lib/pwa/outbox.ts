"use client";

/**
 * IndexedDB-backed outbox for offline expense/income writes. The store is the
 * source of truth; the Redux mirror in `store/slices/outbox.ts` exists so
 * components can render queued state.
 *
 * Strategy:
 *  - Entry keyed by client-generated UUID v7 (also the eventual
 *    transaction.id). Replay through the same RPC is idempotent because the
 *    `transaction` PK matches the queued UUID.
 *  - On `online` events (and on `navigator.onLine` becoming true after a
 *    mount), `replayOutbox()` drains the queue through the provided
 *    `dispatch` callback. Failed entries stay queued and surface `lastError`.
 *
 * Used by T061 (US2) once log_expense / log_income RPCs are wired.
 */

const DB_NAME = "budget-outbox";
const DB_VERSION = 1;
const STORE = "entries";

// register_subscription is intentionally NOT in this union. Subscription
// registration goes through a server action (subscriptions/actions.ts), and
// server actions can't dispatch via `dispatchOrEnqueue` (which is `"use
// client"` and writes to IndexedDB). If subscriptions ever need offline
// support, lift the form submit handler to a client component first.
export type OutboxRpc = "log_expense" | "log_income";

export type OutboxEntry = {
  /** UUID v7, also the eventual transaction.id. */
  id: string;
  rpc: OutboxRpc;
  /** Arbitrary JSON-safe payload — passed verbatim to supabase.rpc. */
  payload: unknown;
  /** ISO timestamp the entry was enqueued. */
  enqueuedAt: string;
  /** Optional last error if a replay attempt failed. */
  lastError?: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("openDb failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      Promise.resolve(fn(store)).then(resolve, reject);
      tx.onerror = () => reject(tx.error ?? new Error("tx failed"));
      tx.onabort = () => reject(tx.error ?? new Error("tx aborted"));
    });
  } finally {
    db.close();
  }
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("idb request failed"));
  });
}

export async function enqueueOutboxEntry(entry: OutboxEntry): Promise<void> {
  await withStore("readwrite", (store) => reqToPromise(store.put(entry)));
}

export async function listOutboxEntries(): Promise<OutboxEntry[]> {
  return withStore("readonly", (store) =>
    reqToPromise(store.getAll()) as Promise<OutboxEntry[]>,
  );
}

export async function removeOutboxEntry(id: string): Promise<void> {
  await withStore("readwrite", (store) => reqToPromise(store.delete(id)));
}

export async function markOutboxError(
  id: string,
  error: string,
): Promise<void> {
  await withStore("readwrite", async (store) => {
    const existing = (await reqToPromise(store.get(id))) as
      | OutboxEntry
      | undefined;
    if (!existing) return;
    await reqToPromise(
      store.put({ ...existing, lastError: error }),
    );
  });
}

/**
 * Replay queued entries one-by-one. The dispatcher is supplied by the caller
 * (typically a thin wrapper around `supabase.rpc(entry.rpc, entry.payload)`).
 * Successful entries are deleted; failures stay queued with `lastError`
 * updated.
 */
export async function replayOutbox(
  dispatch: (entry: OutboxEntry) => Promise<void>,
): Promise<{ replayed: number; failed: number }> {
  const entries = await listOutboxEntries();
  let replayed = 0;
  let failed = 0;
  for (const entry of entries) {
    try {
      await dispatch(entry);
      await removeOutboxEntry(entry.id);
      replayed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markOutboxError(entry.id, message);
      failed += 1;
    }
  }
  return { replayed, failed };
}
