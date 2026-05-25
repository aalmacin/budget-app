"use client";

import { createBrowserClient } from "@supabase/ssr";

// Webpack DefinePlugin only inlines literal `process.env.NEXT_PUBLIC_*`
// property accesses; dynamic lookups like `process.env[name]` resolve to
// undefined in the browser bundle (process.env is empty client-side).
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. Set them in .env.local and restart the dev server.",
  );
}

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Browser-side Supabase client. Memoized per page load so we don't churn
 * realtime/auth connections on every render.
 */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      db: { schema: "budget" },
    });
  }
  return browserClient;
}
