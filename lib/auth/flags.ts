// Which auth system is live. Supabase Auth until the RFC-0001 cutover, then
// Better Auth. NEXT_PUBLIC_ so browser code reads the same switch (it is
// inlined at build time, so flipping it needs a rebuild). BETTER_AUTH_ENABLED
// is the earlier server-only name, still honoured on the server.
export function isBetterAuthEnabled(): boolean {
    return (
        process.env.NEXT_PUBLIC_BETTER_AUTH_ENABLED === "true" ||
        (typeof window === "undefined" && process.env.BETTER_AUTH_ENABLED === "true")
    );
}
