/**
 * PR Comment Formatting and Posting
 *
 * Posts two types of feedback on PRs:
 * 1. **Inline review comments** on the exact diff lines where issues are found
 * 2. **Summary comment** with overall findings table and security score
 *
 * Uses GitHub Pull Request Review API for inline comments and
 * Issue Comments API for the summary (with dedup via bot marker).
 */

import type { ScanIssue, ScanScore } from '../../packages/scan/src/scanner/core';
import type { AISuggestion } from './ai-fix-suggestions';
import { formatGitHubSuggestion } from './ai-fix-suggestions';

// Marker to identify our summary comments for updates
const BOT_MARKER = '<!-- cencori-scan-review -->';

type OctokitLike = {
    request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }>;
};

// ── Types ────────────────────────────────────────────────────────────

export interface PRCommentOptions {
    octokit: OctokitLike;
    owner: string;
    repo: string;
    pullNumber: number;
    headSha: string;
    newIssues: ScanIssue[];
    totalIssues: number;
    score: ScanScore;
    previousScore?: ScanScore | null;
    scanDurationMs: number;
    filesScanned: number;
    /** Map of filename → Set of diff line numbers (lines visible in the diff) */
    diffLineMap?: Map<string, Set<number>>;
    /** AI-generated fix suggestions for issues */
    aiSuggestions?: AISuggestion[];
    projectId?: string;
    scanId?: string;
}

const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
};

const severityLabel: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

const severityDescription: Record<string, string> = {
    secret: '**Secret detected** — this value should be stored in environment variables, not committed to source code.',
    pii: '**PII exposure** — personal data should be handled carefully and not logged or exposed.',
    vulnerability: '**Security vulnerability** — this pattern can be exploited by attackers.',
    dependency: '**Vulnerable dependency** — upgrade to the patched version.',
    config: '**Insecure configuration** — review and harden this setting.',
    route: '**Exposed route** — ensure proper authentication and authorization.',
};

// ── Inline Review Comments ───────────────────────────────────────────

interface ReviewComment {
    path: string;
    line: number;
    body: string;
}

/**
 * Build inline review comment body for an issue, optionally with AI fix suggestion.
 */
function formatInlineComment(issue: ScanIssue, suggestion?: AISuggestion): string {
    const emoji = severityEmoji[issue.severity] || '⚪';
    const label = severityLabel[issue.severity] || issue.severity;
    const typeHint = severityDescription[issue.type] || '';

    const lines: string[] = [];
    lines.push(`${emoji} **${label}: ${issue.name}**`);
    lines.push('');

    if (typeHint) {
        lines.push(typeHint);
        lines.push('');
    }

    if (issue.description) {
        lines.push(`> ${issue.description}`);
        lines.push('');
    }

    // Add AI fix suggestion if available
    if (suggestion) {
        lines.push('**🤖 Suggested fix** (click "Apply suggestion" to fix):');
        lines.push('');
        lines.push(formatGitHubSuggestion(suggestion));
        lines.push('');
    } else {
        lines.push(`\`Match: ${issue.match.length > 80 ? issue.match.slice(0, 77) + '...' : issue.match}\``);
    }

    return lines.join('\n');
}

/**
 * Build review comments for issues that fall on visible diff lines.
 */
function buildReviewComments(
    newIssues: ScanIssue[],
    diffLineMap?: Map<string, Set<number>>,
    aiSuggestions?: AISuggestion[]
): { inlineComments: ReviewComment[]; remainingIssues: ScanIssue[] } {
    if (!diffLineMap || diffLineMap.size === 0) {
        return { inlineComments: [], remainingIssues: newIssues };
    }

    // Build lookup: file:line → suggestion
    const suggestionMap = new Map<string, AISuggestion>();
    if (aiSuggestions) {
        for (const s of aiSuggestions) {
            suggestionMap.set(`${s.issue.file}:${s.issue.line}`, s);
        }
    }

    const inlineComments: ReviewComment[] = [];
    const remainingIssues: ScanIssue[] = [];

    for (const issue of newIssues) {
        const diffLines = diffLineMap.get(issue.file);

        if (diffLines && diffLines.has(issue.line)) {
            const suggestion = suggestionMap.get(`${issue.file}:${issue.line}`);
            inlineComments.push({
                path: issue.file,
                line: issue.line,
                body: formatInlineComment(issue, suggestion),
            });
        } else {
            remainingIssues.push(issue);
        }
    }

    return { inlineComments, remainingIssues };
}

// ── Summary Comment ──────────────────────────────────────────────────

/**
 * Format the summary PR comment body.
 */
