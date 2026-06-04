"use client";

import { createBrowserClient } from "@supabase/ssr";

// Direct static reads — Next.js' webpack DefinePlugin only inlines
// `process.env.NEXT_PUBLIC_*` when the access is literal. Dynamic forms like
// `process.env[name]` survive into the client bundle and resolve to undefined
// at runtime, because the browser has no real `process.env`.
function assertEnv(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(
      `Supabase env var missing: ${label}. Set it in .env.local, then restart the dev server.`,
    );
  }
  return value;
}

const SUPABASE_URL = assertEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);
const SUPABASE_ANON_KEY = assertEnv(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser-side Supabase client. Memoized per page load so we don't churn
 * realtime/auth connections on every render.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return browserClient;
}
