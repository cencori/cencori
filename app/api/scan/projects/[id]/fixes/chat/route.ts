import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { streamWithReasoning } from "@/lib/scan/ai-client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

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
    const lc = question.toLowerCase().trim();
    const isGreeting = /^(hey|hi|hello|sup|yo|what'?s up|howdy|hiya)[\s!?.]*$/.test(lc);

    if (isGreeting) {
        return "Hey! I'm Cencori — your senior security engineer. Ask me anything about the findings, how to fix them, or anything else on your mind.";
    }

    const parts: string[] = [];

    if (issue?.name) {
        parts.push(`**${issue.name}** (${issue.severity || "unknown severity"}) in \`${issue.file || "unknown file"}${issue.line ? `:${issue.line}` : ""}\`.`);
    }

    if (issue?.description) {
        parts.push(issue.description);
    }

    if (fix?.explanation) {
        parts.push(`**Suggested fix:** ${fix.explanation}`);
    }

    if (parts.length === 0) {
        parts.push("I'm here to help with your security scan findings. What would you like to know?");
    }

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
    // Strip null bytes and ASCII control characters before processing
    const rawQuestion = typeof body.question === "string" ? body.question : "";
    const question = rawQuestion.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
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

    if (scanRunId && !isValidUUID(scanRunId)) {
        return new Response(JSON.stringify({ error: "Invalid ID format" }), { status: 400 });
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

    const recentHistory = history.slice(-8)
        .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n");

    const relatedIssueContext = relatedIssues.length > 0
        ? relatedIssues
            .map((si) => `- ${si.name || "unknown"} (${si.severity || "unknown"}) at ${si.file || "unknown"}:${si.line || 0}`)
            .join("\n")
        : "";

    const hasIssueContext = !!(issue.name || issue.file || issue.type);

    const issueSection = hasIssueContext ? `
Currently selected issue:
- Name: ${issue.name || "unknown"}
- Type: ${issue.type || "unknown"}
- Severity: ${issue.severity || "unknown"}
- Location: ${issue.file || "unknown"}${issue.line ? `:${issue.line}` : ""}
- Description: ${issue.description || "n/a"}
- Match excerpt: ${issue.match || "n/a"}${relatedIssueContext ? `\n- Related issues in same file:\n${relatedIssueContext}` : ""}${aiSummary ? `\n- Repo AI summary: ${aiSummary}` : ""}${fix.explanation ? `\n- Proposed fix: ${fix.explanation}` : ""}` : "";

    const prompt = `You are Cencori — a sharp, senior security engineer embedded in a code scanning product.

Your role is twofold:
1. Help users understand and remediate security vulnerabilities found in their code.
2. Have normal, helpful conversations — answer questions, explain concepts, or just chat.

Personality: confident, approachable, concise, occasionally witty. Read the room — if someone greets you or asks something casual, respond like a person, not a security lecture. If the question is technical, be precise and actionable.
CRITICAL: You are an individual engineer, not an abstract AI. During both your internal reasoning/thought process and your final response, you MUST use first-person singular pronouns ("I", "my", "me"). NEVER refer to yourself in the third person (e.g., "The assistant should", "The AI will").

For security questions:
- Lead with the most useful insight
- Be concrete and code-focused
- Use markdown when it helps readability (bold key terms, code blocks, short lists)
- Skip unnecessary preamble
- Include a code snippet only when it genuinely helps

CRITICAL AESTHETIC RULES:
- NEVER output a "Remediation Brief" or heavy checklist format in this chat unless explicitly asked.
- If the user says something simple (e.g., "PR merged", "thanks", "hello"), just reply naturally and conversationally. Do NOT launch into a multi-point plan or security review. Keep it brief.
- Match the user's length and energy. Short inputs get short, friendly outputs.${issueSection}

Conversation so far:
${recentHistory || "(none yet)"}

User: ${question}`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (payload: string) =>
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            try {
                await streamWithReasoning(
                    question,
                    prompt, // System prompt
                    controller,
                    encoder,
                    buildFallbackAnswer(question, issue, fix)
                );
            } catch (error) {
                console.error("[Fix Chat] All providers failed:", error);
                enqueue(JSON.stringify({ type: "content", content: buildFallbackAnswer(question, issue, fix) }));
                enqueue("[DONE]");
                controller.close();
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
