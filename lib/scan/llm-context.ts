import { randomUUID } from "crypto";
import type { ScanIssue } from "../../packages/scan/src/scanner/core";
import { generateWithFallback } from "./ai-client";

const DEFAULT_BATCH_SIZE = 30;
const DEFAULT_MAX_TRACKED_FILES = 180;
const MAX_FILES_PER_SNAPSHOT = 8;
const MAX_SNIPPET_CHARS = 4_000;
const MAX_LIST_ITEMS = 10;

const SEVERITY_WEIGHT: Record<ScanIssue["severity"], number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

interface ScanTotals {
    processedFiles: number;
    totalFiles: number;
    issuesFound: number;
}

interface ContextFileSample {
    path: string;
    issueCount: number;
    highestSeverity: ScanIssue["severity"] | null;
    issueTypes: string[];
    snippet: string;
}

interface ParsedContextPayload {
    summary: string;
    architectureFindings: string[];
    riskThemes: string[];
    priorityFiles: string[];
    suggestedChecks: string[];
}

export interface RepositoryAiContext {
    id: string;
    model: string;
    provider: "cerebras" | "groq" | "gemini";
    generatedAt: string;
    summary: string;
    architectureFindings: string[];
    riskThemes: string[];
    priorityFiles: string[];
    suggestedChecks: string[];
    snapshotsAnalyzed: number;
    filesAnalyzed: number;
    issuesObserved: number;
}

export interface RepositoryAiContextUpdate extends RepositoryAiContext {
    progress: ScanTotals;
}

export interface AiContextIngestInput {
    filePath: string;
    fileContent?: string;
    fileIssues: ScanIssue[];
    totals: ScanTotals;
}

interface CreateTrackerOptions {
    repository: string;
    batchSize?: number;
    maxTrackedFiles?: number;
    onUpdate?: (update: RepositoryAiContextUpdate) => void | Promise<void>;
}

export interface RepositoryAiContextTracker {
    readonly isEnabled: boolean;
    ingest(input: AiContextIngestInput): void;
    finalize(totals?: ScanTotals): Promise<RepositoryAiContext | null>;
}

function hasAiProviderConfigured(): boolean {
    return Boolean(
        process.env.CEREBRAS_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GEMINI_API_KEY
    );
}

function tryParseJson<T>(value: string): T | null {
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function extractJsonCandidates(text: string): string[] {
    const trimmed = text.trim();
    if (!trimmed) {
        return [];
    }

    const candidates = new Set<string>([trimmed]);
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        candidates.add(fenced[1].trim());
    }

    const firstBrace = trimmed.indexOf("{");
    if (firstBrace >= 0) {
        for (let index = firstBrace; index < trimmed.length; index += 1) {
            if (trimmed[index] !== "}") continue;
            const candidate = trimmed.slice(firstBrace, index + 1).trim();
            if (candidate.startsWith("{") && candidate.endsWith("}")) {
                candidates.add(candidate);
                break;
            }
        }
    }

    return Array.from(candidates);
}

function parseModelJson<T>(text: string): T | null {
    const candidates = extractJsonCandidates(text);
    for (const candidate of candidates) {
        const parsed = tryParseJson<T>(candidate);
        if (parsed) {
            return parsed;
        }
    }
    return null;
}

function sanitizeList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0)
        .slice(0, MAX_LIST_ITEMS);
}

function mergeLists(a: string[], b: string[]): string[] {
    return Array.from(new Set([...a, ...b])).slice(0, MAX_LIST_ITEMS);
}

function isLikelyBinary(content: string): boolean {
    return content.includes("\u0000");
}

