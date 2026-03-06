import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { streamWithReasoning } from "@/lib/scan/ai-client";
import { getScanPaywallForUser } from "@/lib/scan/entitlements";

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

type ConfidenceLevel = "High" | "Medium" | "Low";

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

function uniqueStrings(items: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
        const normalized = item.trim();
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        result.push(normalized);
    }

    return result;
}

function joinList(items: string[]): string {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function summarizeFixTarget(fix?: SuggestionFixInput | ManualGuidanceInput): string {
    if (!fix?.file) {
        return fix?.issueName || "security finding";
    }

    return `${fix.issueName || "security finding"} in ${fix.file}:${fix.line || 1}`;
}

function inferSuggestionConfidence(input: {
    selectedFixes: SuggestionFixInput[];
    manualGuidance: ManualGuidanceInput[];
}): { level: ConfidenceLevel; rationale: string } {
    const fileCount = new Set(
        input.selectedFixes
            .map((fix) => fix.file)
            .filter((file): file is string => typeof file === "string" && file.length > 0)
    ).size;

    let score = 0;
    if (input.selectedFixes.length >= 1) score += 1;
    if (input.selectedFixes.length >= 3) score += 1;
    if (fileCount >= 2) score += 1;
    if (input.manualGuidance.length === 0) score += 1;
    if (input.manualGuidance.length >= 3) score -= 1;

    if (score >= 3) {
        return {
            level: "High",
            rationale: "multiple file-specific fixes are selected and the manual review queue is limited",
        };
    }

    if (score >= 1) {
        return {
            level: "Medium",
            rationale: "the remediation plan is grounded in selected fixes but still depends on manual review",
        };
    }

    return {
        level: "Low",
        rationale: "the plan depends heavily on manual validation or has too little selected fix coverage",
    };
}

function buildSuggestionFinalAnalysisStep(input: {
    initialConfidence: ConfidenceLevel;
    selectedFixes: SuggestionFixInput[];
    manualGuidance: ManualGuidanceInput[];
    usedFallback: boolean;
}): string {
    const finalConfidence: ConfidenceLevel = input.usedFallback
        ? "Low"
        : input.manualGuidance.length >= 3
            ? "Medium"
            : input.selectedFixes.length > 0
                ? input.initialConfidence
                : "Low";

    const coverageTargets = uniqueStrings(
        input.selectedFixes
            .slice(0, 2)
            .map((fix) => summarizeFixTarget(fix))
    );
    const coverage = coverageTargets.length > 0
        ? ` for ${joinList(coverageTargets)}`
        : "";

    if (finalConfidence === input.initialConfidence) {
        return `Confidence holds at ${finalConfidence.toLowerCase()} for the remediation brief${coverage}`;
    }

    return `Confidence shifted from ${input.initialConfidence.toLowerCase()} to ${finalConfidence.toLowerCase()} for the remediation brief${coverage}`;
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

function buildSuggestionAnalysisPlan(input: {
    selectedFixes: SuggestionFixInput[];
    manualGuidance: ManualGuidanceInput[];
    repository: string;
    initialConfidence: { level: ConfidenceLevel; rationale: string };
}): string[] {
    const fileCount = new Set(
        input.selectedFixes
            .map((fix) => fix.file)
            .filter((file): file is string => typeof file === "string" && file.length > 0)
    ).size;
    const highlightedFixes = uniqueStrings(
        input.selectedFixes
            .slice(0, 2)
            .map((fix) => summarizeFixTarget(fix))
    );
    const highlightedManual = uniqueStrings(
        input.manualGuidance
            .slice(0, 2)
            .map((guidance) => summarizeFixTarget(guidance))
    );

    const steps = [
        `Reviewing ${input.selectedFixes.length} selected auto-fix candidate(s) in ${fileCount} file(s) for ${input.repository}`,
        highlightedFixes.length > 0
            ? `Focusing on ${joinList(highlightedFixes)}`
            : `Checking ${input.manualGuidance.length} manual-review finding(s) that still need human validation`,
        `Starting at ${input.initialConfidence.level.toLowerCase()} confidence because ${input.initialConfidence.rationale}`,
        highlightedManual.length > 0
            ? `Leaving manual validation for ${joinList(highlightedManual)}`
            : `Checking ${input.manualGuidance.length} manual-review finding(s) that still need human validation`,
    ];

    return steps.slice(0, 6);
}

const SYSTEM_PROMPT = `You are Cencori, a senior security engineer embedded in the codebase.
Be direct, practical, and opinionated. You can use light humor sparingly, but stay technical.
CRITICAL: You are an individual engineer, not an abstract AI. In your final response, use first-person singular pronouns ("I", "my", "me"). Never refer to yourself in the third person (e.g., "The assistant should", "The AI will") or plural ("we", "our").
NEVER use emojis — not in headings, bullet points, or anywhere else. Use plain text and markdown only.
Always provide remediation guidance grounded in the provided scan data.`;

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paywallResponse = await getScanPaywallForUser(user.id);
    if (paywallResponse) {
        return paywallResponse;
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
    const initialConfidence = inferSuggestionConfidence({
        selectedFixes,
        manualGuidance,
    });
    const analysisSteps = buildSuggestionAnalysisPlan({
        selectedFixes,
        manualGuidance,
        repository: project.github_repo_full_name,
        initialConfidence,
    });

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
                await streamWithReasoning(prompt, SYSTEM_PROMPT, controller, encoder, fallbackResponse, undefined, {
                    analysisSteps,
                    draftAnalysisStep: selectedFixes.length > 0
                        ? `Assembling the remediation brief around ${joinList(uniqueStrings(selectedFixes.slice(0, 2).map((fix) => summarizeFixTarget(fix))))}`
                        : "Assembling the remediation brief from the available scan findings",
                    firstContentAnalysisStep: manualGuidance.length > 0
                        ? `Balancing auto-fix recommendations against ${manualGuidance.length} manual validation item(s)`
                        : "Turning the selected findings into a merge-ready remediation brief",
                    buildFinalAnalysis: ({ usedFallback }) => [
                        buildSuggestionFinalAnalysisStep({
                            initialConfidence: initialConfidence.level,
                            selectedFixes,
                            manualGuidance,
                            usedFallback,
                        }),
                    ],
                });
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
