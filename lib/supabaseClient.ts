import { createBrowserClient } from "@supabase/ssr";
import { canonicalizeAuthCookies } from "@/lib/auth/canonicalize-auth-cookies";
import { isBetterAuthEnabled } from "@/lib/auth/flags";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// After the RFC-0001 cutover the browser has no database token: PostgREST
// requests go same-origin to /api/data/rest/*, which forwards them as the
// signed-in Better Auth user (app/api/data/rest/[...path]/route.ts).
const restViaApp: typeof fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.pathname.startsWith("/rest/v1/")) return fetch(input, init);
  const target = new URL(`/api/data/rest/${url.pathname.slice("/rest/v1/".length)}`, window.location.origin);
  target.search = url.search;
  const headers = new Headers(init?.headers);
  headers.delete("apikey");
  headers.delete("authorization");
  return fetch(target, { ...init, headers, credentials: "same-origin" });
};

// THE browser client. Import this — never call createBrowserClient directly.
//
// @supabase/ssr caches its own module-level singleton and silently ignores the
// options of every call after the first, so a second call site with different
// cookieOptions doesn't get a second client — it gets *this* one, and whichever
// module evaluated first decides the cookie domain for the whole app. Keeping
// one call site is what makes `domain` deterministic.
function build() {
  return createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      ...(isBetterAuthEnabled() && typeof window !== "undefined" ? { global: { fetch: restViaApp } } : {}),
      cookieOptions: {
        // Shared with scan./api./send. — the session has to be readable there.
        domain: typeof window !== 'undefined' && window.location.hostname.endsWith('cencori.com')
          ? '.cencori.com'
          : undefined,
        path: '/',
        sameSite: 'lax',
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
      },
    }
  );
}

// Inferred from the factory, not `ReturnType<typeof createBrowserClient>` —
// the latter resolves the generic parameters to their bare defaults and hands
// every caller a client whose query results are untyped.
let client: ReturnType<typeof build> | null = null;

export const supabase = (() => {
  if (client) return client;

  // Must run before the client reads cookies, or it reads the stale duplicate.
  if (typeof window !== "undefined") {
    canonicalizeAuthCookies();
  }

  client = build();
  return client;
})();
