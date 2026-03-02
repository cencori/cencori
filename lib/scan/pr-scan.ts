/**
 * Diff-Aware PR Scan Engine
 *
 * Scans only files changed in a PR, identifies new issues vs pre-existing ones,
 * and manages GitHub Check Runs + PR comments.
 */

import { getInstallationOctokit } from '@/lib/github';
import { createAdminClient } from '@/lib/supabaseAdmin';
import {
    scanFileContent,
    shouldScanFile,
    calculateScore,
    summarizeIssues,
} from '../../packages/scan/src/scanner/core';
import type { ScanIssue, ScanScore } from '../../packages/scan/src/scanner/core';
import { scanDependencies, isLockfile } from './dependency-scanner';
import { postPRComment } from './pr-comment';
import { generateFixSuggestions } from './ai-fix-suggestions';
import type { AISuggestion } from './ai-fix-suggestions';
import { parseConfig, shouldIgnoreWithConfig, DEFAULT_CONFIG } from './config';
import type { CencoriConfig } from './config';

// ── Types ────────────────────────────────────────────────────────────

interface PRFile {
    filename: string;
    status: string; // 'added' | 'modified' | 'removed' | 'renamed'
    patch?: string;
    sha: string;
}

/**
 * Parse a unified diff patch string to extract the set of added/modified line numbers.
 * These are the lines visible on the right side of the diff in GitHub.
 */
function parsePatchLines(patch: string | undefined): Set<number> {
    const lines = new Set<number>();
    if (!patch) return lines;

    let currentLine = 0;

    for (const line of patch.split('\n')) {
        // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
        const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
            currentLine = parseInt(hunkMatch[1], 10);
            continue;
        }

        if (line.startsWith('+')) {
            lines.add(currentLine);
            currentLine++;
        } else if (line.startsWith('-')) {
            // Removed lines don't advance the new-file line counter
        } else {
            // Context line
            currentLine++;
        }
    }

    return lines;
}

interface PRScanOptions {
    installationId: number;
    owner: string;
    repo: string;
    pullNumber: number;
    headSha: string;
    baseSha: string;
    projectId: string;
}

interface PRScanResult {
    newIssues: ScanIssue[];
    allIssues: ScanIssue[];
    filesScanned: number;
    scanDurationMs: number;
    score: ScanScore;
    checkRunId?: number;
}

// ── Check Run Management ─────────────────────────────────────────────

async function createCheckRun(
    octokit: { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> },
    owner: string,
    repo: string,
    headSha: string
): Promise<number | null> {
    try {
        const { data } = await octokit.request('POST /repos/{owner}/{repo}/check-runs', {
            owner,
            repo,
            name: 'Cencori Security',
            head_sha: headSha,
            status: 'in_progress',
            started_at: new Date().toISOString(),
            output: {
                title: 'Security scan in progress...',
                summary: 'Scanning changed files for vulnerabilities, secrets, and dependency issues.',
            },
        });

        const checkRun = data as { id: number };
        return checkRun.id;
    } catch (error) {
        console.warn('[PR Scan] Failed to create check run:', error);
        return null;
    }
}

async function completeCheckRun(
    octokit: { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> },
    owner: string,
    repo: string,
    checkRunId: number,
    result: PRScanResult,
    config: CencoriConfig = DEFAULT_CONFIG
): Promise<void> {
    const { newIssues, allIssues, filesScanned, scanDurationMs, score } = result;
    const durationSec = (scanDurationMs / 1000).toFixed(1);

    const failOn = config.fail_on || ['critical', 'high'];

    let conclusion: 'success' | 'failure' | 'neutral';
    let title: string;

    if (newIssues.length === 0) {
        conclusion = 'success';
        title = `✅ No new security issues (Score: ${score})`;
    } else {
        const matchingIssues = newIssues.filter(i => failOn.includes(i.severity));
        const hasCritical = newIssues.some(i => i.severity === 'critical');

        if (matchingIssues.length > 0) {
            conclusion = 'failure';
            title = `🔴 ${newIssues.length} new issue${newIssues.length === 1 ? '' : 's'} — blocking merge`;
        } else {
            conclusion = 'neutral';
            title = `🟡 ${newIssues.length} new issue${newIssues.length === 1 ? '' : 's'} — non-blocking`;
        }
    }

    // Build summary markdown
    const summaryLines: string[] = [];
    summaryLines.push(`**${filesScanned}** files scanned in **${durationSec}s**`);
    summaryLines.push(`**${newIssues.length}** new issue${newIssues.length === 1 ? '' : 's'} | **${allIssues.length}** total`);
    summaryLines.push('');

    if (newIssues.length > 0) {
        summaryLines.push('| Severity | Issue | File |');
        summaryLines.push('|---|---|---|');

        const display = newIssues.slice(0, 20);
        for (const issue of display) {
            summaryLines.push(`| ${issue.severity} | ${issue.name} | \`${issue.file}:${issue.line}\` |`);
        }

        if (newIssues.length > 20) {
            summaryLines.push(`| ... | ${newIssues.length - 20} more | |`);
        }
    }

    try {
        await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
            owner,
            repo,
            check_run_id: checkRunId,
            status: 'completed',
            conclusion,
            completed_at: new Date().toISOString(),
            output: {
                title,
                summary: summaryLines.join('\n'),
            },
        });
    } catch (error) {
        console.error('[PR Scan] Failed to update check run:', error);
    }
}

