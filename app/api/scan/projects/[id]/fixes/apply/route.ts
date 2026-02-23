import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';

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
    issueKey?: string;
    updatedFileContent?: string;
    aiModel?: string;
}

interface FileSelectionStats {
    selected: number;
    total: number;
}

function normalizeLine(line: string): string {
    return line.replace(/\s+/g, ' ').trim();
}

function applySnippetFix(content: string, fix: AcceptedFix): { updatedContent: string; applied: boolean } {
    if (!fix.originalCode || !fix.fixedCode || fix.originalCode.trim() === fix.fixedCode.trim()) {
        return { updatedContent: content, applied: false };
    }

    if (content.includes(fix.originalCode)) {
        return {
            updatedContent: content.replace(fix.originalCode, fix.fixedCode),
            applied: true,
        };
    }

    const lines = content.split('\n');
    const originalLines = fix.originalCode.split('\n');
    const fixedLines = fix.fixedCode.split('\n');
    if (originalLines.length === 0) {
        return { updatedContent: content, applied: false };
    }

    const normalizedOriginal = originalLines.map(normalizeLine).join('\n');
    const targetLineIndex = Math.max(0, fix.line - 1);
    const searchStart = Math.max(0, targetLineIndex - 25);
    const searchEnd = Math.min(
        Math.max(0, lines.length - originalLines.length),
        targetLineIndex + 25
    );

    for (let start = searchStart; start <= searchEnd; start += 1) {
        const window = lines.slice(start, start + originalLines.length);
        if (window.length !== originalLines.length) {
            continue;
        }

        const exactMatch = window.join('\n').trim() === fix.originalCode.trim();
        const normalizedMatch = window.map(normalizeLine).join('\n') === normalizedOriginal;
        if (!exactMatch && !normalizedMatch) {
            continue;
        }

        const nextLines = [...lines];
        nextLines.splice(start, originalLines.length, ...fixedLines);
        return {
            updatedContent: nextLines.join('\n'),
            applied: true,
        };
    }

    return { updatedContent: content, applied: false };
}

function getSharedUpdatedFileContent(
    fileFixes: AcceptedFix[],
    selection?: FileSelectionStats
): string | null {
    if (!selection || selection.total <= 0 || selection.selected !== selection.total) {
        return null;
    }

    const aiFileContents = fileFixes
        .map((fix) => fix.updatedFileContent)
        .filter((content): content is string => typeof content === 'string' && content.length > 0);

    if (aiFileContents.length === 0 || aiFileContents.length !== fileFixes.length) {
        return null;
    }

    const [firstContent, ...rest] = aiFileContents;
    const allSame = rest.every((content) => content === firstContent);
    return allSame ? firstContent : null;
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
    const {
        scanRunId,
        fixes,
        selectionByFile,
    }: {
        scanRunId: string;
        fixes: AcceptedFix[];
        selectionByFile?: Record<string, FileSelectionStats>;
    } = body;

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

    const githubAccess = await verifyProjectGithubAccess(user, project);
    if (!githubAccess) {
        return NextResponse.json(
            { error: 'GitHub access for this project is no longer authorized' },
            { status: 403 }
        );
    }

    const { data: scanRun, error: scanRunError } = await supabaseAdmin
        .from('scan_runs')
        .select('id')
        .eq('id', scanRunId)
        .eq('project_id', id)
        .single();

    if (scanRunError || !scanRun) {
        return NextResponse.json({ error: 'Scan run not found' }, { status: 404 });
    }

    console.log(`[Fix Apply] Project: ${githubAccess.repository.fullName}`);

    const octokit = await getInstallationOctokit(githubAccess.installationId);
    const [owner, repo] = githubAccess.repository.fullName.split('/');

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
        const branchSeed = Date.now().toString(36).slice(-6);
        let branchName = `cencori/fix-${shortId}-${branchSeed}`;
        let branchCreated = false;

        for (let attempt = 0; attempt < 3; attempt++) {
            const candidate = attempt === 0
                ? branchName
                : `cencori/fix-${shortId}-${Date.now().toString(36).slice(-6)}-${attempt}`;
            try {
                await octokit.request('POST /repos/{owner}/{repo}/git/refs', {
                    owner,
                    repo,
                    ref: `refs/heads/${candidate}`,
                    sha: baseSha,
                });
                branchName = candidate;
                branchCreated = true;
                break;
            } catch (branchErr) {
                const status = (branchErr as { status?: number })?.status;
                if (status !== 422 || attempt === 2) {
                    throw branchErr;
                }
            }
        }

        if (!branchCreated) {
            throw new Error('Failed to create a unique fix branch');
        }

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
        let filesChanged = 0;
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

                const originalContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
                let content = originalContent;

                const fullySelectedUpdatedContent = getSharedUpdatedFileContent(
                    fileFixes,
                    selectionByFile?.[filePath]
                );

                if (fullySelectedUpdatedContent && fullySelectedUpdatedContent !== content) {
                    content = fullySelectedUpdatedContent;
                } else {
                    // Apply each fix to this file
                    // Sort fixes by line number descending so replacements don't shift line numbers
                    const sortedFixes = [...fileFixes].sort((a, b) => b.line - a.line);

                    for (const fix of sortedFixes) {
                        const result = applySnippetFix(content, fix);
                        content = result.updatedContent;
                    }
                }

                if (content === originalContent) {
                    console.log(`[Fix Apply]   Skipping ${filePath} (no effective changes after apply)`);
                    continue;
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
                filesChanged += 1;

                console.log(`[Fix Apply]   ✓ Committed ${filePath}`);
            } catch (fileError) {
                console.error(`[Fix Apply]   ✗ Failed to update ${filePath}:`, fileError);
                // Continue with other files
            }
        }

        if (filesChanged === 0) {
            return NextResponse.json(
                { error: 'No changes could be safely applied for this fix set' },
                { status: 422 }
            );
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

        await supabaseAdmin
            .from('scan_runs')
            .update({
                fix_status: 'pr_opened',
                fix_pr_url: pr.html_url,
                fix_pr_number: pr.number,
                fix_branch_name: branchName,
                fix_dismissed_at: null,
                fix_done_at: null,
            })
            .eq('id', scanRunId)
            .eq('project_id', id);

        console.log(`[Fix Apply] ✓ PR #${pr.number} created: ${pr.html_url}`);

        return NextResponse.json({
            prUrl: pr.html_url,
            prNumber: pr.number,
            branchName,
            filesChanged,
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
