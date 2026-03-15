import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';
import { trackEvent } from '@/lib/track-event';
import { getScanPaywallForUser } from '@/lib/scan/entitlements';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

// Relative path with no traversal, no absolute, no null bytes
function isSafeRelativePath(p: string): boolean {
    if (!p || typeof p !== 'string') return false;
    if (p.includes('\x00')) return false;                          // null byte
    if (p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p)) return false; // absolute path
    const normalized = p.replace(/\\/g, '/');
    const parts = normalized.split('/');
    let depth = 0;
    for (const part of parts) {
        if (part === '..') { depth--; if (depth < 0) return false; }
        else if (part !== '.') depth++;
    }
    return true;
}

function sanitizeFix(raw: unknown): AcceptedFix | null {
    const fix = (raw || {}) as Record<string, unknown>;
    const file = typeof fix.file === 'string' ? fix.file : null;
    if (!file || !isSafeRelativePath(file)) return null;
    const line = typeof fix.line === 'number' && Number.isFinite(fix.line) ? Math.max(0, Math.floor(fix.line)) : 0;
    const originalCode = typeof fix.originalCode === 'string' ? fix.originalCode.slice(0, 51200) : '';
    const fixedCode = typeof fix.fixedCode === 'string' ? fix.fixedCode.slice(0, 51200) : '';
    const explanation = typeof fix.explanation === 'string' ? fix.explanation.slice(0, 1000) : '';
    const id = typeof fix.id === 'string' ? fix.id.slice(0, 100) : '';
    const issueType = typeof fix.issueType === 'string' ? fix.issueType.slice(0, 200) : '';
    const issueName = typeof fix.issueName === 'string' ? fix.issueName.slice(0, 200) : '';
    const severity = typeof fix.severity === 'string' ? fix.severity.slice(0, 50) : '';
    const strategy = fix.strategy === 'deterministic' || fix.strategy === 'ai' ? fix.strategy : 'deterministic';
    const issueKey = typeof fix.issueKey === 'string' ? fix.issueKey.slice(0, 300) : undefined;
    const aiModel = typeof fix.aiModel === 'string' ? fix.aiModel.slice(0, 100) : undefined;
    const updatedFileContent = typeof fix.updatedFileContent === 'string' ? fix.updatedFileContent.slice(0, 1024 * 1024) : undefined;
    return { id, file, line, issueType, issueName, severity, strategy, originalCode, fixedCode, explanation, issueKey, aiModel, updatedFileContent };
}

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

class GithubPermissionError extends Error {
    status: number;

    constructor(message: string) {
        super(message);
        this.name = 'GithubPermissionError';
        this.status = 403;
    }
}

function extractGithubErrorDetails(error: unknown): { status?: number; message: string } {
    if (error instanceof Error) {
        const status = (error as { status?: number }).status;
        const responseData = (error as { response?: { data?: { message?: string } } }).response?.data;
        const responseMessage = typeof responseData?.message === 'string' ? responseData.message : '';
        return {
            status,
            message: responseMessage || error.message || 'Unknown GitHub API error',
        };
    }

    return { message: String(error) };
}

function isGithubPermissionError(error: unknown): boolean {
    const { status, message } = extractGithubErrorDetails(error);
    if (status === 403) {
        return true;
    }

    const normalized = message.toLowerCase();
    return normalized.includes('resource not accessible by integration') ||
        normalized.includes('must have push access') ||
        normalized.includes('insufficient permissions');
}

