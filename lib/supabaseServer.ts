import { createServerClient as createSSClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { postgrestFetch } from "@/lib/data/postgrest-fetch";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createServerClient = async () => {
  const cookieStore = await cookies();
  const host = (await headers()).get("host") || "";
  const isProd = host.endsWith("cencori.com");

  return createSSClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        // getAll/setAll, not get/set/remove. The single-cookie API can only be
        // handed name "hints", so @supabase/ssr guesses at chunk names and gives
        // up after 5 — it cannot see stale chunks it didn't guess, and leaves
        // them behind. getAll sees every cookie, so chunked sessions round-trip
        // correctly and old chunks actually get cleared.
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                domain: isProd ? ".cencori.com" : undefined,
                path: "/",
                sameSite: "lax",
                secure: isProd,
              });
            });
          } catch {
            // Called from a Server Component, which can't set cookies. The
            // middleware refreshes the session, so this is safe to swallow.
          }
        },
      },
      // After the RFC-0001 cutover, queries go to the Brimble PostgREST as the
      // Better Auth user of this request (lib/data/postgrest-fetch.ts).
      ...(isBetterAuthEnabled() ? { global: { fetch: postgrestFetch("request-user") } } : {}),
    },
  );
};
