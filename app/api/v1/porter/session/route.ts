import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractCencoriApiKeyFromHeaders, hashApiKey } from "@/lib/api-keys";
import { handleCorsPreFlight } from "@/lib/gateway-middleware";
import { checkPorterSessionLimit } from "@/lib/porter/rate-limit";
import {
    PORTER_SESSION_TTL_SECONDS,
    isSessionSigningConfigured,
    mintPorterSession,
} from "@/lib/porter/session";

export const runtime = "nodejs";

/**
 * Open a conversation with a Porter.
 *
 * Every check that costs a database read happens here, once, and is then signed into a token the
 * chat endpoint can verify without touching the database at all. A visitor mints one of these and
 * talks; the messages after it are an HMAC verification rather than two queries each.
 *
 * The origin is checked here against the key's allowed domains and carried in the token, so chat
 * never re-reads a header whose value it cannot trust.
 */

function withCors(response: NextResponse, origin: string | null): NextResponse {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Vary", "Origin");
    return response;
}

export function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(request: NextRequest) {
    const origin = request.headers.get("origin");

    if (!isSessionSigningConfigured()) {
        // Failing closed rather than falling back to an unsigned session: a public endpoint that
        // quietly stops authenticating is worse than one that stops working.
        console.error("[Porter session] PORTER_SESSION_SECRET is missing or too short");
        return withCors(
            NextResponse.json({ error: { message: "Sessions are unavailable." } }, { status: 503 }),
            origin
        );
    }

    let body: { porterId?: unknown };
    try {
        body = (await request.json()) as { porterId?: unknown };
    } catch {
        return withCors(
            NextResponse.json({ error: { message: "Invalid JSON body." } }, { status: 400 }),
            origin
        );
    }

    if (typeof body.porterId !== "string" || !body.porterId.trim()) {
        return withCors(
            NextResponse.json({ error: { message: "porterId is required." } }, { status: 400 }),
            origin
        );
    }

    const apiKey = extractCencoriApiKeyFromHeaders(request.headers);
    if (!apiKey) {
        return withCors(
            NextResponse.json(
                { error: { message: "Missing key. Send your publishable key as a bearer token." } },
                { status: 401 }
            ),
            origin
        );
    }

    const visitorIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    const rate = await checkPorterSessionLimit(body.porterId, visitorIp);
    if (!rate.allowed) {
        return withCors(
            NextResponse.json(
                { error: { message: "Too many attempts. Try again shortly.", code: "rate_limited" } },
                { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
            ),
            origin
        );
    }

    const admin = createAdminClient();

    const { data: porter } = await admin
        .from("porters")
        .select("id, project_id, enabled")
        .eq("id", body.porterId)
        .maybeSingle();

    if (!porter) {
        return withCors(
            NextResponse.json({ error: { message: "Porter not found." } }, { status: 404 }),
            origin
        );
    }

    // The key has to belong to this Porter's project, or one customer's publishable key would open
    // a conversation with another's Porter.
    const { data: key } = await admin
        .from("api_keys")
        .select("allowed_domains")
        .eq("key_hash", hashApiKey(apiKey))
        .eq("project_id", porter.project_id)
        .maybeSingle();

    if (!key) {
        return withCors(
            NextResponse.json(
                { error: { message: "This key cannot be used with this Porter." } },
                { status: 403 }
            ),
            origin
        );
    }

    const allowed = (key.allowed_domains as string[] | null) ?? [];
    let host = "";
    if (origin) {
        try {
            host = new URL(origin).hostname.toLowerCase();
        } catch {
            host = "";
        }
    }

    if (allowed.length > 0 && (!host || !allowed.includes(host))) {
        return withCors(
            NextResponse.json(
                { error: { message: "Domain not allowed for this key.", code: "domain_not_allowed" } },
                { status: 403 }
            ),
            origin
        );
    }

    if (!porter.enabled) {
        return withCors(
            NextResponse.json(
                {
                    error: {
                        message: "This Porter is not ready yet. Its site has not been read.",
                        code: "porter_not_ready",
                    },
                },
                { status: 409 }
            ),
            origin
        );
    }

    const token = mintPorterSession({
        p: porter.id as string,
        j: porter.project_id as string,
        h: host || allowed[0] || "",
    });

    if (!token) {
        return withCors(
            NextResponse.json({ error: { message: "Sessions are unavailable." } }, { status: 503 }),
            origin
        );
    }

    return withCors(
        NextResponse.json({ token, expiresIn: PORTER_SESSION_TTL_SECONDS }),
        origin
    );
}
