import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Mirror of the IndexedDB outbox (lib/pwa/outbox.ts) for the UI. The IndexedDB
 * store is the source of truth for offline writes; this slice exists so React
 * components can subscribe to changes (e.g., to render a "queued" badge on a
 * transaction row that hasn't synced yet).
 */
export type OutboxEntry = {
  /** Client-generated UUID v7 — also the eventual transaction.id. */
  id: string;
  /** The RPC name the entry will replay through on reconnect. */
  rpc: "log_expense" | "log_income";
  /** ISO timestamp the entry was enqueued. */
  enqueuedAt: string;
  /** Optional last error if a replay attempt failed. */
  lastError?: string;
};

type OutboxState = {
  entries: OutboxEntry[];
};

const initialState: OutboxState = {
  entries: [],
};

const outboxSlice = createSlice({
  name: "outbox",
  initialState,
  reducers: {
    hydrate(state, action: PayloadAction<OutboxEntry[]>) {
      state.entries = action.payload;
    },
    enqueue(state, action: PayloadAction<OutboxEntry>) {
      state.entries.push(action.payload);
    },
    remove(state, action: PayloadAction<string>) {
      state.entries = state.entries.filter((e) => e.id !== action.payload);
    },
    markError(
      state,
      action: PayloadAction<{ id: string; error: string }>,
    ) {
      const entry = state.entries.find((e) => e.id === action.payload.id);
      if (entry) entry.lastError = action.payload.error;
    },
  },
});

export const outboxActions = outboxSlice.actions;
export const outboxReducer = outboxSlice.reducer;
