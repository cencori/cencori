import { NextRequest } from "next/server";
import { getInstallationOctokit } from "@/lib/github";
import { createServerClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { streamWithReasoning } from "@/lib/scan/ai-client";
import { getScanPaywallForUser } from "@/lib/scan/entitlements";
import { verifyProjectGithubAccess } from "@/lib/scan/github-access";
import { isScanStrictEnforcementEnabled } from "@/lib/scan/policy";
import { ScanMemoryError, getContinuityMemoryContext, searchMemory, writeMemory } from "@/lib/scan/scan-memory";
import { rateLimitOrNull, SCAN_RATE_LIMITS } from "@/lib/scan/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_ITEMS = 8;
const SNIPPET_RADIUS = 4;
const MAX_SNIPPET_CHARS = 1400;

function isValidUUID(value: string): boolean {
    return UUID_RE.test(value);
}

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

interface InteractionHotspotLike {
    file?: string;
    riskScore?: number;
    reason?: string;
}

interface DataFlowTraceLike {
    file?: string;
    line?: number;
    severity?: string;
    summary?: string;
}

interface ScanResearchLike {
    filesIndexed?: number;
    projectBrief?: {
        summary?: string;
        appPurpose?: string;
        authModel?: string;
        deploymentShape?: string;
        trustBoundaries?: string[];
        sensitiveFlows?: string[];
        criticalModules?: string[];
        externalServices?: string[];
        confidence?: number;
    };
    interactionMap?: {
        nodes?: unknown[];
        edges?: unknown[];
        hotspots?: InteractionHotspotLike[];
    };
    dataFlows?: {
        traces?: DataFlowTraceLike[];
    };
}

interface RepositoryAiContextLike {
    summary?: string;
    architectureFindings?: string[];
    riskThemes?: string[];
    priorityFiles?: string[];
    suggestedChecks?: string[];
}

interface ScanRunResultsLike {
    issues?: IssueContext[];
    ai?: {
        summary?: string;
    };
    research?: ScanResearchLike;
    ai_context?: RepositoryAiContextLike;
}

interface EvidenceCandidate {
    file: string;
    line: number;
    reason: string;
}

interface CodeEvidence {
    id: string;
    file: string;
    startLine: number;
    endLine: number;
    reason: string;
    source: "github" | "scan";
    excerpt: string;
}

type ConfidenceLevel = "High" | "Medium" | "Low";

function shortText(value: string, maxLength: number): string {
    const normalized = value.trim();
    if (!normalized) return "";
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
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

function summarizeIssueTarget(issue?: IssueContext): string {
    if (!issue?.file) {
        return issue?.name || issue?.type || "the latest repository findings";
    }

    const title = issue.name || issue.type || "selected finding";
    return `${title} in ${issue.file}:${toSafeLine(issue.line)}`;
}

function summarizeEvidenceTargets(evidence: CodeEvidence[]): string {
    const targets = uniqueStrings(
        evidence
            .slice(0, 3)
            .map((entry) => `${entry.id} ${entry.file}:${entry.startLine}-${entry.endLine}`)
    );

    return targets.length > 0 ? joinList(targets) : "the available repository evidence";
}

function inferChatConfidence(input: {
    issue?: IssueContext;
    relatedIssues: IssueContext[];
    evidence: CodeEvidence[];
    hasMemoryContext: boolean;
    hasGraphContext: boolean;
}): { level: ConfidenceLevel; rationale: string } {
    let score = 0;

    if (input.issue?.file) score += 1;
    if (input.relatedIssues.length > 0) score += 1;
    if (input.evidence.length >= 2) score += 1;
    if (input.evidence.length >= 4) score += 1;
    if (input.hasMemoryContext) score += 1;
    if (input.hasGraphContext) score += 1;
    if (input.evidence.length === 0) score -= 2;

    if (score >= 5) {
        return {
            level: "High",
            rationale: "multiple code excerpts, related findings, and repository context are available",
        };
    }

    if (score >= 2) {
        return {
            level: "Medium",
            rationale: "the answer is grounded in partial code evidence and repository context",
        };
    }

    return {
        level: "Low",
        rationale: "the available evidence is thin or incomplete for a full verification pass",
    };
}

function buildChatFinalAnalysisStep(input: {
    initialConfidence: ConfidenceLevel;
    issue?: IssueContext;
    evidence: CodeEvidence[];
    response: string;
}): string {
    const target = summarizeIssueTarget(input.issue);
    const citedEvidence = uniqueStrings(
        Array.from(input.response.matchAll(/\[(E\d+)\]/g)).map((match) => match[1])
    ).slice(0, 3);
    const evidenceSummary = citedEvidence.length > 0
        ? ` using ${joinList(citedEvidence)}`
        : input.evidence.length > 0
            ? ` using ${joinList(input.evidence.slice(0, 2).map((entry) => entry.id))}`
            : "";

    return `Answer drafted at ${input.initialConfidence.toLowerCase()} confidence for ${target}${evidenceSummary}`;
}

function toSafeLine(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    return Math.max(1, Math.floor(value));
}

function isLikelyBinary(value: string): boolean {
    return /[\u0000-\u0008\u000E-\u001A]/.test(value);
}

function isCasualQuestion(question: string): boolean {
    const normalized = question.toLowerCase().trim();
    if (!normalized) return false;
    const simpleGreeting = /^(hey|hi|hello|sup|yo|howdy|hiya|thanks|thank you|nice|cool)[\s!?.]*$/.test(normalized);
    if (simpleGreeting) return true;
    const words = normalized.split(/\s+/g).length;
    return words <= 3 && !/[/?]/.test(normalized);
}

function renderSnippetWindow(content: string, focusLine: number): { startLine: number; endLine: number; excerpt: string } {
    const lines = content.split("\n");
    if (lines.length === 0) {
        return { startLine: 1, endLine: 1, excerpt: "" };
    }

    const line = Math.max(1, Math.min(focusLine, lines.length));
    const startLine = Math.max(1, line - SNIPPET_RADIUS);
    const endLine = Math.min(lines.length, line + SNIPPET_RADIUS);
    const excerpt = lines
        .slice(startLine - 1, endLine)
        .map((entry, index) => `${startLine + index}: ${entry}`)
        .join("\n");

    const clipped = excerpt.length > MAX_SNIPPET_CHARS
        ? `${excerpt.slice(0, MAX_SNIPPET_CHARS)}\n... [truncated]`
        : excerpt;

    return { startLine, endLine, excerpt: clipped };
}

function buildGraphContextSection(
    repository: string,
    research?: ScanResearchLike,
    aiContext?: RepositoryAiContextLike,
    aiSummary?: string
): string {
    const lines: string[] = [];
    lines.push(`Repository: ${repository}`);

    if (research?.projectBrief?.summary) {
        lines.push(`Project brief: ${shortText(research.projectBrief.summary, 320)}`);
    }
    if (research?.projectBrief?.authModel) {
        lines.push(`Auth model: ${shortText(research.projectBrief.authModel, 220)}`);
    }
    if (research?.projectBrief?.deploymentShape) {
        lines.push(`Deployment shape: ${shortText(research.projectBrief.deploymentShape, 220)}`);
    }
    if (Array.isArray(research?.projectBrief?.trustBoundaries) && research.projectBrief.trustBoundaries.length > 0) {
        lines.push(`Trust boundaries: ${research.projectBrief.trustBoundaries.slice(0, 3).map((item) => shortText(item, 120)).join(" | ")}`);
    }
    if (Array.isArray(research?.projectBrief?.sensitiveFlows) && research.projectBrief.sensitiveFlows.length > 0) {
        lines.push(`Sensitive flows: ${research.projectBrief.sensitiveFlows.slice(0, 3).map((item) => shortText(item, 120)).join(" | ")}`);
    }

    if (aiSummary) {
        lines.push(`Repo AI summary: ${shortText(aiSummary, 300)}`);
    }
    if (aiContext?.summary) {
        lines.push(`Live context summary: ${shortText(aiContext.summary, 300)}`);
    }

    const indexed = research?.filesIndexed;
    const nodeCount = research?.interactionMap?.nodes?.length ?? 0;
    const edgeCount = research?.interactionMap?.edges?.length ?? 0;
    if (typeof indexed === "number") {
        lines.push(`Graph coverage: ${indexed} files indexed, ${nodeCount} nodes, ${edgeCount} edges`);
    }

    const hotspots = Array.isArray(research?.interactionMap?.hotspots)
        ? research?.interactionMap?.hotspots.slice(0, 4)
        : [];
    if (hotspots.length > 0) {
        lines.push("Hotspots:");
        for (const hotspot of hotspots) {
            lines.push(
                `- ${hotspot.file || "unknown"} (risk ${hotspot.riskScore ?? "?"}): ${shortText(hotspot.reason || "n/a", 160)}`
            );
        }
    }

    const traces = Array.isArray(research?.dataFlows?.traces)
        ? research?.dataFlows?.traces.slice(0, 4)
        : [];
    if (traces.length > 0) {
        lines.push("Data-flow traces:");
        for (const trace of traces) {
            lines.push(
                `- ${trace.severity || "unknown"} at ${trace.file || "unknown"}:${trace.line || 1} - ${shortText(trace.summary || "n/a", 180)}`
            );
        }
    }

    const findings = Array.isArray(aiContext?.architectureFindings)
        ? aiContext?.architectureFindings.slice(0, 4)
        : [];
    if (findings.length > 0) {
        lines.push("Architecture findings:");
        for (const finding of findings) {
            lines.push(`- ${shortText(finding, 180)}`);
        }
    }

    const themes = Array.isArray(aiContext?.riskThemes)
        ? aiContext?.riskThemes.slice(0, 4)
        : [];
    if (themes.length > 0) {
        lines.push("Risk themes:");
        for (const theme of themes) {
            lines.push(`- ${shortText(theme, 160)}`);
        }
    }

    return lines.join("\n");
}

function buildEvidenceCandidates(input: {
    issue?: IssueContext;
    relatedIssues: IssueContext[];
    research?: ScanResearchLike;
    aiContext?: RepositoryAiContextLike;
}): EvidenceCandidate[] {
    const candidates: EvidenceCandidate[] = [];
    const seen = new Set<string>();

    const pushCandidate = (file?: string, line?: number, reason?: string) => {
        const normalizedFile = typeof file === "string" ? file.trim() : "";
        if (!normalizedFile) return;
        const safeLine = toSafeLine(line);
        const safeReason = reason?.trim() || "code context";
        const key = `${normalizedFile}:${safeLine}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ file: normalizedFile, line: safeLine, reason: safeReason });
    };

    if (input.issue?.file) {
        pushCandidate(
            input.issue.file,
            input.issue.line,
            `selected issue: ${input.issue.name || input.issue.type || "issue"}`
        );
    }

    for (const related of input.relatedIssues.slice(0, 4)) {
        pushCandidate(
            related.file,
            related.line,
            `related issue: ${related.name || related.type || "issue"}`
        );
    }

    const hotspots = Array.isArray(input.research?.interactionMap?.hotspots)
        ? input.research?.interactionMap?.hotspots.slice(0, 3)
        : [];
    for (const hotspot of hotspots) {
        pushCandidate(hotspot.file, 1, `architecture hotspot: ${hotspot.reason || "high risk coupling"}`);
    }

    const traces = Array.isArray(input.research?.dataFlows?.traces)
        ? input.research?.dataFlows?.traces.slice(0, 3)
        : [];
    for (const trace of traces) {
        pushCandidate(trace.file, trace.line, `data flow trace: ${trace.summary || trace.severity || "runtime flow risk"}`);
    }

    const priorityFiles = Array.isArray(input.aiContext?.priorityFiles)
        ? input.aiContext?.priorityFiles.slice(0, 3)
        : [];
    for (const priorityFile of priorityFiles) {
        pushCandidate(priorityFile, 1, "AI-prioritized architecture file");
    }

    return candidates.slice(0, MAX_EVIDENCE_FILES);
}

async function fetchCodeEvidenceFromGithub(input: {
    user: {
        id: string;
        identities?: Array<{
            provider?: string;
            identity_data?: {
                user_name?: string;
                preferred_username?: string;
            } | null;
        }> | null;
    };
    project: {
        github_installation_id: unknown;
        github_repo_id: unknown;
    };
    candidates: EvidenceCandidate[];
}): Promise<CodeEvidence[]> {
    const githubAccess = await verifyProjectGithubAccess(input.user, input.project);
    if (!githubAccess) {
        return [];
    }

    const [owner, repo] = githubAccess.repository.fullName.split("/");
    if (!owner || !repo) {
        return [];
    }

    const octokit = await getInstallationOctokit(githubAccess.installationId);
    const evidence: CodeEvidence[] = [];

    for (const candidate of input.candidates) {
        try {
            const { data } = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
                owner,
                repo,
                path: candidate.file,
                ref: "HEAD",
            });

            if (Array.isArray(data)) {
                continue;
            }

            const payload = data as { content?: string; encoding?: string };
            if (typeof payload.content !== "string") {
                continue;
            }

            const decoded = payload.encoding === "base64"
                ? Buffer.from(payload.content, "base64").toString("utf-8")
                : payload.content;
            if (!decoded || isLikelyBinary(decoded)) {
                continue;
            }

            const window = renderSnippetWindow(decoded, candidate.line);
            if (!window.excerpt.trim()) {
                continue;
            }

            evidence.push({
                id: "",
                file: candidate.file,
                startLine: window.startLine,
                endLine: window.endLine,
                reason: shortText(candidate.reason, 120),
                source: "github",
                excerpt: window.excerpt,
            });
        } catch (error) {
            console.warn(
                `[Fix Chat] Failed to fetch snippet for ${candidate.file}:`,
                error instanceof Error ? error.message : error
            );
        }
    }

    return evidence;
}

function buildFallbackEvidence(issue?: IssueContext, relatedIssues: IssueContext[] = []): CodeEvidence[] {
    const evidence: CodeEvidence[] = [];

    if (issue?.file && issue.match) {
        evidence.push({
            id: "",
            file: issue.file,
            startLine: toSafeLine(issue.line),
            endLine: toSafeLine(issue.line),
            reason: `selected issue: ${issue.name || issue.type || "issue"}`,
            source: "scan",
            excerpt: `${toSafeLine(issue.line)}: ${shortText(issue.match, 220)}`,
        });
    }

    for (const related of relatedIssues.slice(0, 3)) {
        if (!related.file || !related.match) continue;
        evidence.push({
            id: "",
            file: related.file,
            startLine: toSafeLine(related.line),
            endLine: toSafeLine(related.line),
            reason: `related issue: ${related.name || related.type || "issue"}`,
            source: "scan",
            excerpt: `${toSafeLine(related.line)}: ${shortText(related.match, 220)}`,
        });
    }

    return evidence;
}

function assignEvidenceIds(items: CodeEvidence[]): CodeEvidence[] {
    return items.slice(0, MAX_EVIDENCE_ITEMS).map((item, index) => ({
        ...item,
        id: `E${index + 1}`,
    }));
}

function formatEvidenceForPrompt(evidence: CodeEvidence[]): string {
    if (evidence.length === 0) {
        return "No code evidence was collected for this request.";
    }

    return evidence
        .map((entry) => (
            `[${entry.id}] ${entry.file}:${entry.startLine}-${entry.endLine} | ${entry.reason} | source=${entry.source}\n${entry.excerpt}`
        ))
        .join("\n\n");
}

function formatRelatedIssues(relatedIssues: IssueContext[]): string {
    if (relatedIssues.length === 0) return "";
    return relatedIssues
        .slice(0, 8)
        .map((item) => (
            `- ${item.name || "unknown"} (${item.severity || "unknown"}) at ${item.file || "unknown"}:${toSafeLine(item.line)}`
        ))
        .join("\n");
}

function buildChatAnalysisPlan(input: {
    issue?: IssueContext;
    relatedIssues: IssueContext[];
    evidence: CodeEvidence[];
    hasMemoryContext: boolean;
    hasGraphContext: boolean;
    initialConfidence: { level: ConfidenceLevel; rationale: string };
}): string[] {
    const steps: string[] = [];

    if (input.issue?.file) {
        steps.push(`Reviewing ${summarizeIssueTarget(input.issue)}`);
    } else {
        steps.push("Reviewing the latest repository security context for this question");
    }

    if (input.evidence.length > 0) {
        steps.push(`Inspecting code evidence: ${summarizeEvidenceTargets(input.evidence)}`);
    }

    steps.push(
        `Starting at ${input.initialConfidence.level.toLowerCase()} confidence because ${input.initialConfidence.rationale}`
    );

    if (input.relatedIssues.length > 0) {
        const relatedTargets = uniqueStrings(
            input.relatedIssues
                .slice(0, 2)
                .map((related) => summarizeIssueTarget(related))
        );
        steps.push(
            relatedTargets.length > 0
                ? `Checking related findings: ${joinList(relatedTargets)}`
                : `Checking ${input.relatedIssues.length} related finding(s) in the same code path`
        );
    }

    if (input.hasMemoryContext) {
        steps.push("Comparing the current question against prior scan memory");
    }

    if (input.hasGraphContext) {
        steps.push("Using repository graph and data-flow context to judge impact");
    }

    return steps.slice(0, 6);
}

function buildFallbackAnswer(input: {
    question: string;
    issue?: IssueContext;
    fix?: FixContext;
    evidence: CodeEvidence[];
    technicalMode: boolean;
}): string {
    if (isCasualQuestion(input.question)) {
        return "Hey! I am Cencori. Ask me anything about your findings or what to fix next.";
    }

    const answer = input.issue?.name
        ? `I am looking at **${input.issue.name}** in \`${input.issue.file || "unknown"}${input.issue.line ? `:${input.issue.line}` : ""}\`. ${input.issue.description || ""}`.trim()
        : "I can help you reason through your scan findings, architecture risks, and fix strategy.";

    const fixLine = input.fix?.explanation
        ? `\n\nSuggested fix direction: ${input.fix.explanation}`
        : "";

    const evidenceLine = input.evidence.length > 0
        ? `\n\nI am grounding this in \`${input.evidence[0].file}:${input.evidence[0].startLine}-${input.evidence[0].endLine}\` [${input.evidence[0].id}].`
        : "";

    const followUp = input.issue?.file
        ? ""
        : "\n\nIf you want a sharper answer, point me to the exact file or function and I will inspect it next.";

    if (!input.technicalMode) {
        return `${answer}${fixLine}`;
    }

    return `${answer}${fixLine}${evidenceLine}${followUp}`;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();
    const strictEnforcement = isScanStrictEnforcementEnabled();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const paywallResponse = await getScanPaywallForUser(user.id);
    if (paywallResponse) {
        return paywallResponse;
    }

    const rateLimitResponse = rateLimitOrNull(user.id, 'scan:chat', SCAN_RATE_LIMITS.chat);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from("scan_projects")
        .select("id, github_repo_full_name, github_installation_id, github_repo_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (projectError || !project) {
        return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const rawQuestion = typeof body.question === "string" ? body.question : "";
    const question = rawQuestion.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "").trim();
    const scanRunId = typeof body.scanRunId === "string" ? body.scanRunId : undefined;
    const issue = (body.issue || {}) as IssueContext;
    const fix = (body.fix || {}) as FixContext;
    const history = Array.isArray(body.history) ? (body.history as ChatMessage[]) : [];
    const technicalMode = !isCasualQuestion(question);

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
    let researchContext: ScanResearchLike | undefined;
    let aiContext: RepositoryAiContextLike | undefined;
    let evidence: CodeEvidence[] = [];

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
            .filter((item) => item.file === issue.file && !(item.line === issue.line && item.name === issue.name))
            .slice(0, 8);

        aiSummary = typeof results.ai?.summary === "string" ? results.ai.summary : undefined;
        researchContext = results.research;
        aiContext = results.ai_context;

        const candidates = buildEvidenceCandidates({
            issue,
            relatedIssues,
            research: researchContext,
            aiContext,
        });
        if (candidates.length > 0) {
            try {
                evidence = await fetchCodeEvidenceFromGithub({
                    user,
                    project,
                    candidates,
                });
            } catch (error) {
                console.warn(
                    "[Fix Chat] Unable to collect GitHub evidence snippets:",
                    error instanceof Error ? error.message : error
                );
            }
        }
    }

    if (evidence.length === 0) {
        evidence = buildFallbackEvidence(issue, relatedIssues);
    }
    evidence = assignEvidenceIds(evidence);

    let continuityContext = "";
    let memoryContext = "";
    try {
        continuityContext = await getContinuityMemoryContext(id, user.id, supabaseAdmin, { enforce: strictEnforcement });
    } catch (err) {
        const details = err instanceof Error ? err.message : "Unknown continuity retrieval error";
        console.error("[Fix Chat] Continuity memory retrieval failed:", details);
        if (strictEnforcement) {
            const code = err instanceof ScanMemoryError ? err.code : "search_failed";
            return new Response(JSON.stringify({
                error: "Continuity memory retrieval failed",
                code,
                details,
            }), { status: 503 });
        }
    }
    try {
        memoryContext = await searchMemory(id, user.id, question, supabaseAdmin, { enforce: strictEnforcement });
    } catch (err) {
        const details = err instanceof Error ? err.message : "Unknown memory retrieval error";
        console.error("[Fix Chat] RAG memory retrieval failed:", details);
        if (strictEnforcement) {
            const code = err instanceof ScanMemoryError ? err.code : "search_failed";
            return new Response(
                JSON.stringify({
                    error: "RAG memory retrieval failed",
                    code,
                    details,
                }),
                { status: 503, headers: { "Content-Type": "application/json" } }
            );
        }
    }

    const recentHistory = history
        .slice(-8)
        .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
        .join("\n");

    const relatedIssueContext = formatRelatedIssues(relatedIssues);
    const hasIssueContext = Boolean(issue.name || issue.file || issue.type);
    const issueSection = hasIssueContext ? `
Currently selected issue:
- Name: ${issue.name || "unknown"}
- Type: ${issue.type || "unknown"}
- Severity: ${issue.severity || "unknown"}
- Location: ${issue.file || "unknown"}:${toSafeLine(issue.line)}
- Description: ${issue.description || "n/a"}
- Match excerpt: ${issue.match || "n/a"}${relatedIssueContext ? `\n- Related issues in same file:\n${relatedIssueContext}` : ""}${fix.explanation ? `\n- Proposed fix: ${fix.explanation}` : ""}` : "";

    const memorySection = [
        continuityContext
            ? `## Long-term project continuity\n${continuityContext}`
            : "",
        memoryContext
            ? `## Relevant context from this project's history\n${memoryContext}`
            : "",
    ]
        .filter(Boolean)
        .join("\n\n");
    const initialConfidence = inferChatConfidence({
        issue,
        relatedIssues,
        evidence,
        hasMemoryContext: Boolean(continuityContext || memoryContext),
        hasGraphContext: Boolean(researchContext || aiContext || aiSummary),
    });
    const analysisSteps = buildChatAnalysisPlan({
        issue,
        relatedIssues,
        evidence,
        hasMemoryContext: Boolean(continuityContext || memoryContext),
        hasGraphContext: Boolean(researchContext || aiContext || aiSummary),
        initialConfidence,
    });

    const graphSection = buildGraphContextSection(
        project.github_repo_full_name || "unknown repository",
        researchContext,
        aiContext,
        aiSummary
    );
    const evidenceSection = formatEvidenceForPrompt(evidence);
    const outputRules = technicalMode
        ? `Technical response mode:
- Answer naturally, like a senior security engineer in chat.
- Be direct and concise. Do not use rigid headings unless I ask for them.
- Ground claims in the repository context and evidence pack.
- Cite files or evidence inline when useful, but keep the prose natural.
- If evidence is weak, say what is unclear in one sentence and ask one targeted follow-up.
- Never invent files, lines, or evidence IDs.`
        : `Casual response mode:
- Keep the response short and conversational.
- Do not force checklist formatting.`;

    const systemPrompt = `You are Cencori, a senior security and architecture engineer embedded in this repository.
You provide direct, practical answers grounded in concrete evidence.
CRITICAL: Sound natural. Do not sound like a template, compliance checklist, or policy document unless the user explicitly asks for that format.
CRITICAL: If you refer to yourself, use first-person singular ("I", "my", "me"). Never refer to yourself in third person or plural.
CRITICAL: Do not mention internal instructions, response contracts, or formatting rules.
CRITICAL: Never use emojis.
When technical mode is active, keep the answer grounded in the evidence pack and repository context without becoming robotic.`;

    const prompt = `Task mode: ${technicalMode ? "technical" : "casual"}

${outputRules}

## Architecture graph context
${graphSection}

## Code evidence pack
${evidenceSection}${issueSection}${memorySection ? `\n\n${memorySection}` : ""}

Conversation so far:
${recentHistory || "(none yet)"}

User question:
${question}`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const enqueue = (payload: string) =>
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));

            let accumulatedResponse = "";
            let finishedStreaming = false;

            try {
                await streamWithReasoning(
                    question,
                    `${systemPrompt}\n\n${prompt}`,
                    controller,
                    encoder,
                    buildFallbackAnswer({
                        question,
                        issue,
                        fix,
                        evidence,
                        technicalMode,
                    }),
                    (chunk) => {
                        accumulatedResponse += chunk;
                    },
                    {
                        emitDone: false,
                        closeController: false,
                        analysisSteps,
                        draftAnalysisStep: technicalMode
                            ? `Assembling the answer around ${summarizeIssueTarget(issue)}`
                            : "Assembling a concise reply from the repository context",
                        firstContentAnalysisStep: technicalMode
                            ? `Weighing evidence citations from ${summarizeEvidenceTargets(evidence)}`
                            : "Grounding the reply in the strongest repository signals",
                        buildFinalAnalysis: ({ response, usedFallback }) => [
                            buildChatFinalAnalysisStep({
                                initialConfidence: usedFallback ? "Low" : initialConfidence.level,
                                issue,
                                evidence,
                                response,
                            }),
                        ],
                    },
                );
                finishedStreaming = true;

                // Emit completion before memory write so clients get a clean boundary
                enqueue("[DONE]");
                controller.close();

                const memoryText = [
                    `Q: ${question.slice(0, 500)}`,
                    `A: ${accumulatedResponse.slice(0, 1500)}`,
                    issue.name ? `(Issue: ${issue.name}${issue.file ? ` in ${issue.file}` : ""})` : "",
                    evidence.length > 0
                        ? `Evidence: ${evidence.slice(0, 3).map((item) => `${item.id}:${item.file}:${item.startLine}`).join(", ")}`
                        : "",
                ].filter(Boolean).join("\n");

                writeMemory(id, user.id, memoryText, "chat", supabaseAdmin, scanRunId, {
                    enforce: false,
                }).catch((memErr) => {
                    console.warn("[Fix Chat] Post-stream memory write failed:", memErr instanceof Error ? memErr.message : memErr);
                });
            } catch (error) {
                console.error("[Fix Chat] Streaming or memory persistence failed:", error);
                if (!finishedStreaming) {
                    enqueue(JSON.stringify({
                        type: "content",
                        content: buildFallbackAnswer({
                            question,
                            issue,
                            fix,
                            evidence,
                            technicalMode,
                        }),
                    }));
                    enqueue("[DONE]");
                    controller.close();
                } else {
                    const code = error instanceof ScanMemoryError ? error.code : "stream_failed";
                    const details = error instanceof Error ? error.message : "Unknown error";
                    const message = `RAG memory persistence failed (${code}): ${details}`.slice(0, 500);
                    try {
                        enqueue(JSON.stringify({
                            type: "error",
                            message,
                        }));
                        enqueue("[DONE]");
                        controller.close();
                    } catch {
                        // Stream may already be closed; nothing else to do.
                    }
                }
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
