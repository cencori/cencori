import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractCencoriApiKeyFromHeaders, hashApiKey } from "@/lib/api-keys";
import { handleCorsPreFlight } from "@/lib/gateway-middleware";
import { readPorterSession } from "@/lib/porter/session";

/**
 * What the widget needs to draw itself before anyone types.
 *
 * Deliberately small: a name, a greeting, a colour. Everything that decides what the Porter says --
 * its model, its prompt, its pages -- stays on the server, because this response is readable by
 * anyone who opens devtools on the customer's site.
 *
 * The key is checked against the Porter's project and the request origin against the key's allowed
 * domains, so a config lifted from one site cannot be used to render a launcher on another.
 */

export const runtime = "nodejs";

function withCors(response: NextResponse, origin: string | null): NextResponse {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Vary", "Origin");
    return response;
}

export function OPTIONS() {
    return handleCorsPreFlight();
}

export async function GET(request: NextRequest) {
    const origin = request.headers.get("origin");
    const porterId = request.nextUrl.searchParams.get("porter");

    if (!porterId) {
        return withCors(NextResponse.json({ error: "porter is required." }, { status: 400 }), origin);
    }

    const credential = extractCencoriApiKeyFromHeaders(request.headers);
    if (!credential) {
        return withCors(NextResponse.json({ error: "Missing key." }, { status: 401 }), origin);
    }

    // A session is a key that has already been checked. Accepting one lets the console preview run
    // the real widget without the customer having to allow cencori.com on their own domain list.
    const session = readPorterSession(credential);
    const apiKey = session ? null : credential;

    const admin = createAdminClient();

    const { data: porter } = await admin
        .from("porters")
        .select("id, project_id, name, greeting, brand, brand_overrides, enabled, surface, publishable_key")
        .eq("id", porterId)
        .maybeSingle();

    if (!porter) {
        return withCors(NextResponse.json({ error: "Porter not found." }, { status: 404 }), origin);
    }

    if (session && (session.p !== porter.id || session.j !== porter.project_id)) {
        return withCors(
            NextResponse.json({ error: "This session is for a different Porter." }, { status: 403 }),
            origin
        );
    }

    if (apiKey && apiKey !== porter.publishable_key) {
        return withCors(NextResponse.json({ error: "This key cannot be used with this Porter." }, { status: 403 }), origin);
    }

    const { data: key } = session
        ? { data: { allowed_domains: null } }
        : await admin
            .from("api_keys")
            .select("allowed_domains")
            .eq("key_hash", hashApiKey(apiKey!))
            .eq("project_id", porter.project_id)
            .eq("client_app", "porter")
            .eq("key_type", "publishable")
            .is("revoked_at", null)
            .maybeSingle();

    if (!key) {
        return withCors(
            NextResponse.json({ error: "This key cannot be used with this Porter." }, { status: 403 }),
            origin
        );
    }

    // The same rule the gateway applies to a publishable key, applied before anything is drawn.
    const allowed = (key.allowed_domains as string[] | null) ?? [];
    if (!session) {
        let host = "";
        try {
            host = origin ? new URL(origin).hostname.toLowerCase() : "";
        } catch {
            host = "";
        }
        if (!allowed.includes(host)) {
            return withCors(
                NextResponse.json({ error: "Domain not allowed for this key." }, { status: 403 }),
                origin
            );
        }
    }

    // What the customer chose wins over what was read from their page.
    const brand = { ...(porter.brand ?? {}), ...(porter.brand_overrides ?? {}) };

    return withCors(
        NextResponse.json({
            name: porter.name,
            greeting: porter.greeting || `Hi — ask me anything about ${porter.name}.`,
            ready: porter.enabled,
            surface: porter.surface,
            brand: { color: brand.color ?? null, logo: brand.logo ?? null },
        }),
        origin
    );
}
