/**
 * Changelog generation module
 * Reads git commits and generates AI-powered changelogs
 */

import { execSync } from 'child_process';

const CENCORI_API_URL = 'https://api.cencori.com/v1';

export interface GitCommit {
    hash: string;
    date: string;
    author: string;
    message: string;
    type: 'feat' | 'fix' | 'chore' | 'docs' | 'style' | 'refactor' | 'test' | 'other';
}

export interface ChangelogEntry {
    type: 'feature' | 'fix' | 'improvement' | 'docs' | 'other';
    title: string;
    description?: string;
    commits: string[];
}

export interface ChangelogResult {
    period: {
        start: string;
        end: string;
    };
    entries: ChangelogEntry[];
    markdown: string;
    commitCount: number;
}

/**
 * Parse conventional commit type from message
 */
function parseCommitType(message: string): GitCommit['type'] {
    const lower = message.toLowerCase();
    if (lower.startsWith('feat') || lower.startsWith('feature')) return 'feat';
    if (lower.startsWith('fix') || lower.startsWith('bugfix')) return 'fix';
    if (lower.startsWith('chore')) return 'chore';
    if (lower.startsWith('docs')) return 'docs';
    if (lower.startsWith('style')) return 'style';
    if (lower.startsWith('refactor')) return 'refactor';
    if (lower.startsWith('test')) return 'test';
    return 'other';
}

/**
 * Get commits from git log
 */
export function getCommits(since: string = '1 week ago', cwd?: string): GitCommit[] {
    try {
        // Get git log in a parseable format
        const output = execSync(
            `git log --since="${since}" --pretty=format:"%H|%aI|%an|%s" --no-merges`,
            {
                cwd: cwd || process.cwd(),
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            }
        );

        if (!output.trim()) {
            return [];
        }

        return output
            .trim()
            .split('\n')
            .map((line) => {
                const [hash, date, author, ...messageParts] = line.split('|');
                const message = messageParts.join('|'); // Handle messages with | in them
                return {
                    hash: hash.substring(0, 7),
                    date,
                    author,
                    message,
                    type: parseCommitType(message),
                };
            });
    } catch (error) {
        // Not a git repo or git not available
        return [];
    }
}

/**
 * Group commits by type (free tier)
 */
function groupCommitsByType(commits: GitCommit[]): ChangelogEntry[] {
    const groups: Record<string, GitCommit[]> = {
        feat: [],
        fix: [],
        docs: [],
        other: [],
    };

    for (const commit of commits) {
        if (commit.type === 'feat') {
            groups.feat.push(commit);
        } else if (commit.type === 'fix') {
            groups.fix.push(commit);
        } else if (commit.type === 'docs') {
            groups.docs.push(commit);
        } else {
            groups.other.push(commit);
        }
    }

    const entries: ChangelogEntry[] = [];

    if (groups.feat.length > 0) {
        entries.push({
            type: 'feature',
            title: 'Features',
            commits: groups.feat.map((c) => c.message),
        });
    }

    if (groups.fix.length > 0) {
        entries.push({
            type: 'fix',
            title: 'Bug Fixes',
            commits: groups.fix.map((c) => c.message),
        });
    }

    if (groups.docs.length > 0) {
        entries.push({
            type: 'docs',
            title: 'Documentation',
            commits: groups.docs.map((c) => c.message),
        });
    }

    if (groups.other.length > 0) {
        entries.push({
            type: 'other',
            title: 'Other Changes',
            commits: groups.other.map((c) => c.message),
        });
    }

    return entries;
}

/**
 * Generate markdown from entries (free tier)
 */
function generateMarkdownFree(entries: ChangelogEntry[], period: { start: string; end: string }): string {
    const startDate = new Date(period.start).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
    const endDate = new Date(period.end).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    let md = `## Changelog (${startDate} - ${endDate})\n\n`;

    for (const entry of entries) {
        md += `### ${entry.title}\n\n`;
        for (const commit of entry.commits) {
            // Clean up conventional commit prefixes
            const cleanMessage = commit
                .replace(/^(feat|fix|chore|docs|style|refactor|test)(\(.+?\))?:\s*/i, '')
                .trim();
            md += `- ${cleanMessage}\n`;
        }
        md += '\n';
    }

    return md;
}

/**
 * Generate changelog using AI (Pro tier)
 */
async function generateChangelogAI(
    commits: GitCommit[],
    apiKey: string,
    period: { start: string; end: string }
): Promise<{ entries: ChangelogEntry[]; markdown: string }> {
    const commitMessages = commits.map((c) => c.message).join('\n');

    try {
        const response = await fetch(`${CENCORI_API_URL}/changelog/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                commits: commitMessages,
                period,
            }),
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json() as { entries?: ChangelogEntry[]; markdown?: string };
        return {
            entries: data.entries || [],
            markdown: data.markdown || '',
        };
    } catch {
        // Fallback to free tier if AI fails
        const entries = groupCommitsByType(commits);
        return {
            entries,
            markdown: generateMarkdownFree(entries, period),
        };
    }
}

/**
 * Generate changelog from commits
 */
export async function generateChangelog(
    since: string = '1 week ago',
    apiKey?: string,
    cwd?: string
): Promise<ChangelogResult> {
    const commits = getCommits(since, cwd);

    const now = new Date();
    const sinceDate = new Date();

    // Parse "X weeks ago" format
    const match = since.match(/(\d+)\s*(week|day|month)s?\s*ago/i);
    if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit === 'week') {
            sinceDate.setDate(sinceDate.getDate() - amount * 7);
        } else if (unit === 'day') {
            sinceDate.setDate(sinceDate.getDate() - amount);
        } else if (unit === 'month') {
            sinceDate.setMonth(sinceDate.getMonth() - amount);
        }
    } else {
        // Default to 1 week
        sinceDate.setDate(sinceDate.getDate() - 7);
    }

    const period = {
        start: sinceDate.toISOString(),
        end: now.toISOString(),
    };

    if (commits.length === 0) {
        return {
            period,
            entries: [],
            markdown: `## Changelog\n\nNo commits found in the specified period.\n`,
            commitCount: 0,
        };
    }

    if (apiKey) {
        // Pro tier: Use AI
        const { entries, markdown } = await generateChangelogAI(commits, apiKey, period);
        return {
            period,
            entries,
            markdown,
            commitCount: commits.length,
        };
    } else {
        // Free tier: Basic grouping
        const entries = groupCommitsByType(commits);
        return {
            period,
            entries,
            markdown: generateMarkdownFree(entries, period),
            commitCount: commits.length,
        };
    }
}
