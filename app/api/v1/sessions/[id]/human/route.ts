import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity } from "@/lib/api-gateway-logs";
import { addGatewayHeaders, handleCorsPreFlight } from "@/lib/gateway-middleware";
import { authSessionRequest, denyOnScopeMismatch } from "@/lib/embedded/session-auth";

/**
 * A person handling a conversation (human handoff).
 *
 *   GET  /v1/sessions/:id/human?after=<iso>   who's handling it, and what was said meanwhile
 *   POST /v1/sessions/:id/human  { action: 'handoff', reason }   hand it to a person (the agent goes quiet)
 *                                { action: 'reply', text }        a person replies (keeps it with them)
 *                                { action: 'release' }            hand it back to the agent
 *
 * While a person handles it, the user's messages are kept for them instead of
 * starting a turn; when it goes back to the agent, the agent is told what was
 * said. It also goes back on its own after 30 quiet minutes.
 *
 * GET works with a browser client token (its own session), so a chat UI can
 * show the replies; POST needs a secret key.
 */

export async function OPTIONS() {
    return handleCorsPreFlight();
}

type Speaker = "user" | "human" | "agent";
const SPEAKER: Record<string, Speaker> = { customer: "user", owner: "human", assistant: "agent" };

async function load(req: NextRequest, id: string, endpoint: string) {
    const startedAt = Date.now();
    const { logApiGatewayRequest } = await import("@/lib/api-gateway-logs");
    const auth = await authSessionRequest(req, endpoint, startedAt, extractGatewayCallerIdentity(req.headers), (args) => {
        void logApiGatewayRequest({ ...args, apiKeyId: args.apiKeyId ?? "" });
    }, addGatewayHeaders);
    if ("status" in auth) return { error: auth };
    const db = createAdminClient();
    const { data: session } = await db
        .from("sessions")
        .select("id, project_id, metadata, tenant_id, external_user_id, installation_id")
        .eq("id", id)
        .maybeSingle();
    if (!session || denyOnScopeMismatch(session as { project_id: string; tenant_id?: string | null; external_user_id?: string | null; installation_id?: string | null }, auth.gatewayCtx.projectId, auth.embeddedScope)) {
        return { error: auth.respondError(404, "Session not found", "session_not_found") };
    }
    return { auth, db, session };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const loaded = await load(req, id, "/v1/sessions/:id/human");
    if ("error" in loaded) return loaded.error;
    const { auth, session } = loaded;
    const takeover = await import("@/lib/studio/takeover");
    const metadata = session.metadata as Record<string, unknown> | null;
    const after = Date.parse(req.nextUrl.searchParams.get("after") ?? "");
    const messages = takeover.manualMessages(metadata)
        .filter((m) => !Number.isFinite(after) || Date.parse(m.at) > after)
        .map((m) => ({ id: m.id, from: SPEAKER[m.from] ?? "user", text: m.text, at: m.at }));
    const flag = takeover.needsOwner(metadata);
    return auth.respond(NextResponse.json({
        handled_by: takeover.isOwnerActive(metadata) ? "human" : "agent",
        handoff: flag ? { reason: flag.reason, at: flag.at } : null,
        messages,
    }));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const loaded = await load(req, id, "/v1/sessions/:id/human");
    if ("error" in loaded) return loaded.error;
    const { auth, db } = loaded;
    if (auth.embeddedScope) return auth.respondError(403, "This operation requires a secret project key", "secret_key_required");

    let body: { action?: unknown; reason?: unknown; text?: unknown };
    try {
        body = await req.json();
    } catch {
        return auth.respondError(400, "Request body must be valid JSON", "invalid_json");
    }
    const takeover = await import("@/lib/studio/takeover");
    switch (body.action) {
        case "handoff": {
            const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "The agent handed this conversation to a person.";
            await takeover.handOffToHuman(db as never, id, reason);
            return auth.respond(NextResponse.json({ handled_by: "human", handoff: { reason } }));
        }
        case "reply": {
            const text = typeof body.text === "string" ? body.text.trim() : "";
            if (!text) return auth.respondError(400, "text is required", "missing_text");
            if (text.length > 4000) return auth.respondError(413, "text is longer than 4,000 characters", "text_too_long");
            const metadata = await takeover.addManualMessage(db as never, id, { from: "owner", text });
            const message = takeover.manualMessages(metadata).at(-1);
            return auth.respond(NextResponse.json({ handled_by: "human", message: message ? { id: message.id, from: "human", text: message.text, at: message.at } : null }, { status: 201 }));
        }
        case "release": {
            await takeover.handBack(db as never, id);
            return auth.respond(NextResponse.json({ handled_by: "agent" }));
        }
        default:
            return auth.respondError(400, "action must be 'handoff', 'reply' or 'release'", "invalid_action");
    }
}
