import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';
import { generateFileFixWithGemini } from '@/lib/scan/gemini';
import { randomUUID } from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string): boolean { return UUID_RE.test(v); }

interface RouteParams {
    params: Promise<{ id: string }>;
}

// ─── Types ──────────────────────────────────────────────────────────────
export interface FixProposal {
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

interface ScanIssue {
    type: string;
    category?: string;
    severity: string;
    name: string;
    match: string;
    line: number;
    file: string;
    description?: string;
}

interface IssueTypeCount {
    type: string;
    count: number;
}

interface ManualGuidance {
    issueKey: string;
    issueType: string;
    issueName: string;
    severity: string;
    file: string;
    line: number;
    summary: string;
    steps: string[];
}

// ─── Deterministic Fix Templates ────────────────────────────────────────

function deriveEnvVarName(issueName: string): string {
    const name = issueName
        .replace(/\(.*?\)/g, '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

    if (!name || name === 'GENERIC_SECRET') return 'SECRET_VALUE';
    return name;
}

function tryDeterministicFix(
    issue: ScanIssue,
    fileContent: string
): { fixedCode: string; explanation: string } | null {
    const lines = fileContent.split('\n');
    const startLine = Math.max(0, issue.line - 6);
    const endLine = Math.min(lines.length, issue.line + 5);
    const snippet = lines.slice(startLine, endLine).join('\n');

    switch (issue.name) {
        case 'OpenAI API Key':
        case 'OpenAI Project Key':
        case 'Anthropic API Key':
        case 'Google API Key':
        case 'AWS Access Key ID':
        case 'AWS Secret Access Key':
        case 'GitHub Personal Access Token':
        case 'GitHub OAuth Token':
        case 'Stripe Secret Key':
        case 'Supabase Service Role Key':
        case 'JWT Secret Assignment':
        case 'OAuth Client Secret':
        case 'Google Client Secret':
        case 'Generic API Key Assignment':
        case 'Password Assignment': {
            const envVar = deriveEnvVarName(issue.name);
            const fixedSnippet = replaceSecretWithEnvVar(snippet, issue, envVar);
            if (fixedSnippet && fixedSnippet !== snippet) {
                return {
                    fixedCode: fixedSnippet,
                    explanation: `Replaced hardcoded ${issue.name.toLowerCase()} with \`process.env.${envVar}\`. Add this variable to your \`.env\` file.`,
                };
            }
            return null;
        }

        case 'Private Key': {
            const envVar = 'PRIVATE_KEY';
            const fixedSnippet = snippet.replace(
                /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----[\s\S]*?-----END (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/,
                `\${process.env.${envVar}}`
            );
            if (fixedSnippet !== snippet) {
                return {
                    fixedCode: fixedSnippet,
                    explanation: `Replaced inline private key with \`process.env.${envVar}\`. Store the key in your \`.env\` file.`,
                };
            }
            return null;
        }

        case 'Direct innerHTML Assignment': {
            const fixedSnippet = snippet.replace(
                /\.innerHTML\s*=/g,
                '.textContent ='
            );
            if (fixedSnippet !== snippet) {
                return {
                    fixedCode: fixedSnippet,
                    explanation: `Replaced \`innerHTML\` with \`textContent\` to prevent XSS attacks. If you need HTML rendering, use a sanitization library like DOMPurify.`,
                };
            }
            return null;
        }

        case 'Eval Usage':
        case 'SQL String Concatenation':
        case 'SQL String Addition':
            return null;

        default:
            return null;
    }
}

function replaceSecretWithEnvVar(snippet: string, issue: ScanIssue, envVar: string): string | null {
    const lines = snippet.split('\n');
    const issueLineIndex = lines.findIndex((line, idx) => {
        const lineContent = line.toLowerCase();
        return lineContent.includes(issue.match.substring(0, 4).toLowerCase()) ||
            (idx >= 4 && idx <= 6);
    });

    if (issueLineIndex === -1) return null;

    const targetLine = lines[issueLineIndex];
    const fixedLine = targetLine.replace(
        /([:=]\s*)(["'])([^"']*?)(\2)/,
        `$1process.env.${envVar}`
    );

    if (fixedLine === targetLine) return null;
    lines[issueLineIndex] = fixedLine;
    return lines.join('\n');
}

function issueKey(issue: ScanIssue): string {
    return `${issue.file}:${issue.line}:${issue.type}:${issue.name}`;
}

function summarizeIssueTypes(issues: ScanIssue[]): IssueTypeCount[] {
    const counts = new Map<string, number>();
    for (const issue of issues) {
        const label = issue.name || issue.type || 'Unknown issue';
        counts.set(label, (counts.get(label) || 0) + 1);
    }

    return [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.type.localeCompare(b.type);
        });
}

function buildManualGuidance(issue: ScanIssue): ManualGuidance {
    const shared = {
        issueKey: issueKey(issue),
        issueType: issue.type,
        issueName: issue.name,
        severity: issue.severity,
        file: issue.file,
        line: issue.line,
    };

    if (issue.type === 'secret') {
        return {
            ...shared,
            summary: issue.description || 'Secret-like value detected. Move it to environment variables and rotate exposed credentials.',
            steps: [
                'Move the secret to an environment variable and remove it from committed source.',
                'Rotate the compromised credential in the provider dashboard.',
                'Add secret scanning and pre-commit checks to block re-introduction.',
            ],
        };
    }

    if (issue.type === 'pii') {
        return {
            ...shared,
            summary: issue.description || 'Potential personal data detected in source.',
            steps: [
                'Remove or anonymize personal data from committed code and fixtures.',
                'Use synthetic test data for examples and tests.',
                'Review logs and telemetry to ensure PII is not emitted downstream.',
            ],
        };
    }

    if (issue.type === 'route') {
        return {
            ...shared,
            summary: issue.description || 'Potentially exposed route detected; verify authorization and rate limiting.',
            steps: [
                'Require authentication and role checks before business logic executes.',
                'Apply request validation and strict input schemas.',
                'Add route-level tests for unauthorized and malformed requests.',
            ],
        };
    }

    if (issue.name === 'SQL String Concatenation' || issue.name === 'SQL String Addition') {
        return {
            ...shared,
            summary: issue.description || 'Potential SQL injection pattern detected.',
            steps: [
                'Replace string interpolation with parameterized queries.',
                'Validate and constrain user-supplied identifiers or sort fields.',
                'Add negative tests that include common injection payloads.',
            ],
        };
    }

    if (issue.name === 'React dangerouslySetInnerHTML' || issue.name === 'Direct innerHTML Assignment') {
        return {
            ...shared,
            summary: issue.description || 'Potential XSS sink detected.',
            steps: [
                'Avoid raw HTML rendering where possible; use plain text APIs.',
                'If HTML is required, sanitize with a vetted sanitizer (e.g., DOMPurify).',
                'Add tests for script injection payloads.',
            ],
        };
    }

    if (issue.name === 'Eval Usage' || issue.name === 'Function Constructor') {
        return {
            ...shared,
            summary: issue.description || 'Dynamic code execution pattern detected.',
            steps: [
                'Replace eval/new Function with explicit parsers or lookup tables.',
                'Treat untrusted input as data, never executable code.',
                'Add static checks to block eval-like constructs in CI.',
            ],
        };
    }

    if (issue.type === 'config') {
        return {
            ...shared,
            summary: issue.description || 'Sensitive configuration file is tracked in the repository.',
            steps: [
                'Remove secrets from tracked config files and move them to environment variables.',
                'Update .gitignore to block local secret files.',
                'Rotate any credential that may already be exposed.',
            ],
        };
    }

    return {
        ...shared,
        summary: issue.description || 'Manual security review is recommended for this finding.',
        steps: [
            'Review the surrounding code path and trust boundaries.',
            'Apply the least-privilege, validated-input, and secure-default principles.',
            'Add regression tests covering the exploit scenario.',
        ],
    };
}

interface ScanResearchLike {
    dataFlows?: {
        traces?: Array<{
            file?: string;
            line?: number;
            severity?: string;
            summary?: string;
        }>;
    };
}

interface PendingAiIssue {
    issueId: string;
    issue: ScanIssue;
    issueKey: string;
    snippet: string;
    dataFlowContext?: string;
}

function extractSnippet(content: string, line: number, radius: number = 6): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, line - radius - 1);
    const endLine = Math.min(lines.length, line + radius);
    return lines.slice(startLine, endLine).join('\n');
}

function snippetsDiffer(originalCode: string, fixedCode: string): boolean {
    return originalCode.trim() !== fixedCode.trim();
}

function findClosestChangedSnippet(
    originalContent: string,
    updatedContent: string,
    targetLine: number,
    radius: number = 6
): { originalCode: string; fixedCode: string } | null {
    const originalLines = originalContent.split('\n');
    const updatedLines = updatedContent.split('\n');
    const maxLines = Math.max(originalLines.length, updatedLines.length);
    const changedLineIndexes: number[] = [];

    for (let index = 0; index < maxLines; index += 1) {
        const before = originalLines[index] ?? '';
        const after = updatedLines[index] ?? '';
        if (before !== after) {
            changedLineIndexes.push(index);
        }
    }

    if (changedLineIndexes.length === 0) {
        return null;
    }

    const targetIndex = Math.max(0, targetLine - 1);
    const closestIndex = changedLineIndexes.reduce((best, current) => (
        Math.abs(current - targetIndex) < Math.abs(best - targetIndex) ? current : best
    ), changedLineIndexes[0]);

    const start = Math.max(0, closestIndex - radius);
    const originalEnd = Math.min(originalLines.length, closestIndex + radius + 1);
    const updatedEnd = Math.min(updatedLines.length, closestIndex + radius + 1);

    return {
        originalCode: originalLines.slice(start, originalEnd).join('\n'),
        fixedCode: updatedLines.slice(start, updatedEnd).join('\n'),
    };
}

function getIssueDataFlowContext(research: ScanResearchLike | undefined, issue: ScanIssue): string | undefined {
    const traces = research?.dataFlows?.traces;
    if (!Array.isArray(traces) || traces.length === 0) {
        return undefined;
    }

    const matchingTrace = traces.find((trace) => {
        if (trace.file !== issue.file) {
            return false;
        }

        if (typeof trace.line !== 'number') {
            return true;
        }

        return Math.abs(trace.line - issue.line) <= 8;
    });

    if (!matchingTrace || !matchingTrace.summary) {
        return undefined;
    }

    return `${matchingTrace.severity || 'medium'} risk data-flow: ${matchingTrace.summary}`;
}

// ─── Main Route Handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const startTime = Date.now();
    const supabase = await createServerClient();

    console.log(`[Fix Gen] Starting fix generation for project ${id}`);

    // Auth check
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        console.log('[Fix Gen] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isValidUUID(id)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    console.log(`[Fix Gen] User ${user.id} authenticated`);

    const body = await req.json();
    const { scanRunId } = body;

    if (!scanRunId || typeof scanRunId !== 'string') {
        return NextResponse.json({ error: 'scanRunId is required' }, { status: 400 });
    }

    if (!isValidUUID(scanRunId)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    console.log(`[Fix Gen] Scan run ID: ${scanRunId}`);

    const supabaseAdmin = createAdminClient();

    // Get project (verify ownership)
    const { data: project, error: projectError } = await supabaseAdmin
        .from('scan_projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        console.log(`[Fix Gen] Project ${id} not found for user ${user.id}`);
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log(`[Fix Gen] Project found: ${project.github_repo_full_name}`);

    // Get scan run results
    const { data: scanRun, error: scanError } = await supabaseAdmin
        .from('scan_runs')
        .select('*')
        .eq('id', scanRunId)
        .eq('project_id', id)
        .single();

    if (scanError || !scanRun) {
        console.log(`[Fix Gen] Scan run ${scanRunId} not found`);
        return NextResponse.json({ error: 'Scan run not found' }, { status: 404 });
    }

    const issues: ScanIssue[] = scanRun.results?.issues || [];
    const research = (scanRun.results?.research || undefined) as ScanResearchLike | undefined;
    const repositoryAiSummary =
        typeof scanRun.results?.ai?.summary === 'string' ? scanRun.results.ai.summary : undefined;
    console.log(`[Fix Gen] Found ${issues.length} issues from scan run`);

    if (issues.length === 0) {
        console.log('[Fix Gen] No issues to fix');
        return NextResponse.json({
            fixes: [],
            totalIssues: 0,
            fixesGenerated: 0,
            deterministicCount: 0,
            aiCount: 0,
            unfixableIssueCount: 0,
            unfixableIssueTypes: [],
            manualGuidance: [],
            manualReviewRequired: false,
            message: 'No issues found in this scan run.',
        });
    }

    // ─── Fetch file contents in PARALLEL ────────────────────────────
    const githubAccess = await verifyProjectGithubAccess(user, project);
    if (!githubAccess) {
        return NextResponse.json(
            { error: 'GitHub access for this project is no longer authorized' },
            { status: 403 }
        );
    }

    const octokit = await getInstallationOctokit(githubAccess.installationId);
    const [owner, repo] = githubAccess.repository.fullName.split('/');

    const uniqueFiles = [...new Set(issues.map(i => i.file))];
    console.log(`[Fix Gen] Fetching ${uniqueFiles.length} files in parallel...`);

    const fileContents = new Map<string, string>();
    const fetchStart = Date.now();

    await Promise.all(
        uniqueFiles.map(async (filePath) => {
            try {
                const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                    owner,
                    repo,
                    path: filePath,
                    ref: 'HEAD',
                });

                if ('content' in data && data.content) {
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    fileContents.set(filePath, content);
                }
            } catch (err) {
                const status = (err as { status?: number })?.status;
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[Fix Gen]   ✗ Could not fetch: ${filePath} (status=${status}, error=${message})`);
            }
        })
    );

    console.log(`[Fix Gen] Fetched ${fileContents.size}/${uniqueFiles.length} files in ${Date.now() - fetchStart}ms`);

    // If no files could be fetched, return an error instead of silently returning 0 fixes
    if (fileContents.size === 0) {
        console.error('[Fix Gen] Failed to fetch ANY files from GitHub — likely a GitHub App permission or installation issue');
        return NextResponse.json(
            { error: 'Could not access repository files. The GitHub App installation may need to be reinstalled, or the repository permissions may have changed.' },
            { status: 502 }
        );
    }

    // ─── Phase 1: Deterministic fixes (fast path) ────────────────────
    const fixes: FixProposal[] = [];
    const pendingAiIssuesByFile = new Map<string, PendingAiIssue[]>();
    const resolvedIssueKeys = new Set<string>();
    let aiIssueIndex = 0;

    for (const issue of issues) {
        const fileContent = fileContents.get(issue.file);
        if (!fileContent) {
            console.log(`[Fix Gen]   Skipping ${issue.name} in ${issue.file} — no file content`);
            continue;
        }

        const snippet = extractSnippet(fileContent, issue.line, 6);
        const deterministicFix = tryDeterministicFix(issue, fileContent);

        if (deterministicFix) {
            console.log(`[Fix Gen]   ✓ Deterministic: ${issue.name} in ${issue.file}:${issue.line}`);
            fixes.push({
                id: randomUUID(),
                file: issue.file,
                line: issue.line,
                issueType: issue.type,
                issueName: issue.name,
                severity: issue.severity,
                strategy: 'deterministic',
                originalCode: snippet,
                fixedCode: deterministicFix.fixedCode,
                explanation: deterministicFix.explanation,
                issueKey: issueKey(issue),
            });
            resolvedIssueKeys.add(issueKey(issue));
            continue;
        }

        const pendingIssue: PendingAiIssue = {
            issueId: `issue_${aiIssueIndex}`,
            issue,
            issueKey: issueKey(issue),
            snippet,
            dataFlowContext: getIssueDataFlowContext(research, issue),
        };
        aiIssueIndex += 1;

        const existing = pendingAiIssuesByFile.get(issue.file) || [];
        existing.push(pendingIssue);
        pendingAiIssuesByFile.set(issue.file, existing);
    }

    const pendingIssueCount = Array.from(pendingAiIssuesByFile.values()).reduce(
        (sum, fileIssues) => sum + fileIssues.length,
        0
    );
    console.log(
        `[Fix Gen] Phase 1 done: ${fixes.length} deterministic, ${pendingIssueCount} queued for AI across ${pendingAiIssuesByFile.size} files`
    );

    // ─── Phase 2: File-context AI fixes (Gemini) ─────────────────────
    for (const [filePath, fileIssues] of pendingAiIssuesByFile.entries()) {
        const fileContent = fileContents.get(filePath);
        if (!fileContent) {
            continue;
        }

        console.log(`[Fix Gen]   → AI processing ${filePath} (${fileIssues.length} issues)`);
        const aiResult = await generateFileFixWithGemini({
            repository: githubAccess.repository.fullName,
            repositorySummary: repositoryAiSummary,
            filePath,
            fileContent,
            issues: fileIssues.map((entry) => ({
                id: entry.issueId,
                type: entry.issue.type,
                name: entry.issue.name,
                severity: entry.issue.severity,
                line: entry.issue.line,
                match: entry.issue.match,
                description: entry.issue.description,
                dataFlowContext: entry.dataFlowContext,
            })),
        });

        if (!aiResult || !aiResult.updatedFileContent || aiResult.updatedFileContent === fileContent) {
            console.log(`[Fix Gen]   ✗ AI skipped ${filePath} (no usable file update)`);
            continue;
        }

        const decisionMap = new Map(
            aiResult.issueDecisions.map((decision) => [decision.issueId, decision])
        );

        for (const entry of fileIssues) {
            const decision = decisionMap.get(entry.issueId);
            if (!decision || !decision.fixApplied) {
                continue;
            }

            let originalCode = entry.snippet;
            let fixedCode = extractSnippet(aiResult.updatedFileContent, entry.issue.line, 6);

            if (!snippetsDiffer(originalCode, fixedCode)) {
                const fallback = findClosestChangedSnippet(
                    fileContent,
                    aiResult.updatedFileContent,
                    entry.issue.line,
                    6
                );

                if (fallback) {
                    originalCode = fallback.originalCode;
                    fixedCode = fallback.fixedCode;
                }
            }

            if (!snippetsDiffer(originalCode, fixedCode)) {
                continue;
            }

            fixes.push({
                id: randomUUID(),
                file: entry.issue.file,
                line: entry.issue.line,
                issueType: entry.issue.type,
                issueName: entry.issue.name,
                severity: entry.issue.severity,
                strategy: 'ai',
                originalCode,
                fixedCode,
                explanation: decision.explanation,
                issueKey: entry.issueKey,
                updatedFileContent: aiResult.updatedFileContent,
                aiModel: aiResult.model,
            });
            resolvedIssueKeys.add(entry.issueKey);
        }
    }

    const unfixableIssues = issues.filter((issue) => !resolvedIssueKeys.has(issueKey(issue)));
    const unfixableIssueTypes = summarizeIssueTypes(unfixableIssues);
    const manualGuidance = unfixableIssues.map(buildManualGuidance);
    const deterministicCount = fixes.filter((fix) => fix.strategy === 'deterministic').length;
    const aiCount = fixes.filter((fix) => fix.strategy === 'ai').length;
    const manualReviewRequired = unfixableIssues.length > 0;

    const totalTime = Date.now() - startTime;
    console.log(
        `[Fix Gen] Complete in ${totalTime}ms: ${fixes.length} fixes (${deterministicCount} deterministic, ${aiCount} AI, ${unfixableIssues.length} manual review)`
    );

    return NextResponse.json({
        fixes,
        totalIssues: issues.length,
        fixesGenerated: fixes.length,
        deterministicCount,
        aiCount,
        unfixableIssueCount: unfixableIssues.length,
        unfixableIssueTypes,
        manualGuidance,
        manualReviewRequired,
        message: fixes.length === 0
            ? `Detected ${issues.length} issue${issues.length === 1 ? '' : 's'}, but no safe auto-fix was generated.`
            : undefined,
    });
}
