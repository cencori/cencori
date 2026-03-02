/**
 * AI Fix Suggestions for PR Review Comments
 *
 * Generates concise, line-level fix suggestions using the AI fallback chain.
 * Outputs fixes in GitHub's ```suggestion syntax for one-click application.
 *
 * Design: batches issues by file and sends minimal context (the offending line
 * + a few surrounding lines) to keep prompts small and responses fast.
 */

import { generateWithFallback } from './ai-client';
import type { ScanIssue } from '../../packages/scan/src/scanner/core';

// ── Types ────────────────────────────────────────────────────────────

export interface AISuggestion {
    issue: ScanIssue;
    /** The replacement lines for the GitHub suggestion block */
    fixedCode: string;
    /** Human-readable one-line explanation */
    explanation: string;
}

interface SuggestionRequest {
    issue: ScanIssue;
    /** The offending line and surrounding context */
    contextLines: string[];
    /** 1-indexed line number of the first context line */
    contextStartLine: number;
}

// ── Context Extraction ───────────────────────────────────────────────

const CONTEXT_RADIUS = 2; // lines above and below the issue line

/**
 * Extract a small window of code around an issue line.
 */
function extractContext(
    fileContent: string,
    issueLine: number
): { lines: string[]; startLine: number } {
    const allLines = fileContent.split('\n');
    const start = Math.max(0, issueLine - 1 - CONTEXT_RADIUS);
    const end = Math.min(allLines.length, issueLine + CONTEXT_RADIUS);
    return {
        lines: allLines.slice(start, end),
        startLine: start + 1, // 1-indexed
    };
}

// ── Prompt Builder ───────────────────────────────────────────────────

function buildSuggestionPrompt(requests: SuggestionRequest[]): string {
    const issueBlocks = requests.map((req, i) => {
        const numberedLines = req.contextLines
            .map((line, j) => {
                const lineNum = req.contextStartLine + j;
                const marker = lineNum === req.issue.line ? ' >>>' : '    ';
                return `${marker} ${lineNum}: ${line}`;
            })
            .join('\n');

        return `
### Issue ${i + 1}
- **File**: ${req.issue.file}
- **Line**: ${req.issue.line}
- **Type**: ${req.issue.type} (${req.issue.severity})
- **Name**: ${req.issue.name}
- **Match**: \`${req.issue.match}\`
${req.issue.description ? `- **Description**: ${req.issue.description}` : ''}

Code context (>>> marks the offending line):
\`\`\`
${numberedLines}
\`\`\``;
    });

    return `You are a security engineer. For each issue below, provide a MINIMAL one-line fix.

Return JSON array only (no markdown fences, no explanation outside the JSON):
[
  {
    "issueIndex": 0,
    "fixedLine": "the corrected line of code (just the line, no line number)",
    "explanation": "brief one-sentence explanation"
  }
]

Rules:
- Replace ONLY the offending line. Do not change surrounding code.
- For secrets: replace with process.env.VARIABLE_NAME
- For eval/Function: use safer alternatives (JSON.parse, new Map, etc.)
- For SQL injection: use parameterized queries
- For XSS: use sanitization or safe rendering
- For weak crypto: use secure alternatives (sha256, crypto.randomBytes)
- For dependency issues: suggest the upgrade command
- If a fix is not possible in one line, set fixedLine to null and explain why.
- Keep the same indentation as the original line.
${issueBlocks.join('\n')}`;
}

// ── Response Parser ──────────────────────────────────────────────────

interface RawSuggestion {
    issueIndex: number;
    fixedLine: string | null;
    explanation: string;
}

function parseSuggestionsResponse(text: string): RawSuggestion[] {
    // Try to extract JSON array from the response
    try {
        // Remove markdown fences if present
        const cleaned = text
            .replace(/^```(?:json)?\s*\n?/gm, '')
            .replace(/\n?```\s*$/gm, '')
            .trim();

        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.filter(
                (item): item is RawSuggestion =>
                    typeof item === 'object' &&
                    item !== null &&
                    typeof item.issueIndex === 'number' &&
                    typeof item.explanation === 'string'
            );
        }
    } catch {
        // Try to find JSON array in the text
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (Array.isArray(parsed)) {
                    return parsed.filter(
                        (item): item is RawSuggestion =>
                            typeof item === 'object' &&
                            item !== null &&
                            typeof item.issueIndex === 'number' &&
                            typeof item.explanation === 'string'
                    );
                }
            } catch {
                // Give up
            }
        }
    }

    return [];
}

// ── Main Generator ───────────────────────────────────────────────────

/**
 * Generate AI fix suggestions for issues in a PR.
 *
 * @param issues - New issues found in the PR
 * @param fileContents - Map of filename → file content at HEAD
 * @param maxIssues - Maximum issues to generate suggestions for (default 10)
 * @returns Array of suggestions with fixed code and explanations
 */
export async function generateFixSuggestions(
    issues: ScanIssue[],
    fileContents: Map<string, string>,
    maxIssues = 10
): Promise<AISuggestion[]> {
    if (issues.length === 0) return [];

    // Prioritize by severity and limit to maxIssues
    const prioritized = [...issues]
        .sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
        })
        .slice(0, maxIssues);

    // Build requests with code context
    const requests: SuggestionRequest[] = [];
    for (const issue of prioritized) {
        const content = fileContents.get(issue.file);
        if (!content) continue;

        // Skip dependency issues (fix is "npm update", not a code change)
        if (issue.type === 'dependency') continue;

        const ctx = extractContext(content, issue.line);
        requests.push({
            issue,
            contextLines: ctx.lines,
            contextStartLine: ctx.startLine,
        });
    }

    if (requests.length === 0) return [];

    // Generate suggestions via AI
    const prompt = buildSuggestionPrompt(requests);

    try {
        const response = await generateWithFallback(prompt);
        if (!response) {
            console.warn('[AI Suggestions] AI generation returned null');
            return [];
        }

        const rawSuggestions = parseSuggestionsResponse(response.text);
        const suggestions: AISuggestion[] = [];

        for (const raw of rawSuggestions) {
            if (raw.issueIndex < 0 || raw.issueIndex >= requests.length) continue;
            if (raw.fixedLine === null || raw.fixedLine === undefined) continue;

            const request = requests[raw.issueIndex];
            suggestions.push({
                issue: request.issue,
                fixedCode: raw.fixedLine,
                explanation: raw.explanation,
            });
        }

        console.log(`[AI Suggestions] Generated ${suggestions.length} fix suggestion(s) via ${response.model}`);
        return suggestions;

    } catch (error) {
        console.error('[AI Suggestions] Failed to generate:', error);
        return [];
    }
}

/**
 * Format a GitHub suggestion block for an inline review comment.
 * This renders as a one-click "Apply suggestion" button in GitHub.
 */
export function formatGitHubSuggestion(suggestion: AISuggestion): string {
    return `\`\`\`suggestion
${suggestion.fixedCode}
\`\`\`
> 💡 ${suggestion.explanation}`;
}
