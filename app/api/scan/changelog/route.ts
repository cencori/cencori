import { NextRequest, NextResponse } from "next/server";

interface GitHubCommit {
    sha: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
}

interface ChangelogEntry {
    type: "feature" | "fix" | "docs" | "other";
    title: string;
    commits: string[];
}

function parseCommitType(message: string): "feat" | "fix" | "docs" | "other" {
    const lower = message.toLowerCase();
    if (lower.startsWith("feat") || lower.startsWith("feature")) return "feat";
    if (lower.startsWith("fix") || lower.startsWith("bugfix")) return "fix";
    if (lower.startsWith("docs")) return "docs";
    return "other";
}

function groupCommitsByType(commits: { message: string }[]): ChangelogEntry[] {
    const groups: Record<string, string[]> = {
        feat: [],
        fix: [],
        docs: [],
        other: [],
    };

    for (const commit of commits) {
        const type = parseCommitType(commit.message);
        groups[type].push(commit.message);
    }

    const entries: ChangelogEntry[] = [];

    if (groups.feat.length > 0) {
        entries.push({ type: "feature", title: "Features", commits: groups.feat });
    }
    if (groups.fix.length > 0) {
        entries.push({ type: "fix", title: "Bug Fixes", commits: groups.fix });
    }
    if (groups.docs.length > 0) {
        entries.push({ type: "docs", title: "Documentation", commits: groups.docs });
    }
    if (groups.other.length > 0) {
        entries.push({ type: "other", title: "Other Changes", commits: groups.other });
    }

    return entries;
}

function generateMarkdown(entries: ChangelogEntry[], period: { start: string; end: string }): string {
    const startDate = new Date(period.start).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const endDate = new Date(period.end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    let md = `## Changelog (${startDate} - ${endDate})\n\n`;

    for (const entry of entries) {
        md += `### ${entry.title}\n\n`;
        for (const commit of entry.commits) {
            const cleanMessage = commit
                .replace(/^(feat|fix|chore|docs|style|refactor|test)(\(.+?\))?:\s*/i, "")
                .split("\n")[0]
                .trim();
            md += `- ${cleanMessage}\n`;
        }
        md += "\n";
    }

    return md;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { repoUrl, since = "1 week ago" } = body;

        if (!repoUrl || typeof repoUrl !== "string") {
            return NextResponse.json(
                { error: "Repository URL is required" },
                { status: 400 }
            );
        }

        // Parse GitHub URL
        const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
        if (!match) {
            return NextResponse.json(
                { error: "Invalid GitHub URL. Use format: https://github.com/owner/repo" },
                { status: 400 }
            );
        }

        const [, owner, repo] = match;
        const repoName = repo.replace(/\.git$/, "");

        // Calculate since date
        const now = new Date();
        const sinceDate = new Date();
        const sinceMatch = since.match(/(\d+)\s*(week|day|month)s?\s*ago/i);
        if (sinceMatch) {
            const amount = parseInt(sinceMatch[1], 10);
            const unit = sinceMatch[2].toLowerCase();
            if (unit === "week") sinceDate.setDate(sinceDate.getDate() - amount * 7);
            else if (unit === "day") sinceDate.setDate(sinceDate.getDate() - amount);
            else if (unit === "month") sinceDate.setMonth(sinceDate.getMonth() - amount);
        } else {
            sinceDate.setDate(sinceDate.getDate() - 7);
        }

        // Fetch commits from GitHub API
        const response = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/commits?since=${sinceDate.toISOString()}&per_page=100`,
            {
                headers: {
                    Accept: "application/vnd.github.v3+json",
                    "User-Agent": "Cencori-Scan",
                },
            }
        );

        if (!response.ok) {
            if (response.status === 404) {
                return NextResponse.json(
                    { error: "Repository not found. Make sure it's public." },
                    { status: 404 }
                );
            }
            throw new Error("Failed to fetch commits");
        }

        const commits: GitHubCommit[] = await response.json();

        if (commits.length === 0) {
            return NextResponse.json({
                period: { start: sinceDate.toISOString(), end: now.toISOString() },
                entries: [],
                markdown: "## Changelog\n\nNo commits found in the specified period.\n",
                commitCount: 0,
            });
        }

        const period = {
            start: sinceDate.toISOString(),
            end: now.toISOString(),
        };

        const entries = groupCommitsByType(
            commits.map((c) => ({ message: c.commit.message }))
        );

        const markdown = generateMarkdown(entries, period);

        return NextResponse.json({
            period,
            entries,
            markdown,
            commitCount: commits.length,
        });
    } catch {
        return NextResponse.json(
            { error: "Failed to generate changelog" },
            { status: 500 }
        );
    }
}
