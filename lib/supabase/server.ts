import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    // Surfaced at startup rather than per-request so misconfiguration is loud.
    throw new Error(`Supabase env var missing: ${name}. Set it in .env.local.`);
  }
  return v;
}

const SUPABASE_URL = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

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
      try {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      } catch {
        // Server Components cannot set cookies; middleware handles refresh.
      }
    },
  };

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: "budget" },
    cookies: cookieMethods,
  });
}
