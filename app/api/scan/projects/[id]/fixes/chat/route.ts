import { NextRequest } from "next/server";
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

interface ScanRunResultsLike {
    issues?: IssueContext[];
    ai?: {
        summary?: string;
    };
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
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from("scan_projects")
        .select("id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (projectError || !project) {
        return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const scanRunId = typeof body.scanRunId === "string" ? body.scanRunId : undefined;
    const issue = (body.issue || {}) as IssueContext;
    const fix = (body.fix || {}) as FixContext;
    const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];

    if (!question) {
        return new Response(JSON.stringify({ error: "question is required" }), { status: 400 });
    }

    if (question.length > 2000) {
        return new Response(JSON.stringify({ error: "question is too long (max 2000 chars)" }), { status: 400 });
    }

    let relatedIssues: IssueContext[] = [];
    let aiSummary: string | undefined;

    if (scanRunId) {
        const { data: scanRun } = await supabaseAdmin
            .from("scan_runs")
            .select("id, results")
            .eq("id", scanRunId)
            .eq("project_id", id)
            .single();

        if (!scanRun) {
            return new Response(JSON.stringify({ error: "Scan run not found" }), { status: 404 });
        }

        const results = (scanRun.results || {}) as ScanRunResultsLike;
        const runIssues = Array.isArray(results.issues) ? results.issues : [];
        relatedIssues = runIssues
            .filter((scanIssue) => scanIssue.file === issue.file && !(scanIssue.line === issue.line && scanIssue.name === issue.name))
            .slice(0, 8);
        aiSummary = typeof results.ai?.summary === "string" ? results.ai.summary : undefined;
    }

    // Build prompt eagerly (pure string ops)
    const recentHistory = history.slice(-8)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const relatedIssueContext = relatedIssues.length > 0
        ? relatedIssues
            .map((si) => `- ${si.name || "unknown"} (${si.severity || "unknown"}) at ${si.file || "unknown"}:${si.line || 0}`)
            .join("\n")
        : "n/a";

    const prompt = `You are Cencori, a senior security engineer helping a teammate fix vulnerabilities.
Answer with practical, code-focused guidance and natural conversational tone.
Light humor is allowed when appropriate, but stay technical and precise.
Prefer short concrete recommendations, mention likely root cause and safe remediation.

Issue context:
- Name: ${issue.name || "unknown"}
- Type: ${issue.type || "unknown"}
- Severity: ${issue.severity || "unknown"}
- Location: ${issue.file || "unknown"}${issue.line ? `:${issue.line}` : ""}
- Detector description: ${issue.description || "n/a"}
- Match excerpt: ${issue.match || "n/a"}
- Related issues in file:
${relatedIssueContext}
- Repository AI summary: ${aiSummary || "n/a"}

Proposed fix context:
- Explanation: ${fix.explanation || "n/a"}

Conversation history:
${recentHistory || "n/a"}

User question:
${question}

Respond in plain text with:
1) concise answer
2) why this matters
3) what to do next
4) if useful, include a tiny patch sketch`;

    const encoder = new TextEncoder();
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (payload: string) =>
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            const sendFallback = () => {
                enqueue(JSON.stringify({ content: buildFallbackAnswer(question, issue, fix) }));
                enqueue("[DONE]");
                controller.close();
            };

            if (!apiKey) {
                sendFallback();
                return;
            }

            try {
                const { GoogleGenerativeAI } = await import("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

                const result = await model.generateContentStream(prompt);

                for await (const chunk of result.stream) {
                    const text = chunk.text();
                    if (text) {
                        enqueue(JSON.stringify({ content: text }));
                    }
                }

                enqueue("[DONE]");
                controller.close();
            } catch (error) {
                console.error("[Fix Chat] AI stream failed:", error);
                sendFallback();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
