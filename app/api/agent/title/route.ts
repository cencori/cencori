import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { safeProviderFetch } from "@/lib/security/outbound-url";
import { createServerClient } from "@/lib/supabaseServer";

// Names a Copilot conversation from its opening exchange. A small, fast,
// non-reasoning model: reasoning models spend a short budget thinking and
// return nothing. Runs through the Cencori gateway like Copilot itself.
const TITLE_MODEL = "gemini-2.5-flash-lite";
const GATEWAY_BASE_URL = process.env.CENCORI_GATEWAY_URL || "https://api.cencori.com/v1";

const SYSTEM_PROMPT =
    "Write a 2-5 word title for this chat. No quotes, no trailing punctuation, sentence case. Reply with the title only.";

type TitleMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const apiKey = process.env.CENCORI_COPILOT_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Not configured" }, { status: 503 });

    const body = (await request.json().catch(() => null)) as { messages?: TitleMessage[] } | null;
    // The opening exchange is enough to name it, and keeps the request tiny.
    const transcript = (body?.messages ?? [])
        .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .slice(0, 4)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 600)}`)
        .join("\n");
    if (!transcript) return NextResponse.json({ error: "No messages" }, { status: 400 });

    try {
        const gateway = new OpenAI({
            apiKey,
            baseURL: GATEWAY_BASE_URL,
            fetch: safeProviderFetch,
            timeout: 15_000,
            maxRetries: 0,
        });
        const completion = await gateway.chat.completions.create({
            model: TITLE_MODEL,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: transcript },
            ],
            max_tokens: 24,
            temperature: 0.2,
        });
        const title = (completion.choices[0]?.message?.content ?? "")
            .replace(/^["'\s]+|["'.\s]+$/g, "")
            .slice(0, 60);
        if (!title) return NextResponse.json({ error: "Empty title" }, { status: 502 });
        return NextResponse.json({ title });
    } catch (error) {
        console.error("[Cencori Agent] Title failed:", error);
        return NextResponse.json({ error: "Title failed" }, { status: 502 });
    }
}