function buildGithubPermissionErrorMessage(owner: string, repo: string): string {
    return [
        `GitHub App cannot write to ${owner}/${repo}.`,
        'Grant app permissions: Contents (Read and write) and Pull requests (Read and write), and ensure this repository is included in the installation.',
        'Then reinstall or update the installation and retry creating the PR.',
    ].join(' ');
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

    const paywallResponse = await getScanPaywallForUser(user.id);
    if (paywallResponse) {
        return paywallResponse;
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

    if (!scanRunId || !fixes || !Array.isArray(fixes) || fixes.length === 0) {
        return NextResponse.json({ error: 'scanRunId and fixes are required' }, { status: 400 });
    }

    if (!isValidUUID(scanRunId)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    if (fixes.length > 100) {
        return NextResponse.json({ error: 'Too many fixes (max 100 per request)' }, { status: 400 });
    }

    const sanitizedFixes = fixes.map(sanitizeFix).filter((f): f is AcceptedFix => f !== null);
    if (sanitizedFixes.length === 0) {
        return NextResponse.json({ error: 'No valid fixes after sanitization' }, { status: 400 });
    }

    console.log(`[Fix Apply] Processing ${sanitizedFixes.length} fixes (of ${fixes.length} submitted) for scan run ${scanRunId}`);

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
        // 0. Preflight permission check on this installation/repository pairing.
        try {
            const { data: installationData } = await octokit.request(
                'GET /repos/{owner}/{repo}/installation',
                { owner, repo }
            );
            const permissions = (installationData as { permissions?: Record<string, string> }).permissions || {};
            const contentsPermission = permissions.contents;
            const pullRequestPermission = permissions.pull_requests;
            const hasRequiredWrite =
                contentsPermission === 'write' && pullRequestPermission === 'write';

            if (!hasRequiredWrite) {
                return NextResponse.json(
                    { error: buildGithubPermissionErrorMessage(owner, repo) },
                    { status: 403 }
                );
            }
        } catch (installationError) {
            if (isGithubPermissionError(installationError)) {
                return NextResponse.json(
                    { error: buildGithubPermissionErrorMessage(owner, repo) },
                    { status: 403 }
                );
            }
        }

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
                if (isGithubPermissionError(branchErr)) {
                    throw new GithubPermissionError(buildGithubPermissionErrorMessage(owner, repo));
                }
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
        for (const fix of sanitizedFixes) {
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
                if (isGithubPermissionError(fileError)) {
                    throw new GithubPermissionError(buildGithubPermissionErrorMessage(owner, repo));
                }
            }
        }

        if (filesChanged === 0) {
            return NextResponse.json(
                { error: 'No changes could be safely applied for this fix set' },
                { status: 422 }
            );
        }

        // 6. Create Pull Request
        const issuesSummary = sanitizedFixes.map(f =>
            `| \`${f.file}\` | ${f.issueName} | ${f.severity} | ${f.explanation} |`
        ).join('\n');

        const prBody = `## Security Fixes by Cencori Scan

This PR automatically resolves **${sanitizedFixes.length}** security issue${sanitizedFixes.length !== 1 ? 's' : ''} detected by [Cencori Scan](https://cencori.com/scan).

### Changes

| File | Issue | Severity | Fix |
|------|-------|----------|-----|
${issuesSummary}

### Fix Strategies
- **Auto Fix** (deterministic): ${sanitizedFixes.filter(f => f.strategy === 'deterministic').length} fixes
- **AI Fix** (LLM-generated): ${sanitizedFixes.filter(f => f.strategy === 'ai').length} fixes

---

> Review each change carefully before merging.
> Generated by [Cencori Scan](https://cencori.com/scan) • [Documentation](https://cencori.com/docs)`;

        const { data: pr } = await octokit.request('POST /repos/{owner}/{repo}/pulls', {
            owner,
            repo,
            title: `fix: resolve ${sanitizedFixes.length} security issue${sanitizedFixes.length !== 1 ? 's' : ''} found by Cencori Scan`,
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

        trackEvent({ event_type: 'scan.fixes_applied', product: 'scan_web', user_id: user.id, metadata: { project_id: id, pr_number: pr.number, pr_url: pr.html_url, fixes_applied: fixes.length, files_changed: filesChanged } });

        return NextResponse.json({
            prUrl: pr.html_url,
            prNumber: pr.number,
            branchName,
            filesChanged,
            fixesApplied: fixes.length,
        });

    } catch (error) {
        console.error('[Fix Apply] PR creation failed:', error);
        if (error instanceof GithubPermissionError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (isGithubPermissionError(error)) {
            return NextResponse.json(
                { error: buildGithubPermissionErrorMessage(owner, repo) },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create PR' },
            { status: 500 }
        );
    }
}
