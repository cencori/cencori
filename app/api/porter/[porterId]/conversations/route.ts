import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

/**
 * What people have asked a Porter.
 *
 * There is no conversations table and there does not need to be one yet: every turn already exists
 * as an ai_requests row, with the question in request_payload, the answer in response_payload, and
 * the timing and status alongside. One Porter per project means project_id identifies the Porter.
 *
 * What that costs is threading -- each row is a question and its answer, not a conversation -- and
 * an identity for the visitor beyond the address they came from. Neither is needed to answer the
 * thing a customer opens this to find out, which is what people are asking and whether the Porter
 * could answer. When escalation or real threading needs more, that is the moment to add a table.
 */

type Turn = {
    id: string;
    askedAt: string;
    question: string;
    answer: string;
    status: string;
    latencyMs: number | null;
    model: string | null;
    grounded: boolean;
};

/** The question is the last thing the visitor said; everything before it is prompt and passages. */
function lastUserMessage(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const messages = (payload as { messages?: unknown }).messages;
    if (!Array.isArray(messages)) return "";

    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message && typeof message === "object" && (message as { role?: string }).role === "user") {
            const content = (message as { content?: unknown }).content;
            if (typeof content === "string") return content;
        }
    }
    return "";
}

/** A grounded answer cites a page. Without one, the Porter was talking from its own description. */
function citesAPage(payload: unknown): boolean {
    if (!payload || typeof payload !== "object") return false;
    const messages = (payload as { messages?: unknown }).messages;
    if (!Array.isArray(messages)) return false;
    const system = messages.find(
        (m) => m && typeof m === "object" && (m as { role?: string }).role === "system"
    ) as { content?: unknown } | undefined;
    return typeof system?.content === "string" && system.content.includes("Pages from this website:");
}

function answerOf(payload: unknown): string {
    if (!payload || typeof payload !== "object") return "";
    const content = (payload as { content?: unknown }).content;
    return typeof content === "string" ? content : "";
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ porterId: string }> }
) {
    try {
        const { porterId } = await params;

        const session = await createServerClient();
        const { data: { user }, error: userError } = await session.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const admin = createAdminClient();

        const { data: porter } = await admin
            .from("porters")
            .select("id, organization_id, project_id")
            .eq("id", porterId)
            .maybeSingle();

        if (!porter) {
            return NextResponse.json({ error: "Porter not found." }, { status: 404 });
        }

        const { data: membership } = await admin
            .from("organization_members")
            .select("user_id")
            .eq("organization_id", porter.organization_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 25), 100);

        const { data: rows, error } = await admin
            .from("ai_requests")
            .select("id, created_at, request_payload, response_payload, status, latency_ms, model")
            .eq("project_id", porter.project_id)
            .order("created_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("[Porter conversations] query failed:", error.message);
            return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
        }

        const turns: Turn[] = (rows ?? [])
            .map((row) => ({
                id: row.id as string,
                askedAt: row.created_at as string,
                question: lastUserMessage(row.request_payload),
                answer: answerOf(row.response_payload),
                status: (row.status as string) ?? "unknown",
                latencyMs: (row.latency_ms as number | null) ?? null,
                model: (row.model as string | null) ?? null,
                grounded: citesAPage(row.request_payload),
            }))
            // A row with no question is something other than a Porter turn on the same project.
            .filter((turn) => turn.question);

        return NextResponse.json({ turns });
    } catch (error) {
        console.error("[Porter conversations] failed:", error);
        return NextResponse.json({ error: "Could not load conversations." }, { status: 500 });
    }
}