// ── Diff-Aware Scan ──────────────────────────────────────────────────

/**
 * Fetch the list of files changed in a PR.
 */
async function getPRChangedFiles(
    octokit: { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> },
    owner: string,
    repo: string,
    pullNumber: number
): Promise<PRFile[]> {
    const allFiles: PRFile[] = [];
    let page = 1;

    while (true) {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}/files', {
            owner,
            repo,
            pull_number: pullNumber,
            per_page: 100,
            page,
        });

        const files = data as PRFile[];
        if (files.length === 0) break;

        allFiles.push(...files);
        if (files.length < 100) break;
        page++;
    }

    return allFiles;
}

/**
 * Fetch file content at a specific commit SHA.
 */
async function fetchFileAtRef(
    octokit: { request: (route: string, params: Record<string, unknown>) => Promise<{ data: unknown }> },
    owner: string,
    repo: string,
    path: string,
    ref: string
): Promise<string | null> {
    try {
        const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
            owner,
            repo,
            path,
            ref,
        });

        const file = data as { content?: string; encoding?: string };
        if (typeof file.content === 'string') {
            return Buffer.from(file.content, 'base64').toString('utf-8');
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Run a diff-aware scan on a PR.
 *
 * 1. Fetch changed files from the PR
 * 2. Scan each changed file at the head SHA
 * 3. Scan each changed file at the base SHA (for comparison)
 * 4. Only report issues that are NEW (present in head but not in base)
 * 5. Run dependency SCA on changed lockfiles
 * 6. Post PR comment + update Check Run
 */
export async function scanPullRequest(options: PRScanOptions): Promise<PRScanResult> {
    const { installationId, owner, repo, pullNumber, headSha, baseSha, projectId } = options;
    const startTime = Date.now();

    console.log(`[PR Scan] Scanning PR #${pullNumber} on ${owner}/${repo} (${baseSha.slice(0, 7)}..${headSha.slice(0, 7)})`);

    const octokit = await getInstallationOctokit(installationId);

    // Create check run immediately
    const checkRunId = await createCheckRun(octokit, owner, repo, headSha);

    try {
        // 1. Get configuration
        const rawConfig = await fetchFileAtRef(octokit, owner, repo, '.cencori.yml', headSha);
        const config = rawConfig ? parseConfig(rawConfig) : DEFAULT_CONFIG;

        // 2. Get changed files
        const changedFiles = await getPRChangedFiles(octokit, owner, repo, pullNumber);
        const scannableFiles = changedFiles.filter(f =>
            f.status !== 'removed' &&
            (shouldScanFile(f.filename) || isLockfile(f.filename)) &&
            !shouldIgnoreWithConfig(f.filename, config)
        );

        console.log(`[PR Scan] ${changedFiles.length} files changed, ${scannableFiles.length} scannable`);

        // Build diffLineMap for inline comment placement
        const diffLineMap = new Map<string, Set<number>>();
        for (const file of changedFiles) {
            if (file.patch) {
                diffLineMap.set(file.filename, parsePatchLines(file.patch));
            }
        }

        // 2. Scan files at HEAD (new code)
        const headIssues: ScanIssue[] = [];
        const lockfileContents: Array<{ path: string; content: string }> = [];
        let filesScanned = 0;

        for (const file of scannableFiles) {
            const content = await fetchFileAtRef(octokit, owner, repo, file.filename, headSha);
            if (!content) continue;

            if (isLockfile(file.filename)) {
                lockfileContents.push({ path: file.filename, content });
            }

            if (shouldScanFile(file.filename)) {
                const issues = scanFileContent(file.filename, content);
                headIssues.push(...issues);
                filesScanned++;
            }
        }

        // 3. Dependency scanning on changed lockfiles
        if (lockfileContents.length > 0) {
            const depIssues = await scanDependencies(lockfileContents);
            headIssues.push(...depIssues);
        }

        // 4. Scan same files at BASE (old code) to find pre-existing issues
        const baseIssues: ScanIssue[] = [];
        for (const file of scannableFiles) {
            if (!shouldScanFile(file.filename)) continue;

            // For new files, there are no base issues
            if (file.status === 'added') continue;

            const content = await fetchFileAtRef(octokit, owner, repo, file.filename, baseSha);
            if (!content) continue;

            const issues = scanFileContent(file.filename, content);
            baseIssues.push(...issues);
        }

        // 5. Compute NEW issues: present in HEAD but not in BASE
        const baseFingerprints = new Set(
            baseIssues.map(i => `${i.type}:${i.name}:${i.file}:${i.match}`)
        );

        const newIssues = headIssues.filter(issue => {
            const fp = `${issue.type}:${issue.name}:${issue.file}:${issue.match}`;
            return !baseFingerprints.has(fp);
        });

        const scanDurationMs = Date.now() - startTime;
        const score = calculateScore(headIssues);
        const summary = summarizeIssues(headIssues);

        console.log(`[PR Scan] Found ${newIssues.length} new issues (${headIssues.length} total) in ${scanDurationMs}ms`);

        // 6. Generate AI fix suggestions for new issues
        const fileContentMap = new Map<string, string>();
        for (const file of scannableFiles) {
            const content = await fetchFileAtRef(octokit, owner, repo, file.filename, headSha);
            if (content && shouldScanFile(file.filename)) {
                fileContentMap.set(file.filename, content);
            }
        }

        let aiSuggestions: AISuggestion[] = [];
        if (newIssues.length > 0) {
            try {
                aiSuggestions = await generateFixSuggestions(newIssues, fileContentMap, 10);
                console.log(`[PR Scan] Generated ${aiSuggestions.length} AI fix suggestion(s)`);
            } catch (err) {
                console.warn('[PR Scan] AI suggestion generation failed (non-fatal):', err);
            }
        }

        const result: PRScanResult = {
            newIssues,
            allIssues: headIssues,
            filesScanned,
            scanDurationMs,
            score,
            checkRunId: checkRunId ?? undefined,
        };

        // 7. Update Check Run
        if (checkRunId) {
            await completeCheckRun(octokit, owner, repo, checkRunId, result, config);
        }

        // 8. Post PR comment (summary + inline review comments with AI fixes)
        await postPRComment({
            octokit,
            owner,
            repo,
            pullNumber,
            headSha,
            newIssues,
            totalIssues: headIssues.length,
            score,
            scanDurationMs,
            filesScanned,
            diffLineMap,
            aiSuggestions,
            projectId,
        });

        // 8. Store scan result
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.from('scan_runs').insert({
            project_id: projectId,
            status: 'completed',
            score,
            files_scanned: filesScanned,
            issues_found: headIssues.length,
            scan_duration_ms: scanDurationMs,
            secrets_count: summary.secrets,
            pii_count: summary.pii,
            vulnerabilities_count: summary.vulnerabilities,
            dependencies_count: summary.dependencies,
            fix_status: newIssues.length > 0 ? 'pending' : 'not_applicable',
            results: {
                trigger: 'webhook_pr',
                pr_number: pullNumber,
                head_sha: headSha,
                base_sha: baseSha,
                issues: headIssues,
                new_issues: newIssues,
                summary,
                check_run_id: checkRunId,
            },
        });

        return result;

    } catch (error) {
        // Mark check run as failed
        if (checkRunId) {
            try {
                await octokit.request('PATCH /repos/{owner}/{repo}/check-runs/{check_run_id}', {
                    owner,
                    repo,
                    check_run_id: checkRunId,
                    status: 'completed',
                    conclusion: 'failure',
                    completed_at: new Date().toISOString(),
                    output: {
                        title: '❌ Scan failed',
                        summary: error instanceof Error ? error.message : 'Unknown error',
                    },
                });
            } catch {
                // Ignore check run update failures
            }
        }

        throw error;
    }
}
