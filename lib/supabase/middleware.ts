import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.",
  );
}

/**
 * Per-request nonce header name. Server Components read this via next/headers
 * to forward the nonce to inline scripts / styles so the CSP is honored.
 */
export const CSP_NONCE_HEADER = "x-csp-nonce";

function generateNonce(): string {
  // 16 random bytes → base64; the resulting string is safe for CSP.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildCsp(nonce: string): string {
  // Strict CSP: nonce-based for inline scripts/styles, self for everything else,
  // plus the Supabase origin for fetch/websocket connections.
  const supabaseOrigin = new URL(SUPABASE_URL!).origin;
  const directives: string[] = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseOrigin} wss://${new URL(SUPABASE_URL!).host}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ];
  return directives.join("; ");
}

/**
 * Per-request middleware: generates a CSP nonce, refreshes the Supabase
 * session cookies, and sets the Content-Security-Policy response header.
 *
 * Wired through the repo-root `middleware.ts`.
 */
export async function updateSupabaseSession(request: NextRequest) {
  const nonce = generateNonce();

  // Forward the nonce on the request so RSC + downstream middleware can read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshing the session is the documented Supabase SSR side-effect that
  // triggers cookie rotation.
  await supabase.auth.getUser();

  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set(CSP_NONCE_HEADER, nonce);

  return response;
}
