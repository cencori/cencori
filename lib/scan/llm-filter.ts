/**
 * LLM Post-Processing Filter
 *
 * After the regex scanner runs, this module sends flagged `route` and
 * `vulnerability` issues (along with their file content) to the AI to
 * confirm whether each finding is a real problem or a false positive.
 *
 * - Confirmed real  → confidence: 'high'
 * - Likely false positive → confidence: 'low' (filtered from primary results)
 * - AI unavailable / timeout → all issues kept as-is (safe fallback, best-effort mode only)
 *
 * Secret + PII issues are NOT sent to the LLM — regex is already precise
 * for those and we don't want to expose secret values to an external model.
 */

import type { ScanIssue } from "../../packages/scan/src/scanner/core";
import { generateWithFallback } from "./ai-client";
import { isScanStrictEnforcementEnabled } from "./policy";

const FILTERABLE_TYPES = new Set<ScanIssue["type"]>(["route", "vulnerability"]);
const MAX_FILE_CHARS = 60_000;
const MAX_ISSUES_PER_FILE = 20;

interface LlmVerdict {
    issueKey: string;
    isRealIssue: boolean;
    reason: string;
}

interface LlmFilterResponse {
    verdicts: LlmVerdict[];
}

export interface LlmFilterOptions {
    enforce?: boolean;
}

export class LlmFilterEnforcementError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LlmFilterEnforcementError";
    }
}

function hasAiProviderConfigured(): boolean {
    return Boolean(
        process.env.CEREBRAS_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.GOOGLE_AI_API_KEY ||
        process.env.GEMINI_API_KEY
    );
}

function issueKey(issue: ScanIssue): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function tryParseJson<T>(text: string): T | null {
    try { return JSON.parse(text) as T; } catch { /* fall through */ }
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try { return JSON.parse(fenced[1].trim()) as T; } catch { /* fall through */ }
    }
    const firstBrace = text.indexOf("{");
    if (firstBrace >= 0) {
        try { return JSON.parse(text.slice(firstBrace)) as T; } catch { /* fall through */ }
    }
    return null;
}

function conservativeVerdicts(issues: ScanIssue[]): Map<string, boolean> {
    const verdictMap = new Map<string, boolean>();
    for (const issue of issues) {
        verdictMap.set(issueKey(issue), true);
    }
    return verdictMap;
}

async function validateFileIssues(
    filePath: string,
    fileContent: string,
    issues: ScanIssue[],
    enforce: boolean,
): Promise<Map<string, boolean>> {
    const verdictMap = new Map<string, boolean>();

    if (issues.length === 0) return verdictMap;

    const truncatedContent = fileContent.length > MAX_FILE_CHARS
        ? fileContent.slice(0, MAX_FILE_CHARS) + "\n// [file truncated for analysis]"
        : fileContent;

    const issueList = issues.map(issue => ({
        key: issueKey(issue),
        type: issue.type,
        name: issue.name,
        severity: issue.severity,
        line: issue.line,
        description: issue.description ?? null,
        match: issue.match,
    }));

    const prompt = `You are a senior application security engineer reviewing static analysis findings.
For each flagged issue below, determine whether it is a REAL security concern in this specific code, or a FALSE POSITIVE (regex matched but the code is actually safe).

File: ${filePath}

Flagged issues:
${JSON.stringify(issueList, null, 2)}

File content:
\`\`\`
${truncatedContent}
\`\`\`

Rules:
- For "Next.js API Route (check for auth)" or "Express Route": check if auth is enforced (e.g. calls to getUser, requireAuth, middleware, session checks). If yes → false positive.
- For "Exposed API Route File": if the route clearly checks auth before business logic → false positive.
- For XSS / innerHTML: if the content being assigned is a static string literal with no user input → false positive.
- For SQL patterns: if you can see parameterized queries are used despite the regex match → false positive.
- Default to isRealIssue: true if you are uncertain.

Return JSON only, no markdown fences:
{
  "verdicts": [
    { "issueKey": "file:line:type:name", "isRealIssue": true|false, "reason": "one sentence" }
  ]
}`;

    try {
        const response = await generateWithFallback(prompt);
        if (!response) {
            if (enforce) {
                console.warn(
                    `[LLM Filter] No AI provider response while validating ${filePath}; keeping findings as real issues`
                );
                return conservativeVerdicts(issues);
            }
            return verdictMap;
        }

        const parsed = tryParseJson<LlmFilterResponse>(response.text);
        if (!parsed || !Array.isArray(parsed.verdicts)) {
            if (enforce) {
                console.warn(
                    `[LLM Filter] Invalid AI response format while validating ${filePath}; keeping findings as real issues`
                );
                return conservativeVerdicts(issues);
            }
            return verdictMap;
        }

        for (const verdict of parsed.verdicts) {
            if (typeof verdict.issueKey === "string" && typeof verdict.isRealIssue === "boolean") {
                verdictMap.set(verdict.issueKey, verdict.isRealIssue);
            }
        }
    } catch (err) {
        if (enforce) {
            console.warn(
                `[LLM Filter] Failed to validate issues for ${filePath}; keeping findings as real issues`,
                err instanceof Error ? err.message : err
            );
            return conservativeVerdicts(issues);
        }
        console.warn("[LLM Filter] Failed to validate issues for", filePath, err instanceof Error ? err.message : err);
    }

    return verdictMap;
}

