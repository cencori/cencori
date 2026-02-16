import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface RouteParams {
    params: Promise<{ id: string }>;
}

interface AcceptedFix {
    id: string;
    file: string;
    line: number;
    issueType: string;
    issueName: string;
    severity: string;
    strategy: 'deterministic' | 'ai';
    originalCode: string;
    fixedCode: string;
    explanation: string;
}

// ─── Main Route Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    console.log(`[Fix Apply] Starting PR creation for project ${id}`);

    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.log('[Fix Apply] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Fix Apply] User ${user.id} authenticated`);

    const body = await req.json();
    const { scanRunId, fixes }: { scanRunId: string; fixes: AcceptedFix[] } = body;

    if (!scanRunId || !fixes || fixes.length === 0) {
        console.log('[Fix Apply] Missing scanRunId or fixes in request body');
        return NextResponse.json({ error: 'scanRunId and fixes are required' }, { status: 400 });
    }

    console.log(`[Fix Apply] Processing ${fixes.length} fixes for scan run ${scanRunId}`);

    const supabaseAdmin = createAdminClient();

    // Get project (verify ownership)
    const { data: project, error: projectError } = await supabaseAdmin
        .from('scan_projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        console.log(`[Fix Apply] Project ${id} not found for user ${user.id}`);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log(`[Fix Apply] Project: ${project.github_repo_full_name}`);

    const octokit = await getInstallationOctokit(project.github_installation_id);
    const [owner, repo] = project.github_repo_full_name.split('/');

    try {
        // 1. Get default branch
        const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', {
            owner,
            repo,
        });
        const defaultBranch = repoData.default_branch;
        console.log(`[Fix Apply] Default branch: ${defaultBranch}`);

        // 2. Get latest commit SHA on default branch
        const { data: refData } = await octokit.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
            owner,
            repo,
            ref: `heads/${defaultBranch}`,
        });
        const baseSha = refData.object.sha;
        console.log(`[Fix Apply] Base SHA: ${baseSha.substring(0, 8)}`);

        // 3. Create new branch
        const shortId = scanRunId.substring(0, 8);
        const branchName = `cencori/fix-${shortId}`;

        await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
            owner,
            repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha,
        });

        console.log(`[Fix Apply] Created branch: ${branchName}`);

        // 4. Group fixes by file
        const fixesByFile = new Map<string, AcceptedFix[]>();
        for (const fix of fixes) {
            const existing = fixesByFile.get(fix.file) || [];
            existing.push(fix);
            fixesByFile.set(fix.file, existing);
        }

        // 5. Apply fixes file by file
        console.log(`[Fix Apply] Applying fixes across ${fixesByFile.size} files`);
        for (const [filePath, fileFixes] of fixesByFile) {
            console.log(`[Fix Apply]   Updating ${filePath} (${fileFixes.length} fixes)`);
            try {
                // Get current file content from the new branch
                const { data: fileData } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                    owner,
                    repo,
                    path: filePath,
                    ref: branchName,
                });

                if (!('content' in fileData) || !fileData.content || !('sha' in fileData)) {
                    continue;
                }

                let content = Buffer.from(fileData.content, 'base64').toString('utf-8');

                // Apply each fix to this file
                // Sort fixes by line number descending so replacements don't shift line numbers
                const sortedFixes = [...fileFixes].sort((a, b) => b.line - a.line);

                for (const fix of sortedFixes) {
                    // Replace the original code snippet with the fixed version
                    if (content.includes(fix.originalCode)) {
                        content = content.replace(fix.originalCode, fix.fixedCode);
                    } else {
                        // Fallback: try line-based replacement
                        const lines = content.split('\n');
                        const originalLines = fix.originalCode.split('\n');
                        const fixedLines = fix.fixedCode.split('\n');

                        // Find the start of the original code
                        const startLine = Math.max(0, fix.line - 6);
                        const endLine = Math.min(lines.length, startLine + originalLines.length);

                        // Verify the lines match before replacing
                        const currentSnippet = lines.slice(startLine, endLine).join('\n');
                        if (currentSnippet.trim() === fix.originalCode.trim()) {
                            lines.splice(startLine, endLine - startLine, ...fixedLines);
                            content = lines.join('\n');
                        }
                    }
                }

                // Commit the updated file
                await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                    owner,
                    repo,
                    path: filePath,
                    message: `fix: resolve security issue in ${filePath}`,
                    content: Buffer.from(content).toString('base64'),
                    sha: fileData.sha,
                    branch: branchName,
                });

                console.log(`[Fix Apply]   ✓ Committed ${filePath}`);
            } catch (fileError) {
                console.error(`[Fix Apply]   ✗ Failed to update ${filePath}:`, fileError);
                // Continue with other files
            }
        }

        // 6. Create Pull Request
        const issuesSummary = fixes.map(f =>
            `| \`${f.file}\` | ${f.issueName} | ${f.severity} | ${f.explanation} |`
        ).join('\n');

        const prBody = `## 🛡️ Security Fixes by Cencori Scan

This PR automatically resolves **${fixes.length}** security issue${fixes.length !== 1 ? 's' : ''} detected by [Cencori Scan](https://cencori.com).

### Changes

| File | Issue | Severity | Fix |
|------|-------|----------|-----|
${issuesSummary}

### Fix Strategies
- **Auto Fix** (deterministic): ${fixes.filter(f => f.strategy === 'deterministic').length} fixes
- **AI Fix** (LLM-generated): ${fixes.filter(f => f.strategy === 'ai').length} fixes

---

> 🔍 Review each change carefully before merging.
> Generated by [Cencori Scan](https://scan.cencori.com) • [Documentation](https://cencori.com/docs)`;

        const { data: pr } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            title: `fix: resolve ${fixes.length} security issue${fixes.length !== 1 ? 's' : ''} found by Cencori Scan`,
            body: prBody,
            head: branchName,
            base: defaultBranch,
        });

        console.log(`[Fix Apply] ✓ PR #${pr.number} created: ${pr.html_url}`);

        return NextResponse.json({
            prUrl: pr.html_url,
            prNumber: pr.number,
            branchName,
            filesChanged: fixesByFile.size,
            fixesApplied: fixes.length,
        });

    } catch (error) {
        console.error('[Fix Apply] PR creation failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create PR' },
            { status: 500 }
        );
    }
}
