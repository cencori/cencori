import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';
import { analyzeRepositoryResearch } from '@/lib/scan/research';
import { generateRepositoryAiInsight } from '@/lib/scan/gemini';
import { scanGithubRepository } from '@/lib/scan/repository-scan';
import { filterIssuesWithLLM } from '@/lib/scan/llm-filter';
import { scanDependencies, isLockfile } from '@/lib/scan/dependency-scanner';
import { createRepositoryAiContextTracker } from '@/lib/scan/llm-context';
import { isScanStrictEnforcementEnabled } from '@/lib/scan/policy';
import { getScanPaywallForUser, getScanRunPaywallForProject } from '@/lib/scan/entitlements';
import {
    calculateScore,
    scanFileContent,
    shouldScanFile,
    summarizeIssues,
} from '../../../../../../packages/scan/src/scanner/core';

// Allow up to 5 minutes — scan + LLM filter + AI insight can be slow on large repos
export const maxDuration = 300;

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/scan/projects/[id]/scan - Run a scan on the project
export async function POST(_req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paywallResponse = await getScanPaywallForUser(user.id);
    if (paywallResponse) {
        return paywallResponse;
    }

    try {
        const supabaseAdmin = createAdminClient();
        const strictEnforcement = isScanStrictEnforcementEnabled();

        // Get project
        const { data: project, error: projectError } = await supabaseAdmin
            .from('scan_projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const scanRunLimitResponse = await getScanRunPaywallForProject(user.id, id);
        if (scanRunLimitResponse) {
            return scanRunLimitResponse;
        }

        const githubAccess = await verifyProjectGithubAccess(user, project);
        if (!githubAccess) {
            return NextResponse.json(
                { error: 'GitHub access for this project is no longer authorized' },
                { status: 403 }
            );
        }

        // Create a scan run record
        const { data: scanRun, error: runError } = await supabaseAdmin
            .from('scan_runs')
            .insert({
                project_id: id,
                status: 'running',
            })
            .select()
            .single();

        if (runError || !scanRun) {
            console.error('[Scan] Error creating scan run:', runError);
            return NextResponse.json({ error: 'Failed to start scan' }, { status: 500 });
        }

        const startTime = Date.now();

        try {
            const octokit = await getInstallationOctokit(githubAccess.installationId);
            const [owner, repo] = githubAccess.repository.fullName.split('/');

            if (!owner || !repo) {
                throw new Error('Invalid repository reference');
            }

            const aiContextTracker = createRepositoryAiContextTracker({
                repository: githubAccess.repository.fullName,
            });

            const {
                allIssues: rawIssues,
                scannedFiles,
                filesScanned,
                totalCandidateFiles,
                failedFiles,
            } = await scanGithubRepository({
                octokit,
                owner,
                repo,
                shouldScanFile,
                scanFileContent,
                collectScannedFiles: true,
                onProgress: async (progress) => {
                    aiContextTracker.ingest({
                        filePath: progress.currentFile,
                        fileContent: progress.fileContent,
                        fileIssues: progress.fileIssues,
                        totals: {
                            processedFiles: progress.processedFiles,
                            totalFiles: progress.totalFiles,
                            issuesFound: progress.issuesFound,
                        },
                    });
                },
            });

            const aiContext = await aiContextTracker.finalize({
                processedFiles: filesScanned,
                totalFiles: totalCandidateFiles,
                issuesFound: rawIssues.length,
            });

            // Build file content map for the LLM filter
            const fileContentMap = new Map<string, string>(
                scannedFiles.map(f => [f.path, f.content])
            );

            // Dependency scanning — detect lockfiles and query OSV for CVEs
            const lockfiles = scannedFiles.filter(f => isLockfile(f.path));
            const depIssues = await scanDependencies(lockfiles);
            if (depIssues.length > 0) {
                rawIssues.push(...depIssues);
            }

            // LLM post-processing: filter false positives from route/vulnerability findings
            const {
                filtered: allIssues,
                suppressed: suppressedIssues,
                evaluated: llmEvaluatedIssues,
                enforced: llmEnforced,
            } = await filterIssuesWithLLM(
                rawIssues,
                fileContentMap,
                { enforce: strictEnforcement },
            );

            const scanDuration = Date.now() - startTime;
            const score = calculateScore(allIssues);
            const summary = summarizeIssues(allIssues);
            const research = analyzeRepositoryResearch({ files: scannedFiles, issues: allIssues });
            const aiInsight = await generateRepositoryAiInsight({
                repository: githubAccess.repository.fullName,
                issues: allIssues.map((issue) => ({
                    type: issue.type,
                    name: issue.name,
                    severity: issue.severity,
                    file: issue.file,
                    line: issue.line,
                    match: issue.match,
                    description: issue.description,
                })),
                research: {
                    filesIndexed: research.filesIndexed,
                    interactionHotspots: research.interactionMap.hotspots.map((hotspot) => ({
                        file: hotspot.file,
                        name: hotspot.name,
                        riskScore: hotspot.riskScore,
                        reason: hotspot.reason,
                    })),
                    dataFlowTraces: research.dataFlows.traces.map((trace) => ({
                        file: trace.file,
                        line: trace.line,
                        severity: trace.severity,
                        summary: trace.summary,
                    })),
                },
            });
            const enrichedResearch = aiInsight
                ? {
                    ...research,
                    reasoningNotes: [
                        ...research.reasoningNotes,
                        `AI summary (${aiInsight.model}): ${aiInsight.summary}`,
                        ...aiInsight.keyFindings.map((finding) => `AI finding: ${finding}`),
                    ],
                }
                : research;
            const secretsCount = summary.secrets;
            const piiCount = summary.pii;
            const vulnsCount = summary.vulnerabilities;
            const noScannableFiles = totalCandidateFiles === 0;
            const noFilesMessage = noScannableFiles
                ? 'No scannable files found in repository'
                : undefined;

            // Update scan run with results
            await supabaseAdmin
                .from('scan_runs')
                .update({
                    status: 'completed',
                    score,
                    files_scanned: filesScanned,
                    issues_found: allIssues.length,
                    scan_duration_ms: scanDuration,
                    secrets_count: secretsCount,
                    pii_count: piiCount,
                    vulnerabilities_count: vulnsCount,
                    dependencies_count: summary.dependencies,
                    fix_status: allIssues.length > 0 ? 'pending' : 'not_applicable',
                    fix_dismissed_at: null,
                    fix_pr_url: null,
                    fix_pr_number: null,
                    fix_branch_name: null,
                    fix_done_at: null,
                    results: {
                        issues: allIssues,
                        suppressed_issues: suppressedIssues,
                        raw_issue_count: rawIssues.length,
                        llm_filter: {
                            enforced: llmEnforced,
                            evaluated_issues: llmEvaluatedIssues,
                            suppressed_count: suppressedIssues.length,
                        },
                        summary,
                        research: enrichedResearch,
                        ...(aiInsight ? { ai: aiInsight } : {}),
                        ...(aiContext ? { ai_context: aiContext } : {}),
                        total_candidate_files: totalCandidateFiles,
                        failed_files: failedFiles,
                        ...(noFilesMessage ? { message: noFilesMessage } : {}),
                    },
                })
                .eq('id', scanRun.id);

            // Update project with last scan info
            await supabaseAdmin
                .from('scan_projects')
                .update({
                    last_scan_at: new Date().toISOString(),
                    last_scan_score: score,
                    last_scan_issues: allIssues.length,
                    last_scan_files: filesScanned,
                })
                .eq('id', id);

            return NextResponse.json({
                scan: {
                    id: scanRun.id,
                    status: 'completed',
                    score,
                    files_scanned: filesScanned,
                    issues_found: allIssues.length,
                    scan_duration_ms: scanDuration,
                    summary,
                    research: enrichedResearch,
                    ...(aiInsight ? { ai: aiInsight } : {}),
                    ...(aiContext ? { ai_context: aiContext } : {}),
                    issues: allIssues,
                    total_candidate_files: totalCandidateFiles,
                    failed_files: failedFiles,
                    ...(noFilesMessage ? { message: noFilesMessage } : {}),
                }
            });

        } catch (scanErr) {
            console.error('[Scan] Scan error:', scanErr);

            // Mark scan as failed
            await supabaseAdmin
                .from('scan_runs')
                .update({
                    status: 'failed',
                    error_message: scanErr instanceof Error ? scanErr.message : 'Unknown error',
                    fix_status: 'not_applicable',
                })
                .eq('id', scanRun.id);

            return NextResponse.json(
                { error: 'Scan failed', details: scanErr instanceof Error ? scanErr.message : 'Unknown error' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('[Scan] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
