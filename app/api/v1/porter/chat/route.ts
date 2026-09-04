import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractCencoriApiKeyFromHeaders, hashApiKey } from "@/lib/api-keys";
import { POST as gatewayChatCompletions } from "@/app/api/v1/chat/completions/route";

/**
 * Chat with a Porter.
 *
 * The browser sends a porter id and a message. It never sends a model, a system prompt or a
 * temperature, because anything the page can name a visitor with devtools can change -- and the
 * page is on the customer's own site, where the publishable key is readable by design.
 *
 * So this route is a resolver, not a second gateway. It turns an id into a configuration and hands
 * the request to /v1/chat/completions unchanged in every other respect, which is what keeps a
 * Porter turn subject to the same admission control, guards, cache, routing, logging and metering
 * as any other call. The one thing it adds is proving that the key presented belongs to the same
 * project as the Porter being addressed; the domain lock on that key is enforced downstream, where
 * it already is for every publishable key.
 */

const DEFAULT_PORTER_MODEL = "groq/compound";
const MAX_MESSAGE_CHARS = 8000;
const MAX_HISTORY = 20;

type PorterChatRequest = {
    porterId?: unknown;
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

/**
 * What a Porter is told about itself when it has no pages yet. Once the crawl lands, retrieved
 * passages join this and the instruction to decline gets something to work with.
 */
function buildSystemPrompt(porter: { name: string; system_prompt: string | null; source_url: string }): string {
    if (porter.system_prompt?.trim()) return porter.system_prompt.trim();
    return [
        `You answer questions on behalf of ${porter.name} (${porter.source_url}).`,
        "Be brief and concrete. Use plain language.",
        "If you do not know something about this business, say so and suggest contacting them directly.",
        "Never invent prices, policies, availability, or contact details.",
    ].join(" ");
}

export async function POST(req: NextRequest) {
    let body: PorterChatRequest;
    try {
        body = (await req.json()) as PorterChatRequest;
    } catch {
        return NextResponse.json({ error: { message: "Invalid JSON body." } }, { status: 400 });
    }

    if (typeof body.porterId !== "string" || !body.porterId.trim()) {
        return NextResponse.json({ error: { message: "porterId is required." } }, { status: 400 });
    }
    if (typeof body.message !== "string" || !body.message.trim()) {
        return NextResponse.json({ error: { message: "message is required." } }, { status: 400 });
    }

    const apiKey = extractCencoriApiKeyFromHeaders(req.headers);
    if (!apiKey) {
        return NextResponse.json(
            { error: { message: "Missing API key. Send your publishable key as a bearer token." } },
            { status: 401 }
        );
    }

    const admin = createAdminClient();

    const { data: porter, error: porterError } = await admin
        .from("porters")
        .select("id, project_id, name, system_prompt, model, source_url, enabled")
        .eq("id", body.porterId)
        .maybeSingle();

    if (porterError || !porter) {
        return NextResponse.json({ error: { message: "Porter not found." } }, { status: 404 });
    }

    // The key has to belong to the Porter's own project, or one customer's publishable key would
    // address another's Porter. This is a lookup rather than a full gateway validation on purpose:
    // validating here as well would spend the request's rate limit twice.
    const { data: key } = await admin
        .from("api_keys")
        .select("id")
        .eq("key_hash", hashApiKey(apiKey))
        .eq("project_id", porter.project_id)
        .maybeSingle();

    if (!key) {
        return NextResponse.json(
            { error: { message: "This key cannot be used with this Porter." } },
            { status: 403 }
        );
    }

    if (!porter.enabled) {
        return NextResponse.json(
            {
                error: {
                    message: "This Porter is not ready yet. Its site has not been read.",
                    code: "porter_not_ready",
                },
            },
            { status: 409 }
        );
    }

    const messages = [
        { role: "system", content: buildSystemPrompt(porter) },
        ...readHistory(body.history),
        { role: "user", content: body.message.slice(0, MAX_MESSAGE_CHARS) },
    ];

    // Same headers, so the gateway sees the same key and the same Origin and applies the domain
    // lock exactly as it would for a direct call. Only the body is ours.
    const delegated = new NextRequest(new URL("/api/v1/chat/completions", req.url), {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify({
            model: porter.model || DEFAULT_PORTER_MODEL,
            messages,
            stream: body.stream === true,
        }),
    });

    return gatewayChatCompletions(delegated);
}