function chunkIssues(issues: ScanIssue[]): ScanIssue[][] {
    const chunks: ScanIssue[][] = [];
    for (let i = 0; i < issues.length; i += MAX_ISSUES_PER_FILE) {
        chunks.push(issues.slice(i, i + MAX_ISSUES_PER_FILE));
    }
    return chunks;
}

export interface LlmFilterResult {
    /** Issues confirmed real or not evaluated — show these to the user */
    filtered: ScanIssue[];
    /** Issues the LLM flagged as likely false positives */
    suppressed: ScanIssue[];
    /** How many issues were sent to the LLM for validation */
    evaluated: number;
    /** Whether strict enforcement mode was enabled */
    enforced: boolean;
}

/**
 * Run the LLM post-processing filter on a set of scan issues.
 *
 * @param issues    All issues from the regex scan
 * @param fileContents  Map of filePath → file content (from the scan run)
 */
export async function filterIssuesWithLLM(
    issues: ScanIssue[],
    fileContents: Map<string, string>,
    options?: LlmFilterOptions,
): Promise<LlmFilterResult> {
    const enforce = options?.enforce ?? isScanStrictEnforcementEnabled();

    const toFilter = issues.filter(i => FILTERABLE_TYPES.has(i.type));
    const keep = issues.filter(i => !FILTERABLE_TYPES.has(i.type));

    if (toFilter.length === 0) {
        return { filtered: issues, suppressed: [], evaluated: 0, enforced: enforce };
    }

    if (enforce && !hasAiProviderConfigured()) {
        throw new LlmFilterEnforcementError(
            "[LLM Filter] Strict enforcement enabled but no AI provider keys are configured"
        );
    }

    const byFile = new Map<string, ScanIssue[]>();
    for (const issue of toFilter) {
        const existing = byFile.get(issue.file) ?? [];
        existing.push(issue);
        byFile.set(issue.file, existing);
    }

    const tasks = [...byFile.entries()].flatMap(([filePath, fileIssues]) =>
        chunkIssues(fileIssues).map(chunk => ({ filePath, issues: chunk }))
    );

    const confirmed: ScanIssue[] = [];
    const suppressed: ScanIssue[] = [];
    let evaluated = 0;

    const CONCURRENCY = 6;
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const batch = tasks.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map(async ({ filePath, issues: chunk }) => {
            const content = fileContents.get(filePath);
            if (!content) {
                if (enforce) {
                    throw new LlmFilterEnforcementError(
                        `[LLM Filter] Missing scanned file content for ${filePath}`
                    );
                }
                for (const issue of chunk) {
                    confirmed.push({ ...issue, confidence: "high" });
                }
                return;
            }

            evaluated += chunk.length;
            const verdictMap = await validateFileIssues(filePath, content, chunk, enforce);

            for (const issue of chunk) {
                const key = issueKey(issue);
                const verdict = verdictMap.get(key);

                if (verdict === undefined) {
                    if (enforce) {
                        console.warn(
                            `[LLM Filter] Missing verdict for ${key} in strict mode; keeping as real issue`
                        );
                    }
                    confirmed.push({ ...issue, confidence: "high" });
                    continue;
                }

                if (verdict === false) {
                    suppressed.push({ ...issue, confidence: "low" });
                } else {
                    confirmed.push({ ...issue, confidence: "high" });
                }
            }
        }));
    }

    const filtered = [
        ...keep,
        ...confirmed,
    ];

    console.log(
        `[LLM Filter] mode=${enforce ? "strict" : "best-effort"} evaluated=${evaluated} ` +
        `files=${byFile.size} kept=${confirmed.length} suppressed=${suppressed.length}`
    );

    return { filtered, suppressed, evaluated, enforced: enforce };
}
