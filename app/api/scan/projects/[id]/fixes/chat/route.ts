import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface IssueContext {
    type?: string;
    severity?: string;
    name?: string;
    file?: string;
    line?: number;
    match?: string;
    description?: string;
}

interface FixContext {
    explanation?: string;
    originalCode?: string;
    fixedCode?: string;
}

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

function buildFallbackAnswer(question: string, issue?: IssueContext, fix?: FixContext): string {
    const parts: string[] = [];

    if (issue?.name) {
        parts.push(`Issue: ${issue.name} (${issue.severity || "unknown severity"}) in ${issue.file || "unknown file"}${issue.line ? `:${issue.line}` : ""}.`);
    }

    if (issue?.description) {
        parts.push(`What this means: ${issue.description}`);
    }

    if (fix?.explanation) {
        parts.push(`Suggested fix rationale: ${fix.explanation}`);
    }

    parts.push("Recommended next steps:");
    parts.push("1. Validate user-controlled inputs at entry points.");
    parts.push("2. Apply context-appropriate escaping/parameterization before sinks.");
    parts.push("3. Add regression tests for the exploit path and expected safe behavior.");
    parts.push(`Question received: "${question}"`);

    return parts.join("\n\n");
}

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from("scan_projects")
        .select("id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const scanRunId = typeof body.scanRunId === "string" ? body.scanRunId : undefined;
    const issue = (body.issue || {}) as IssueContext;
    const fix = (body.fix || {}) as FixContext;
    const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];

    if (!question) {
        return NextResponse.json({ error: "question is required" }, { status: 400 });
    }

    if (question.length > 2000) {
        return NextResponse.json({ error: "question is too long (max 2000 chars)" }, { status: 400 });
    }

    if (scanRunId) {
        const { data: scanRun } = await supabaseAdmin
            .from("scan_runs")
            .select("id")
            .eq("id", scanRunId)
            .eq("project_id", id)
            .single();

        if (!scanRun) {
            return NextResponse.json({ error: "Scan run not found" }, { status: 404 });
        }
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ answer: buildFallbackAnswer(question, issue, fix), source: "fallback" });
    }

    try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const recentHistory = history.slice(-8).map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n");

        const prompt = `You are Cencori Security Research Assistant.
Answer the user's question with practical, code-focused guidance.
Prefer short concrete recommendations, mention likely root cause and safe remediation.

Issue context:
- Name: ${issue.name || "unknown"}
- Type: ${issue.type || "unknown"}
- Severity: ${issue.severity || "unknown"}
- Location: ${issue.file || "unknown"}${issue.line ? `:${issue.line}` : ""}
- Detector description: ${issue.description || "n/a"}
- Match excerpt: ${issue.match || "n/a"}

Proposed fix context:
- Explanation: ${fix.explanation || "n/a"}

Conversation history:
${recentHistory || "n/a"}

User question:
${question}

Respond in plain text with:
1) concise answer
2) why this matters
3) what to do next`;

        const result = await model.generateContent(prompt);
        const answer = result.response.text().trim();

        return NextResponse.json({
            answer: answer || buildFallbackAnswer(question, issue, fix),
            source: "ai",
        });
    } catch (error) {
        console.error("[Fix Chat] AI chat failed:", error);
        return NextResponse.json({ answer: buildFallbackAnswer(question, issue, fix), source: "fallback" });
    }
}

