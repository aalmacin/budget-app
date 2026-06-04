import { cookies } from "next/headers";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

// Direct static reads so the Next.js compiler inlines NEXT_PUBLIC_* values
// into the bundle. `process.env[name]` (dynamic) is NOT replaced and would
// resolve to undefined in any code path that ships to the browser.
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
