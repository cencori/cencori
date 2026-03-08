import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScanIssueLike, RepositoryResearch, ProjectBrief } from "./research";
import { writeMemory } from "./scan-memory";

const SEVERITY_WEIGHT: Record<ScanIssueLike["severity"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

interface ScanSummaryLike {
    secrets?: number;
    pii?: number;
    vulnerabilities?: number;
    codeQuality?: number;
}

interface PreviousScanRunRow {
    id: string;
    created_at: string;
    score: string | null;
    results?: {
        issues?: Array<{
            file?: string;
            severity?: ScanIssueLike["severity"];
            name?: string;
            type?: string;
            line?: number;
        }>;
    } | null;
}

function topIssues(issues: ScanIssueLike[], limit = 3): ScanIssueLike[] {
    return [...issues]
        .sort((a, b) => {
            const severityDelta = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
            if (severityDelta !== 0) return severityDelta;
            return a.file.localeCompare(b.file);
        })
        .slice(0, limit);
}

function issueSignature(issue: Pick<ScanIssueLike, "type" | "name" | "file">): string {
    return `${issue.type}:${issue.name}:${issue.file}`;
}

function summarizeIssue(issue: Pick<ScanIssueLike, "name" | "severity" | "file" | "line">): string {
    return `${issue.name} (${issue.severity}) in ${issue.file}:${issue.line}`;
}

function summarizeBriefList(values: string[], limit = 3): string {
    return values
        .slice(0, limit)
        .filter(Boolean)
        .join(" | ");
}

export function buildProjectBriefMemory(repository: string, brief: ProjectBrief): string {
    return [
        `Project brief for ${repository}.`,
        brief.summary,
        `App purpose: ${brief.appPurpose}`,
        `Auth model: ${brief.authModel}`,
        `Deployment shape: ${brief.deploymentShape}`,
        brief.trustBoundaries.length > 0
            ? `Trust boundaries: ${summarizeBriefList(brief.trustBoundaries)}`
            : "",
        brief.sensitiveFlows.length > 0
            ? `Sensitive flows: ${summarizeBriefList(brief.sensitiveFlows)}`
            : "",
        brief.criticalModules.length > 0
            ? `Critical modules: ${summarizeBriefList(brief.criticalModules)}`
            : "",
        brief.externalServices.length > 0
            ? `External services: ${brief.externalServices.slice(0, 4).join(", ")}`
            : "",
        `Confidence ${(brief.confidence * 100).toFixed(0)}%.`,
    ]
        .filter(Boolean)
        .join(" ");
}

export function buildScanSummaryMemory(input: {
    repository: string;
    scanRunId: string;
    score: string | null;
    issues: ScanIssueLike[];
    summary?: ScanSummaryLike;
    projectBrief?: ProjectBrief;
}): string {
    const topFindings = topIssues(input.issues)
        .map((issue) => summarizeIssue(issue))
        .join(" | ");

    return [
        `Scan summary for ${input.repository} (run ${input.scanRunId.slice(0, 8)}).`,
        `Score ${input.score || "unknown"}.`,
        `${input.issues.length} issue(s) found.`,
        input.summary
            ? `Breakdown: ${input.summary.secrets || 0} secrets, ${input.summary.pii || 0} PII, ${input.summary.vulnerabilities || 0} vulnerabilities, ${input.summary.codeQuality || 0} code quality issues.`
            : "",
        topFindings ? `Top findings: ${topFindings}.` : "No top findings recorded.",
        input.projectBrief?.summary ? `Project identity: ${input.projectBrief.summary}` : "",
    ]
        .filter(Boolean)
        .join(" ");
}

export function buildAcceptedRiskMemory(input: {
    repository: string;
    scanRunId: string;
    issues: ScanIssueLike[];
    projectBrief?: ProjectBrief;
}): string {
    const topFindings = topIssues(input.issues)
        .map((issue) => summarizeIssue(issue))
        .join(" | ");

    return [
        `Accepted risk recorded for ${input.repository} on scan run ${input.scanRunId.slice(0, 8)}.`,
        `${input.issues.length} issue(s) remained open when the run was dismissed or marked not applicable.`,
        topFindings ? `Outstanding findings: ${topFindings}.` : "",
        input.projectBrief?.authModel ? `Auth context: ${input.projectBrief.authModel}` : "",
    ]
        .filter(Boolean)
        .join(" ");
}

export function extractRecurringWeakSpotMemories(input: {
    repository: string;
    currentIssues: ScanIssueLike[];
    previousRuns: PreviousScanRunRow[];
}): string[] {
    const priorCounts = new Map<string, number>();

    for (const run of input.previousRuns) {
        const runIssues = Array.isArray(run.results?.issues) ? run.results?.issues : [];
        const runSignatures = new Set(
            runIssues
                .filter((issue): issue is Required<Pick<ScanIssueLike, "type" | "name" | "file">> & Partial<Pick<ScanIssueLike, "severity" | "line">> =>
                    typeof issue?.type === "string" &&
                    typeof issue?.name === "string" &&
                    typeof issue?.file === "string"
                )
                .map((issue) => issueSignature({
                    type: issue.type,
                    name: issue.name,
                    file: issue.file,
                }))
        );

        for (const signature of runSignatures) {
            priorCounts.set(signature, (priorCounts.get(signature) || 0) + 1);
        }
    }

    return [...new Map(
        input.currentIssues
            .map((issue) => {
                const previousCount = priorCounts.get(issueSignature(issue)) || 0;
                if (previousCount === 0) return null;
                return [
                    issueSignature(issue),
                    {
                        issue,
                        previousCount,
                    },
                ] as const;
            })
            .filter((entry): entry is readonly [string, { issue: ScanIssueLike; previousCount: number }] => entry !== null)
    ).values()]
        .sort((a, b) => {
            if (b.previousCount !== a.previousCount) return b.previousCount - a.previousCount;
            return SEVERITY_WEIGHT[b.issue.severity] - SEVERITY_WEIGHT[a.issue.severity];
        })
        .slice(0, 3)
        .map(({ issue, previousCount }) => (
            `Recurring weak spot for ${input.repository}: ${issue.name} in ${issue.file} has appeared in ${previousCount + 1} scan runs including the current run. Latest location ${issue.file}:${issue.line}.`
        ));
}

export async function persistScanContinuity(input: {
    projectId: string;
    userId: string;
    repository: string;
    scanRunId: string;
    score: string | null;
    issues: ScanIssueLike[];
    summary?: ScanSummaryLike;
    research: RepositoryResearch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any>;
}): Promise<void> {
    const { data: previousRuns, error } = await input.supabase
        .from("scan_runs")
        .select("id, created_at, score, results")
        .eq("project_id", input.projectId)
        .eq("status", "completed")
        .neq("id", input.scanRunId)
        .order("created_at", { ascending: false })
        .limit(5);

    if (error) {
        throw new Error(`[Scan Continuity] Failed to load previous runs: ${error.message}`);
    }

    const recurringWeakSpots = extractRecurringWeakSpotMemories({
        repository: input.repository,
        currentIssues: input.issues,
        previousRuns: (previousRuns || []) as PreviousScanRunRow[],
    });

    // Fetch existing continuity entries to avoid duplicates
    const { data: existingEntries } = await input.supabase
        .from("scan_chat_memory")
        .select("id, content, source")
        .eq("project_id", input.projectId)
        .eq("user_id", input.userId)
        .in("source", ["project_brief", "scan_summary", "accepted_risk", "weak_spot"])
        .order("created_at", { ascending: false })
        .limit(30);

    const existingContentSet = new Set(
        (existingEntries || []).map((entry: { content: string }) => entry.content)
    );

    const continuityMemories = [
        {
            content: buildProjectBriefMemory(input.repository, input.research.projectBrief),
            source: "project_brief" as const,
        },
        {
            content: buildScanSummaryMemory({
                repository: input.repository,
                scanRunId: input.scanRunId,
                score: input.score,
                issues: input.issues,
                summary: input.summary,
                projectBrief: input.research.projectBrief,
            }),
            source: "scan_summary" as const,
        },
        ...recurringWeakSpots.map((content) => ({
            content,
            source: "weak_spot" as const,
        })),
    ];

    for (const memory of continuityMemories) {
        // Skip if identical content already stored (dedup)
        if (existingContentSet.has(memory.content)) continue;

        await writeMemory(
            input.projectId,
            input.userId,
            memory.content,
            memory.source,
            input.supabase,
            input.scanRunId,
            { enforce: false }
        );
    }

    // Prune old scan_summary entries beyond the latest 3 to prevent unbounded growth
    const existingSummaries = (existingEntries || [])
        .filter((entry: { source: string }) => entry.source === "scan_summary")
        .map((entry: { id: string }) => entry.id);

    if (existingSummaries.length > 3) {
        const staleIds = existingSummaries.slice(3);
        await input.supabase
            .from("scan_chat_memory")
            .delete()
            .in("id", staleIds);
    }
}

