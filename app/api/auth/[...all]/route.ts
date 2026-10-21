import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth endpoints under /api/auth/*. The existing /api/auth/login,
// /api/auth/forgot-password and /api/auth/sso/lookup routes are more
// specific, so Next keeps serving them. Off until the auth cutover
// (RFC-0001 §4): imported lazily so a disabled deploy never connects to
// the Better Auth database.

const enabled = process.env.BETTER_AUTH_ENABLED === "true";

async function handle(request: Request): Promise<Response> {
    if (!enabled) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { auth } = await import("@/lib/auth/better-auth");
    const handlers = toNextJsHandler(auth);
    return request.method === "GET" ? handlers.GET(request) : handlers.POST(request);
}

export const GET = handle;
export const POST = handle;
