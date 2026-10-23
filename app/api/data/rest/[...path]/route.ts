import { NextRequest, NextResponse } from "next/server";
import { isBetterAuthEnabled } from "@/lib/auth/flags";
import { postgrestFetch } from "@/lib/data/postgrest-fetch";

// The browser's way to PostgREST after the RFC-0001 cutover. The browser
// Supabase client (lib/supabaseClient.ts) sends its /rest/v1/* requests here,
// same-origin with the session cookie; this forwards them to the private
// Brimble PostgREST as the signed-in Better Auth user (RLS applies exactly as
// it did on Supabase). No database token ever reaches the browser.

const FORWARD_REQUEST_HEADERS = [
    "accept", "accept-profile", "content-profile", "content-type",
    "prefer", "range", "range-unit", "x-client-info",
];
const FORWARD_RESPONSE_HEADERS = [
    "content-type", "content-range", "preference-applied", "location", "range-unit",
];

async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    if (!isBetterAuthEnabled()) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { path } = await params;
    const url = new URL(`/rest/v1/${path.map(encodeURIComponent).join("/")}`, "http://postgrest.internal");
    url.search = request.nextUrl.search;

    const headers = new Headers();
    for (const name of FORWARD_REQUEST_HEADERS) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
    }
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const upstream = await postgrestFetch("request-user")(url, {
        method: request.method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
    });

    const responseHeaders = new Headers();
    for (const name of FORWARD_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = forward;
export const HEAD = forward;
export const POST = forward;
export const PATCH = forward;
export const PUT = forward;
export const DELETE = forward;
