import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Surfaced at startup rather than per-request so misconfiguration is loud.
  throw new Error(
    "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
  );
}

/**
 * Server-side Supabase client for Server Components, Server Actions, and route
 * handlers. Reads and writes Supabase session cookies via Next's cookies()
 * store. Always returns a fresh client per request to keep cookie state
 * scoped to the request.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  const cookieMethods: CookieMethodsServer = {
    getAll() {
      return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        cookieStore.set(name, value, options);
      }
    },
  };

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: cookieMethods,
  });
}