function redactSecrets(value: string): string {
    return value
        .replace(
            /((?:api[_-]?key|token|secret|password)\s*[:=]\s*["'`])[^"'`\n]+(["'`])/gi,
            "$1[REDACTED]$2"
        )
        .replace(/\b(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g, "[REDACTED]");
}

function buildIssueFocusedSnippet(content: string, issues: ScanIssue[]): string {
    const lines = content.split("\n");
    if (lines.length === 0) {
        return "";
    }

    const issueLines = Array.from(
        new Set(issues.map((issue) => issue.line).filter((line) => Number.isFinite(line)))
    ).sort((a, b) => a - b);

    if (issueLines.length === 0) {
        return lines.slice(0, 80).join("\n");
    }

    const snippets: string[] = [];
    for (const line of issueLines.slice(0, 4)) {
        const start = Math.max(1, line - 3);
        const end = Math.min(lines.length, line + 3);
        const block = lines
            .slice(start - 1, end)
            .map((codeLine, offset) => `${start + offset}: ${codeLine}`)
            .join("\n");
        snippets.push(`Around line ${line}:\n${block}`);
    }

    return snippets.join("\n\n");
}

function summarizeIssueTypes(issues: ScanIssue[]): string[] {
    if (issues.length === 0) {
        return [];
    }

    const counts = new Map<string, number>();
    for (const issue of issues) {
        counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([type, count]) => `${type} (${count})`);
}

function highestSeverity(issues: ScanIssue[]): ScanIssue["severity"] | null {
    if (issues.length === 0) {
        return null;
    }

    return [...issues]
        .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0]
        .severity;
}

function toSample(filePath: string, fileContent: string, fileIssues: ScanIssue[]): ContextFileSample | null {
    if (!fileContent || isLikelyBinary(fileContent)) {
        return null;
    }

    const rawSnippet = buildIssueFocusedSnippet(fileContent, fileIssues);
    const redacted = redactSecrets(rawSnippet).trim();
    if (!redacted) {
        return null;
    }

    const snippet = redacted.length > MAX_SNIPPET_CHARS
        ? `${redacted.slice(0, MAX_SNIPPET_CHARS)}\n... [truncated]`
        : redacted;

    return {
        path: filePath,
        issueCount: fileIssues.length,
        highestSeverity: highestSeverity(fileIssues),
        issueTypes: summarizeIssueTypes(fileIssues),
        snippet,
    };
}

function rankSample(a: ContextFileSample, b: ContextFileSample): number {
    const aScore = (a.issueCount * 10) + (a.highestSeverity ? SEVERITY_WEIGHT[a.highestSeverity] : 0);
    const bScore = (b.issueCount * 10) + (b.highestSeverity ? SEVERITY_WEIGHT[b.highestSeverity] : 0);
    return bScore - aScore;
}

function buildPrompt(input: {
    repository: string;
    batch: ContextFileSample[];
    previous: RepositoryAiContext | null;
    totals: ScanTotals;
}): string {
    return `You are a senior application security researcher.
Build a rolling security context snapshot while a repository scan is in progress.

Repository: ${input.repository}
Progress: ${input.totals.processedFiles}/${input.totals.totalFiles} files processed
Issues discovered so far: ${input.totals.issuesFound}

Previous AI summary:
${input.previous?.summary || "none"}

File excerpts for this snapshot:
${JSON.stringify(input.batch, null, 2)}

Return JSON only with this exact shape:
{
  "summary": "1-2 sentence state of the codebase risk at current progress",
  "architectureFindings": ["key architecture/security context item"],
  "riskThemes": ["pattern of risk emerging across files"],
  "priorityFiles": ["path/to/file.ts"],
  "suggestedChecks": ["next manual check to run"]
}

Rules:
- Keep each list item concise and actionable.
- Use only evidence from provided snippets and known progress totals.
- Prefer cross-file context over single-line observations.
- If uncertain, say so explicitly in summary.
- Do not include markdown fences or extra keys.`;
}

function parseContextPayload(text: string): ParsedContextPayload | null {
    const parsed = parseModelJson<{
        summary?: unknown;
        architectureFindings?: unknown;
        riskThemes?: unknown;
        priorityFiles?: unknown;
        suggestedChecks?: unknown;
    }>(text);

    if (!parsed || typeof parsed.summary !== "string" || parsed.summary.trim().length === 0) {
        return null;
    }

    return {
        summary: parsed.summary.trim(),
        architectureFindings: sanitizeList(parsed.architectureFindings),
        riskThemes: sanitizeList(parsed.riskThemes),
        priorityFiles: sanitizeList(parsed.priorityFiles),
        suggestedChecks: sanitizeList(parsed.suggestedChecks),
    };
}

export function createRepositoryAiContextTracker(options: CreateTrackerOptions): RepositoryAiContextTracker {
    const batchSize = Math.max(5, Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, 80));
    const maxTrackedFiles = Math.max(20, Math.min(options.maxTrackedFiles ?? DEFAULT_MAX_TRACKED_FILES, 400));
    const isEnabled = hasAiProviderConfigured();

    let latestTotals: ScanTotals = {
        processedFiles: 0,
        totalFiles: 0,
        issuesFound: 0,
    };
    let trackedFiles = 0;
    let observedIssues = 0;
    let snapshotCount = 0;
    let currentContext: RepositoryAiContext | null = null;
    const pending: ContextFileSample[] = [];

    let inFlight: Promise<void> | null = null;
    let rerunRequested = false;

    const runSnapshot = async (batch: ContextFileSample[]) => {
        if (!isEnabled || batch.length === 0) {
            return;
        }

        const selected = [...batch].sort(rankSample).slice(0, MAX_FILES_PER_SNAPSHOT);
        const prompt = buildPrompt({
            repository: options.repository,
            batch: selected,
            previous: currentContext,
            totals: latestTotals,
        });

        const response = await generateWithFallback(prompt);
        if (!response) {
            return;
        }

        const parsed = parseContextPayload(response.text);
        if (!parsed) {
            return;
        }

        snapshotCount += 1;
        const merged: RepositoryAiContext = {
            id: currentContext?.id || randomUUID(),
            model: response.model,
            provider: response.provider,
            generatedAt: new Date().toISOString(),
            summary: parsed.summary,
            architectureFindings: mergeLists(currentContext?.architectureFindings || [], parsed.architectureFindings),
            riskThemes: mergeLists(currentContext?.riskThemes || [], parsed.riskThemes),
            priorityFiles: mergeLists(currentContext?.priorityFiles || [], parsed.priorityFiles),
            suggestedChecks: mergeLists(currentContext?.suggestedChecks || [], parsed.suggestedChecks),
            snapshotsAnalyzed: snapshotCount,
            filesAnalyzed: trackedFiles,
            issuesObserved: observedIssues,
        };

        currentContext = merged;

        if (options.onUpdate) {
            await options.onUpdate({
                ...merged,
                progress: latestTotals,
            });
        }
    };

    const startSnapshotIfNeeded = () => {
        if (!isEnabled || pending.length === 0) {
            return;
        }

        if (inFlight) {
            rerunRequested = true;
            return;
        }

        const batch = pending.splice(0, pending.length);
        inFlight = runSnapshot(batch)
            .catch((error) => {
                console.warn("[AI Context] Snapshot failed:", error instanceof Error ? error.message : error);
            })
            .finally(() => {
                inFlight = null;
                if (rerunRequested && pending.length > 0) {
                    rerunRequested = false;
                    startSnapshotIfNeeded();
                }
            });
    };

    return {
        get isEnabled() {
            return isEnabled;
        },
        ingest(input: AiContextIngestInput) {
            latestTotals = input.totals;
            observedIssues += input.fileIssues.length;

            if (!isEnabled || trackedFiles >= maxTrackedFiles || !input.fileContent) {
                return;
            }

            const sample = toSample(input.filePath, input.fileContent, input.fileIssues);
            if (!sample) {
                return;
            }

            pending.push(sample);
            trackedFiles += 1;

            const eagerThreshold = Math.max(5, Math.floor(batchSize / 3));
            if (
                pending.length >= batchSize ||
                (input.fileIssues.length > 0 && pending.length >= eagerThreshold)
            ) {
                startSnapshotIfNeeded();
            }
        },
        async finalize(totals?: ScanTotals) {
            if (totals) {
                latestTotals = totals;
            }

            if (!isEnabled) {
                return currentContext;
            }

            if (pending.length > 0) {
                startSnapshotIfNeeded();
            }

            while (inFlight) {
                await inFlight;
                if (pending.length > 0 && !inFlight) {
                    startSnapshotIfNeeded();
                }
            }

            return currentContext;
        },
    };
}
