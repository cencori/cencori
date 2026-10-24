import "server-only";

import { createHmac } from "node:crypto";

// Short-lived HS256 tokens PostgREST verifies with the shared
// POSTGREST_JWT_SECRET (its PGRST_JWT_SECRET). `role` picks the Postgres role
// (anon / authenticated / service_role); `sub` is what auth.uid() returns in
// RLS policies. Minted per request from the Better Auth session; never sent to
// the browser.

export type PostgrestRole = "anon" | "authenticated" | "service_role";

const TOKEN_TTL_SECONDS = 60;

function base64url(input: Buffer | string): string {
    return Buffer.from(input).toString("base64url");
}

export function signPostgrestJwt(claims: { role: PostgrestRole; sub?: string; email?: string }): string {
    const secret = process.env.POSTGREST_JWT_SECRET;
    if (!secret) throw new Error("POSTGREST_JWT_SECRET is not set");
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = base64url(JSON.stringify({ ...claims, aud: "authenticated", iat: now, exp: now + TOKEN_TTL_SECONDS }));
    const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${signature}`;
}

// The service token is the same for every request; reuse it until it nears
// expiry instead of signing per query.
let serviceToken: { token: string; expiresAt: number } | null = null;

export function serviceRoleJwt(): string {
    if (!serviceToken || Date.now() > serviceToken.expiresAt - 10_000) {
        serviceToken = {
            token: signPostgrestJwt({ role: "service_role" }),
            expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
        };
    }
    return serviceToken.token;
}
