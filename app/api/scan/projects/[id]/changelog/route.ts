import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface CommitData {
    sha: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        } | null;
    };
}

interface ParsedCommit {
    hash: string;
    date: string;
    author: string;
    message: string;
    type: 'feat' | 'fix' | 'chore' | 'docs' | 'style' | 'refactor' | 'test' | 'other';
}

interface ChangelogEntry {
    type: 'feature' | 'fix' | 'docs' | 'other';
    title: string;
    commits: string[];
}

/**
 * Parse conventional commit type from message
 */
function parseCommitType(message: string): ParsedCommit['type'] {
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
 * Group commits by type
 */
function groupCommitsByType(commits: ParsedCommit[]): ChangelogEntry[] {
    const groups: Record<string, ParsedCommit[]> = {
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
        } else if (['chore', 'style', 'refactor', 'test', 'other'].includes(commit.type)) {
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
 * Generate markdown from entries (CLI style, no emojis)
 */
function generateMarkdown(entries: ChangelogEntry[], period: { start: string; end: string }): string {
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

// GET - List changelogs for a project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
        .from('scan_projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get changelogs for this project
    const { data: changelogs, error: changelogsError } = await supabase
        .from('scan_changelogs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (changelogsError) {
        return NextResponse.json({ error: 'Failed to fetch changelogs' }, { status: 500 });
    }

    return NextResponse.json({ changelogs: changelogs || [] });
}

// POST - Generate a new changelog
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project details
    const { data: project, error: projectError } = await supabase
        .from('scan_projects')
        .select('*')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Parse request body for options
    let since = '1 week ago';
    try {
        const body = await request.json();
        if (body.since) {
            since = body.since;
        }
    } catch {
        // Use defaults
    }

    // Calculate date range
    const now = new Date();
    const sinceDate = new Date();

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

    try {
        // Get GitHub installation
        const adminSupabase = createAdminClient();
        const { data: installation, error: installError } = await adminSupabase
            .from('github_installations')
            .select('installation_id')
            .eq('user_id', user.id)
            .single();

        if (installError || !installation) {
            return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 });
        }

        const octokit = await getInstallationOctokit(installation.installation_id);
        const [owner, repo] = project.github_repo_full_name.split('/');

        // Fetch commits from GitHub
        const { data: commitsData } = await octokit.repos.listCommits({
            owner,
            repo,
            since: sinceDate.toISOString(),
            per_page: 100,
        });

        // Filter out merge commits and parse
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const commits: ParsedCommit[] = commitsData
            .filter((c: any) => !c.commit.message.startsWith('Merge'))
            .map((c: any) => ({
                hash: c.sha.substring(0, 7),
                date: c.commit.author?.date || now.toISOString(),
                author: c.commit.author?.name || 'Unknown',
                message: c.commit.message.split('\n')[0], // First line only
                type: parseCommitType(c.commit.message),
            }));

        const period = {
            start: sinceDate.toISOString(),
            end: now.toISOString(),
        };

        if (commits.length === 0) {
            const markdown = `## Changelog\n\nNo commits found in the specified period.\n`;

            // Save to database
            const { data: changelog, error: insertError } = await supabase
                .from('scan_changelogs')
                .insert({
                    project_id: projectId,
                    markdown,
                    period_start: period.start,
                    period_end: period.end,
                    commit_count: 0,
                })
                .select()
                .single();

            if (insertError) {
                console.error('Failed to save changelog:', insertError);
                return NextResponse.json({ error: 'Failed to save changelog' }, { status: 500 });
            }

            return NextResponse.json({ changelog });
        }

        // Group and generate markdown
        const entries = groupCommitsByType(commits);
        const markdown = generateMarkdown(entries, period);

        // Save to database
        const { data: changelog, error: insertError } = await supabase
            .from('scan_changelogs')
            .insert({
                project_id: projectId,
                markdown,
                period_start: period.start,
                period_end: period.end,
                commit_count: commits.length,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to save changelog:', insertError);
            return NextResponse.json({ error: 'Failed to save changelog' }, { status: 500 });
        }

        return NextResponse.json({ changelog });
    } catch (error) {
        console.error('Changelog generation error:', error);
        return NextResponse.json({ error: 'Failed to generate changelog' }, { status: 500 });
    }
}

// DELETE - Delete a changelog
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const changelogId = searchParams.get('changelogId');

    if (!changelogId) {
        return NextResponse.json({ error: 'Changelog ID required' }, { status: 400 });
    }

    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
        .from('scan_projects')
        .select('id')
        .eq('id', projectId)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete the changelog
    const { error: deleteError } = await supabase
        .from('scan_changelogs')
        .delete()
        .eq('id', changelogId)
        .eq('project_id', projectId);

    if (deleteError) {
        return NextResponse.json({ error: 'Failed to delete changelog' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
