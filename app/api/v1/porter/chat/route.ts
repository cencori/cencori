import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";
import { readPorterSession } from "@/lib/porter/session";
import { POST as gatewayChatCompletions } from "@/app/api/v1/chat/completions/route";
import { buildGroundedPrompt, findPorterPassages } from "@/lib/porter/knowledge";
import { checkPorterRateLimit } from "@/lib/porter/rate-limit";
import { handleCorsPreFlight } from "@/lib/gateway-middleware";

/**
 * Chat with a Porter.
 *
 * Takes a session token from /v1/porter/session, not a publishable key. Everything a key would have
 * proved -- that it belongs to this Porter's project, that the origin is allowed, that the Porter is
 * ready -- was checked when the session was minted and is signed into the token. Verifying it is an
 * HMAC rather than the two database reads this route used to perform on every single message.
 *
 * The browser still never names a model, a system prompt or a temperature. Anything the page can
 * name, a visitor with devtools can change, and the page is on the customer's own site where all of
 * this is readable by design.
 *
 * So this remains a resolver rather than a second gateway: it turns a Porter into a configuration
 * and hands the request to /v1/chat/completions unchanged in every other respect, which is what
 * keeps a Porter turn subject to the same admission control, guards, cache, routing, logging and
 * metering as any other call.
 */

const DEFAULT_PORTER_MODEL = "groq/compound";
const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY = 20;

type PorterChatRequest = {
    message?: unknown;
    history?: unknown;
    stream?: unknown;
};

type PorterTurn = { role: "user" | "assistant"; content: string };

function readHistory(raw: unknown): PorterTurn[] {
    if (!Array.isArray(raw)) return [];
    const turns: PorterTurn[] = [];
    for (const entry of raw.slice(-MAX_HISTORY)) {
        if (!entry || typeof entry !== "object") continue;
        const { role, content } = entry as { role?: unknown; content?: unknown };
        if (role !== "user" && role !== "assistant") continue;
        if (typeof content !== "string" || !content.trim()) continue;
        turns.push({ role, content: content.slice(0, MAX_MESSAGE_CHARS) });
    }
    return turns;
}

/** What a Porter is told about itself, before any retrieved pages are added to it. */
function buildSystemPrompt(porter: { name: string; system_prompt: string | null; source_url: string }): string {
    if (porter.system_prompt?.trim()) return porter.system_prompt.trim();
    return [
        `You answer questions on behalf of ${porter.name} (${porter.source_url}).`,
        "Be brief and concrete. Use plain language.",
        "If you do not know something about this business, say so and suggest contacting them directly.",
        "Never invent prices, policies, availability, or contact details.",
    ].join(" ");
}

// The widget runs on the customer's domain and calls this from a browser, so every reply -- the
// refusals included -- has to be readable cross-origin or the page sees an opaque network error
// instead of the reason.
function withCors(response: NextResponse, origin: string | null): NextResponse {
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    response.headers.set("Vary", "Origin");
    return response;
}

export function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    const origin = req.headers.get("origin");
    let body: PorterChatRequest;
    try {
        body = (await req.json()) as PorterChatRequest;
    } catch {
        return withCors(NextResponse.json({ error: { message: "Invalid JSON body." } }, { status: 400 }), origin);
    }

    if (typeof body.message !== "string" || !body.message.trim()) {
        return withCors(NextResponse.json({ error: { message: "message is required." } }, { status: 400 }), origin);
    }

    const session = readPorterSession(extractCencoriApiKeyFromHeaders(req.headers));
    if (!session) {
        // Expired or absent rather than wrong: the widget's answer to either is to open a new
        // session, so the code says which door to try rather than only that this one is shut.
        return withCors(
            NextResponse.json(
                {
                    error: {
                        message: "Your session has expired. Start a new one.",
                        code: "session_invalid",
                    },
                },
                { status: 401 }
            ),
            origin
        );
    }

    const admin = createAdminClient();

    // Everything below reads from the token. The Porter's prompt is the one thing still worth a
    // read, because a customer editing it should take effect on the next message rather than the
    // next session.
    const { data: porter } = await admin
        .from("porters")
        .select("id, project_id, name, system_prompt, model, source_url, enabled, publishable_key")
        .eq("id", session.p)
        .maybeSingle();

    if (!porter || !porter.enabled) {
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

    // Before retrieval and before the provider: the two expensive things this route does are the
    // two an abusive caller wants it to do.
    const visitorIp =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        "unknown";

    const rate = await checkPorterRateLimit(session.p, visitorIp);
    if (!rate.allowed) {
        return withCors(NextResponse.json(
            {
                error: {
                    message:
                        rate.scope === "visitor"
                            ? "You have sent a lot of messages. Give it a moment and try again."
                            : "This assistant is handling too many messages right now. Try again shortly.",
                    code: "rate_limited",
                },
            },
            { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
        ), origin);
    }

    // Retrieval is fail-open: a Porter that cannot reach its own pages answers worse rather than
    // failing, and the prompt it gets in that case tells it to decline instead of guessing. Both
    // the project and the host come from the token, already verified when the session was minted.
    const passages = await findPorterPassages(admin, session.j, body.message, session.h);

    const messages = [
        { role: "system", content: buildGroundedPrompt(buildSystemPrompt(porter), passages) },
        ...readHistory(body.history),
        { role: "user", content: body.message.slice(0, MAX_MESSAGE_CHARS) },
    ];

    // The gateway needs a key of its own: the session token authenticates the visitor to Porter,
    // not Porter to the gateway. The Porter's publishable key is what pays for and scopes the call,
    // and the Origin travels with it so the domain lock applies exactly as it would for any other
    // publishable request.
    if (!porter.publishable_key) {
        console.error("[Porter chat] porter has no publishable key:", porter.id);
        return withCors(
            NextResponse.json({ error: { message: "This Porter is not installable yet." } }, { status: 409 }),
            origin
        );
    }

    // Everything the gateway reads stays as it arrived -- the Origin above all, so the domain lock
    // applies -- except the credential, which becomes the Porter's own key.
    const delegatedHeaders = new Headers(req.headers);
    delegatedHeaders.set("Authorization", `Bearer ${porter.publishable_key}`);

    const delegated = new NextRequest(new URL("/api/v1/chat/completions", req.url), {
        method: "POST",
        headers: delegatedHeaders,
        body: JSON.stringify({
            model: porter.model || DEFAULT_PORTER_MODEL,
            messages,
            stream: body.stream === true,
        }),
    });

    return gatewayChatCompletions(delegated);
}
