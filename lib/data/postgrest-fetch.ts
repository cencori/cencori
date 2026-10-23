import "server-only";

import { serviceRoleJwt, signPostgrestJwt } from "@/lib/data/postgrest-jwt";

// fetch for server-side Supabase clients after the RFC-0001 cutover. The
// clients keep building PostgREST requests as before; this sends the
// /rest/v1/* ones to the Brimble PostgREST (POSTGREST_URL, private network)
// with a JWT the app minted, instead of Supabase's keys:
//
//   "service"       admin clients → role service_role (bypasses RLS)
//   "request-user"  user clients → the Better Auth user of the current
//                   request as `authenticated` (auth.uid() = their id), or
//                   `anon` when nobody is signed in
//
// Other paths (/storage/v1, /realtime/v1) pass through untouched.

export type PostgrestFetchMode = "service" | "request-user";

const REST_PREFIX = "/rest/v1";

async function requestUserJwt(): Promise<string> {
    const [{ auth }, { headers }] = await Promise.all([
        import("@/lib/auth/better-auth"),
        import("next/headers"),
    ]);
    // Outside a request (scripts, background jobs) there are no headers; that
    // caller gets anon, the least-privileged role.
    let requestHeaders: Headers | null = null;
    try {
        requestHeaders = new Headers(await headers());
    } catch {
        requestHeaders = null;
    }
    const session = requestHeaders
        ? await auth.api.getSession({ headers: requestHeaders }).catch(() => null)
        : null;
    return session?.user
        ? signPostgrestJwt({ role: "authenticated", sub: session.user.id, email: session.user.email })
        : signPostgrestJwt({ role: "anon" });
}

export function postgrestFetch(mode: PostgrestFetchMode): typeof fetch {
    return async (input, init) => {
        const original = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
        if (!original.pathname.startsWith(REST_PREFIX)) return fetch(input, init);

        const base = process.env.POSTGREST_URL;
        if (!base) throw new Error("POSTGREST_URL is not set");
        const target = new URL(original.pathname.slice(REST_PREFIX.length) || "/", base);
        target.search = original.search;

        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        headers.delete("apikey");
        headers.set("Authorization", `Bearer ${mode === "service" ? serviceRoleJwt() : await requestUserJwt()}`);

        return fetch(target, { ...init, headers });
    };
}
