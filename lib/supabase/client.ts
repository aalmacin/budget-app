"use client";

import { createBrowserClient } from "@supabase/ssr";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Supabase env var missing: ${name}. Set it in .env.local.`);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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
