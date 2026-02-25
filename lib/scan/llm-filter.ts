/**
 * LLM Post-Processing Filter
 *
 * After the regex scanner runs, this module sends flagged `route` and
 * `vulnerability` issues (along with their file content) to the AI to
 * confirm whether each finding is a real problem or a false positive.
 *
 * - Confirmed real  → confidence: 'high'
 * - Likely false positive → confidence: 'low' (filtered from primary results)
 * - AI unavailable / timeout → all issues kept as-is (safe fallback)
 *
 * Secret + PII issues are NOT sent to the LLM — regex is already precise
 * for those and we don't want to expose secret values to an external model.
 */

import type { ScanIssue } from '../../packages/scan/src/scanner/core';
import { generateWithFallback } from './ai-client';

// Issue types we want the LLM to validate
const FILTERABLE_TYPES = new Set<ScanIssue['type']>(['route', 'vulnerability']);

// Hard cap: don't send files larger than this to the LLM
const MAX_FILE_CHARS = 60_000;

// Max issues to validate in one LLM call (keeps prompts bounded)
const MAX_ISSUES_PER_FILE = 20;

interface LlmVerdict {
    issueKey: string;
    isRealIssue: boolean;
    reason: string;
}

interface LlmFilterResponse {
    verdicts: LlmVerdict[];
}

function issueKey(issue: ScanIssue): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function tryParseJson<T>(text: string): T | null {
    // Try raw parse first
    try { return JSON.parse(text) as T; } catch { /* fall through */ }
    // Try extracting from a fenced code block
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        try { return JSON.parse(fenced[1].trim()) as T; } catch { /* fall through */ }
    }
    // Try extracting {...} or [...]
    const firstBrace = text.indexOf('{');
    if (firstBrace >= 0) {
        try { return JSON.parse(text.slice(firstBrace)) as T; } catch { /* fall through */ }
    }
    return null;
}

async function validateFileIssues(
    filePath: string,
    fileContent: string,
    issues: ScanIssue[],
): Promise<Map<string, boolean>> {
    const verdictMap = new Map<string, boolean>();

    if (issues.length === 0) return verdictMap;

    const truncatedContent = fileContent.length > MAX_FILE_CHARS
        ? fileContent.slice(0, MAX_FILE_CHARS) + '\n// [file truncated for analysis]'
        : fileContent;

    const issueList = issues.slice(0, MAX_ISSUES_PER_FILE).map(issue => ({
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
        if (!response) return verdictMap;

        const parsed = tryParseJson<LlmFilterResponse>(response.text);
        if (!parsed || !Array.isArray(parsed.verdicts)) return verdictMap;

        for (const verdict of parsed.verdicts) {
            if (typeof verdict.issueKey === 'string' && typeof verdict.isRealIssue === 'boolean') {
                verdictMap.set(verdict.issueKey, verdict.isRealIssue);
            }
        }
    } catch (err) {
        console.warn('[LLM Filter] Failed to validate issues for', filePath, err instanceof Error ? err.message : err);
    }

    return verdictMap;
}

export interface LlmFilterResult {
    /** Issues confirmed real or not evaluated — show these to the user */
    filtered: ScanIssue[];
    /** Issues the LLM flagged as likely false positives */
    suppressed: ScanIssue[];
    /** How many issues were sent to the LLM for validation */
    evaluated: number;
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
): Promise<LlmFilterResult> {
    // Separate filterable types from non-filterable (secrets, pii, config)
    const toFilter = issues.filter(i => FILTERABLE_TYPES.has(i.type));
    const keep = issues.filter(i => !FILTERABLE_TYPES.has(i.type));

    if (toFilter.length === 0) {
        return { filtered: issues, suppressed: [], evaluated: 0 };
    }

    // Group by file
    const byFile = new Map<string, ScanIssue[]>();
    for (const issue of toFilter) {
        const existing = byFile.get(issue.file) ?? [];
        existing.push(issue);
        byFile.set(issue.file, existing);
    }

    const confirmed: ScanIssue[] = [];
    const suppressed: ScanIssue[] = [];
    let evaluated = 0;

    // Validate each file in parallel (capped at 6 concurrent calls)
    const fileEntries = [...byFile.entries()];
    const CONCURRENCY = 6;

    for (let i = 0; i < fileEntries.length; i += CONCURRENCY) {
        const batch = fileEntries.slice(i, i + CONCURRENCY);

        await Promise.all(batch.map(async ([filePath, fileIssues]) => {
            const content = fileContents.get(filePath);

            if (!content) {
                // No file content available — keep all issues (safe fallback)
                for (const issue of fileIssues) {
                    confirmed.push({ ...issue, confidence: 'high' });
                }
                return;
            }

            evaluated += fileIssues.length;
            const verdictMap = await validateFileIssues(filePath, content, fileIssues);

            for (const issue of fileIssues) {
                const key = issueKey(issue);
                const verdict = verdictMap.get(key);

                if (verdict === false) {
                    // LLM says false positive
                    suppressed.push({ ...issue, confidence: 'low' });
                } else {
                    // LLM confirmed real, or verdict missing (default: keep)
                    confirmed.push({ ...issue, confidence: 'high' });
                }
            }
        }));
    }

    const filtered = [
        ...keep,
        ...confirmed,
    ];

    console.log(
        `[LLM Filter] Evaluated ${evaluated} issues across ${byFile.size} files. ` +
        `Kept ${confirmed.length}, suppressed ${suppressed.length} false positives.`
    );

    return { filtered, suppressed, evaluated };
}