export function formatPRComment(options: PRCommentOptions): string {
    const {
        newIssues,
        totalIssues,
        score,
        previousScore,
        scanDurationMs,
        filesScanned,
        diffLineMap,
    } = options;

    const lines: string[] = [BOT_MARKER, ''];
    const durationSec = (scanDurationMs / 1000).toFixed(1);

    // Header
    lines.push('### 🛡️ Cencori Security Review');
    lines.push('');

    if (newIssues.length === 0) {
        // Clean PR
        lines.push('✅ **No new security issues** introduced in this PR.');
        lines.push('');
        lines.push(`<details><summary>📊 Score: ${score} · ${filesScanned} files scanned in ${durationSec}s</summary>`);
        lines.push('');
        if (totalIssues > 0) {
            lines.push(`> ${totalIssues} pre-existing issue${totalIssues === 1 ? '' : 's'} in the repository (not introduced by this PR).`);
        } else {
            lines.push('> Repository is clean — no known issues.');
        }
        lines.push('');
        lines.push('</details>');
    } else {
        // Issues found
        const issueWord = newIssues.length === 1 ? 'issue' : 'issues';

        // Count how many have inline comments
        const { inlineComments } = buildReviewComments(newIssues, diffLineMap, options.aiSuggestions);
        const inlineCount = inlineComments.length;
        const summaryOnly = newIssues.length - inlineCount;

        if (inlineCount > 0) {
            lines.push(`⚠️ **${newIssues.length} new ${issueWord}** introduced in this PR — ${inlineCount} marked inline below`);
        } else {
            lines.push(`⚠️ **${newIssues.length} new ${issueWord}** introduced in this PR`);
        }

        // Score delta
        if (previousScore && previousScore !== score) {
            lines.push(`📊 Security Score: **${previousScore} → ${score}**`);
        }

        lines.push('');

        // Issues table
        lines.push('| Severity | Issue | Location |');
        lines.push('|---|---|---|');

        // Sort by severity
        const sortedIssues = [...newIssues].sort((a, b) => {
            const order = { critical: 0, high: 1, medium: 2, low: 3 };
            return (order[a.severity] ?? 4) - (order[b.severity] ?? 4);
        });

        // Cap at 15 issues to keep comment readable
        const displayIssues = sortedIssues.slice(0, 15);
        for (const issue of displayIssues) {
            const emoji = severityEmoji[issue.severity] || '⚪';
            const label = severityLabel[issue.severity] || issue.severity;
            const name = issue.type === 'dependency'
                ? `📦 ${issue.name}`
                : issue.name;
            const location = `\`${issue.file}:${issue.line}\``;

            lines.push(`| ${emoji} ${label} | ${name} | ${location} |`);
        }

        if (sortedIssues.length > 15) {
            const remaining = sortedIssues.length - 15;
            lines.push('');
            lines.push(`> ...and ${remaining} more issue${remaining === 1 ? '' : 's'}. [View full report →]`);
        }

        lines.push('');

        // Details section
        lines.push(`<details><summary>📋 ${filesScanned} files scanned in ${durationSec}s</summary>`);
        lines.push('');

        if (totalIssues > newIssues.length) {
            const existing = totalIssues - newIssues.length;
            lines.push(`> ${existing} pre-existing issue${existing === 1 ? '' : 's'} not shown (not introduced by this PR).`);
        }

        lines.push('');
        lines.push('</details>');
    }

    // Footer
    lines.push('');
    lines.push('---');
    lines.push('*Powered by [Cencori Scan](https://scan.cencori.app)*');

    return lines.join('\n');
}

// ── Posting ──────────────────────────────────────────────────────────

/**
 * Post inline review comments on the PR using the Pull Request Review API.
 */
async function postInlineReviewComments(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    comments: ReviewComment[]
): Promise<void> {
    if (comments.length === 0) return;

    // Cap at 30 inline comments to avoid GitHub rate limits
    const cappedComments = comments.slice(0, 30);

    try {
        await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
            owner,
            repo,
            pull_number: pullNumber,
            commit_id: headSha,
            event: 'COMMENT',
            body: '',
            comments: cappedComments.map(c => ({
                path: c.path,
                line: c.line,
                body: c.body,
            })),
        });

        console.log(`[PR Comment] Posted ${cappedComments.length} inline review comment(s) on PR #${pullNumber}`);
    } catch (error) {
        // If inline comments fail (e.g., line not in diff), fall back gracefully
        console.warn('[PR Comment] Inline review failed, falling back to summary only:', error);
    }
}

/**
 * Post or update the summary PR comment.
 * Finds existing bot comment by marker and updates it, or creates a new one.
 */
async function postSummaryComment(
    octokit: OctokitLike,
    owner: string,
    repo: string,
    pullNumber: number,
    commentBody: string
): Promise<void> {
    try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
            owner,
            repo,
            issue_number: pullNumber,
            per_page: 100,
        });

        const comments = data as Array<{ id: number; body?: string }>;
        const existingComment = comments.find(c => c.body?.includes(BOT_MARKER));

        if (existingComment) {
            await octokit.request('PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}', {
                owner,
                repo,
                comment_id: existingComment.id,
                body: commentBody,
            });
            console.log(`[PR Comment] Updated summary comment #${existingComment.id} on PR #${pullNumber}`);
        } else {
            await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
                owner,
                repo,
                issue_number: pullNumber,
                body: commentBody,
            });
            console.log(`[PR Comment] Created summary comment on PR #${pullNumber}`);
        }
    } catch (error) {
        console.error('[PR Comment] Failed to post summary comment:', error);
    }
}

/**
 * Post full PR feedback: inline review comments on diff lines + summary comment.
 */
export async function postPRComment(options: PRCommentOptions): Promise<void> {
    const { octokit, owner, repo, pullNumber, headSha, newIssues, diffLineMap } = options;

    // 1. Post inline review comments on specific diff lines (with AI suggestions)
    const { inlineComments } = buildReviewComments(newIssues, diffLineMap, options.aiSuggestions);
    await postInlineReviewComments(octokit, owner, repo, pullNumber, headSha, inlineComments);

    // 2. Post summary comment (always — for visibility and dedup tracking)
    const commentBody = formatPRComment(options);
    await postSummaryComment(octokit, owner, repo, pullNumber, commentBody);
}
