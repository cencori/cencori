import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { streamWithReasoning } from "@/lib/scan/ai-client";

// Allow up to 5 minutes for reasoning + content generation
export const maxDuration = 300;


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface SuggestionFixInput {
    file?: string;
    line?: number;
    issueType?: string;
    issueName?: string;
    severity?: string;
    strategy?: string;
    explanation?: string;
    selected?: boolean;
}

interface ManualGuidanceInput {
    issueName?: string;
    severity?: string;
    file?: string;
    line?: number;
    summary?: string;
    steps?: string[];
}

interface ScanIssueInput {
    type?: string;
    severity?: string;
    name?: string;
    file?: string;
    line?: number;
    description?: string;
}

function sanitizeFixes(value: unknown): SuggestionFixInput[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            const fix = (entry || {}) as SuggestionFixInput;
            return {
                file: typeof fix.file === "string" ? fix.file : undefined,
                line: typeof fix.line === "number" ? fix.line : undefined,
                issueType: typeof fix.issueType === "string" ? fix.issueType : undefined,
                issueName: typeof fix.issueName === "string" ? fix.issueName : undefined,
                severity: typeof fix.severity === "string" ? fix.severity : undefined,
                strategy: typeof fix.strategy === "string" ? fix.strategy : undefined,
                explanation: typeof fix.explanation === "string" ? fix.explanation : undefined,
                selected: typeof fix.selected === "boolean" ? fix.selected : true,
            };
        })
        .filter((fix) => typeof fix.file === "string" && typeof fix.issueName === "string")
        .slice(0, 200);
}

function sanitizeManualGuidance(value: unknown): ManualGuidanceInput[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            const guidance = (entry || {}) as ManualGuidanceInput;
            return {
                issueName: typeof guidance.issueName === "string" ? guidance.issueName : undefined,
                severity: typeof guidance.severity === "string" ? guidance.severity : undefined,
                file: typeof guidance.file === "string" ? guidance.file : undefined,
                line: typeof guidance.line === "number" ? guidance.line : undefined,
                summary: typeof guidance.summary === "string" ? guidance.summary : undefined,
                steps: Array.isArray(guidance.steps)
                    ? guidance.steps.filter((step): step is string => typeof step === "string").slice(0, 6)
                    : [],
            };
        })
        .filter((guidance) => typeof guidance.issueName === "string")
        .slice(0, 200);
}

function sanitizeIssues(value: unknown): ScanIssueInput[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => {
            const issue = (entry || {}) as ScanIssueInput;
            return {
                type: typeof issue.type === "string" ? issue.type : undefined,
                severity: typeof issue.severity === "string" ? issue.severity : undefined,
                name: typeof issue.name === "string" ? issue.name : undefined,
                file: typeof issue.file === "string" ? issue.file : undefined,
                line: typeof issue.line === "number" ? issue.line : undefined,
                description: typeof issue.description === "string" ? issue.description : undefined,
            };
        })
        .filter((issue) => typeof issue.name === "string" && typeof issue.file === "string")
        .slice(0, 240);
}

function buildFallbackSuggestions(input: {
    repository: string;
    issues: ScanIssueInput[];
    fixes: SuggestionFixInput[];
    manualGuidance: ManualGuidanceInput[];
}): string {
    const selectedFixes = input.fixes.filter((fix) => fix.selected !== false);
    const topFixes = selectedFixes.slice(0, 10);
    const topManual = input.manualGuidance.slice(0, 8);

    const lines: string[] = [];
    lines.push(`### Security remediation brief for \`${input.repository}\``);
    lines.push("");
    lines.push(`- Findings: ${input.issues.length}`);
    lines.push(`- Auto-fix candidates selected: ${selectedFixes.length}`);
    lines.push(`- Manual-review findings: ${input.manualGuidance.length}`);
    lines.push("");
    lines.push("#### Proposed auto-fix plan");
    if (topFixes.length === 0) {
        lines.push("- No safe auto-fixes selected yet.");
    } else {
        for (const fix of topFixes) {
            lines.push(
                `- \`${fix.file}:${fix.line || 0}\` ${fix.issueName} (${fix.severity || "unknown"}) -> ${fix.explanation || "apply secure default"}`
            );
        }
    }
    lines.push("");
    lines.push("#### Manual review priorities");
    if (topManual.length === 0) {
        lines.push("- No manual-only findings detected.");
    } else {
        for (const guidance of topManual) {
            lines.push(
                `- \`${guidance.file}:${guidance.line || 0}\` ${guidance.issueName} (${guidance.severity || "unknown"}) -> ${guidance.summary || "needs security review"}`
            );
        }
    }
    lines.push("");
    lines.push("#### Before opening PR");
    lines.push("- Review every diff for behavioral regressions.");
    lines.push("- Run tests and static checks.");
    lines.push("- Validate secrets and auth constraints in changed paths.");
    return lines.join("\n");
}

const SYSTEM_PROMPT = `You are Cencori, a senior security engineer embedded in the codebase.
Be direct, practical, and opinionated. You can use light humor sparingly, but stay technical.
Always provide remediation guidance grounded in the provided scan data.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const scanRunId = typeof body.scanRunId === "string" ? body.scanRunId : "";
    if (!scanRunId) {
        return NextResponse.json({ error: "scanRunId is required" }, { status: 400 });
    }
    if (!isValidUUID(scanRunId)) {
        return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const fixes = sanitizeFixes(body.fixes);
    const manualGuidance = sanitizeManualGuidance(body.manualGuidance);

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from("scan_projects")
        .select("id, github_repo_full_name")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: scanRun, error: scanRunError } = await supabaseAdmin
        .from("scan_runs")
        .select("id, results")
        .eq("id", scanRunId)
        .eq("project_id", id)
        .single();

    if (scanRunError || !scanRun) {
        return NextResponse.json({ error: "Scan run not found" }, { status: 404 });
    }

    const issues = sanitizeIssues((scanRun.results as { issues?: unknown })?.issues);
    const repositoryAiSummary = typeof (scanRun.results as { ai?: { summary?: unknown } })?.ai?.summary === "string"
        ? (scanRun.results as { ai: { summary: string } }).ai.summary
        : "";

    const fallbackResponse = buildFallbackSuggestions({
        repository: project.github_repo_full_name,
        issues,
        fixes,
        manualGuidance,
    });

    const selectedFixes = fixes.filter((fix) => fix.selected !== false);

    const prompt = `Repository: ${project.github_repo_full_name}

Repository AI scan summary:
${repositoryAiSummary || "n/a"}

Detected issues (${issues.length}):
${JSON.stringify(issues.slice(0, 120), null, 2)}

Selected auto-fix candidates (${selectedFixes.length}):
${JSON.stringify(selectedFixes.slice(0, 120), null, 2)}

Manual-review findings (${manualGuidance.length}):
${JSON.stringify(manualGuidance.slice(0, 120), null, 2)}

Produce a markdown remediation brief with this structure:
1) Executive Summary
2) Auto-Fix Plan (group by file, include exact code-level intent)
3) Manual Review Queue
4) PR Readiness Checklist
5) Post-merge Validation

Constraints:
- Assume user will review diffs before opening PR.
- Mention branch-based PR workflow.
- Be concrete and specific to files/lines where possible.
- Keep it concise but complete.`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const sendData = (payload: string) => {
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            };

            try {
                await streamWithReasoning(prompt, SYSTEM_PROMPT, controller, encoder, fallbackResponse);
            } catch (error) {
                console.error("[Fix Suggestions] Stream failed:", error);
                sendData(JSON.stringify({ type: "content", content: fallbackResponse }));
                sendData("[DONE]");
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
