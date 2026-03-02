import { NextRequest } from 'next/server';
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
} from '../../../../../../../packages/scan/src/scanner/core';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/scan/projects/[id]/scan/stream - Stream scan events via SSE
export async function GET(_req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const paywallResponse = await getScanPaywallForUser(user.id);
    if (paywallResponse) {
        return paywallResponse;
    }

    const supabaseAdmin = createAdminClient();
    const { data: project, error: projectError } = await supabaseAdmin
        .from('scan_projects')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

    if (projectError || !project) {
        return new Response(JSON.stringify({ error: 'Project not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const scanRunLimitResponse = await getScanRunPaywallForProject(user.id, id);
    if (scanRunLimitResponse) {
        return scanRunLimitResponse;
    }

    const githubAccess = await verifyProjectGithubAccess(user, project);
    if (!githubAccess) {
        return new Response(JSON.stringify({ error: 'GitHub access for this project is no longer authorized' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const encoder = new TextEncoder();
    const startTime = Date.now();

    const stream = new ReadableStream({
        async start(controller) {
            // Accumulate all logs for persistence
            const allLogs: Array<{ type: string; time: number; message?: string; data?: unknown }> = [];
            const strictEnforcement = isScanStrictEnforcementEnabled();
            let scanRunId: string | null = null;

            const sendEvent = (event: { type: string; time: number; message?: string; data?: unknown }) => {
                allLogs.push(event);
                const data = JSON.stringify(event);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                // Send initial event
                sendEvent({ type: 'start', time: 0, message: 'Starting security scan...' });

                // Create scan run record
                const { data: scanRun, error: runError } = await supabaseAdmin
                    .from('scan_runs')
                    .insert({
                        project_id: id,
                        status: 'running',
                    })
                    .select()
                    .single();

                if (runError || !scanRun) {
                    sendEvent({ type: 'error', time: Date.now() - startTime, message: 'Failed to start scan' });
                    controller.close();
                    return;
                }
                scanRunId = scanRun.id;

                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Scan initialized', data: { scanId: scanRun.id } });

                // Connect to GitHub
                const octokit = await getInstallationOctokit(githubAccess.installationId);
                sendEvent({ type: 'success', time: Date.now() - startTime, message: 'Connected to repository' });

                const [owner, repo] = githubAccess.repository.fullName.split('/');
                if (!owner || !repo) {
                    throw new Error('Invalid repository reference');
                }

                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Indexing repository tree...' });

                const aiContextTracker = createRepositoryAiContextTracker({
                    repository: githubAccess.repository.fullName,
                    onUpdate: async (contextUpdate) => {
                        sendEvent({
                            type: 'ai_context',
                            time: Date.now() - startTime,
                            message: contextUpdate.summary,
                            data: contextUpdate,
                        });
                    },
                });

                if (aiContextTracker.isEnabled) {
                    sendEvent({
                        type: 'info',
                        time: Date.now() - startTime,
                        message: 'Running live AI context scan in parallel...',
                    });
                }

                let lastProgressUpdate = 0;
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

                        if (progress.fileIssues.length > 0) {
                            sendEvent({
                                type: 'issue',
                                time: Date.now() - startTime,
                                message: `Found ${progress.fileIssues.length} issue(s) in ${progress.currentFile}`,
                                data: { file: progress.currentFile, issues: progress.fileIssues }
                            });
                        }

                        const now = Date.now();
                        if (progress.processedFiles === 1) {
                            sendEvent({
                                type: 'info',
                                time: now - startTime,
                                message: `Found ${progress.totalFiles} files to scan`,
                            });
                        }

                        if (
                            progress.processedFiles === progress.totalFiles ||
                            progress.processedFiles % 10 === 0 ||
                            now - lastProgressUpdate > 2000
                        ) {
                            sendEvent({
                                type: 'progress',
                                time: now - startTime,
                                message: `Scanning... (${progress.processedFiles}/${progress.totalFiles} files)`,
                                data: {
                                    filesScanned: progress.scannedFiles,
                                    processedFiles: progress.processedFiles,
                                    totalFiles: progress.totalFiles,
                                    currentFile: progress.currentFile,
                                    issuesFound: progress.issuesFound,
                                    failedFiles: progress.failedFiles,
                                }
                            });
                            lastProgressUpdate = now;
                        }
                    },
                });

                const aiContext = await aiContextTracker.finalize({
                    processedFiles: filesScanned,
                    totalFiles: totalCandidateFiles,
                    issuesFound: rawIssues.length,
                });

                if (aiContext) {
                    sendEvent({
                        type: 'success',
                        time: Date.now() - startTime,
                        message: `AI context scan complete (${aiContext.snapshotsAnalyzed} snapshot${aiContext.snapshotsAnalyzed === 1 ? '' : 's'})`,
                    });
                }

                const fileContentMap = new Map<string, string>(
                    scannedFiles.map(file => [file.path, file.content])
                );

                // Dependency scanning — detect lockfiles and query OSV for CVEs
                const lockfiles = scannedFiles.filter(f => isLockfile(f.path));
                if (lockfiles.length > 0) {
                    sendEvent({ type: 'info', time: Date.now() - startTime, message: `Found ${lockfiles.length} lockfile(s), scanning dependencies...` });
                    const depIssues = await scanDependencies(lockfiles);
                    if (depIssues.length > 0) {
                        rawIssues.push(...depIssues);
                        sendEvent({
                            type: 'info',
                            time: Date.now() - startTime,
                            message: `Found ${depIssues.length} vulnerable dependenc${depIssues.length === 1 ? 'y' : 'ies'}`,
                        });
                    } else {
                        sendEvent({ type: 'success', time: Date.now() - startTime, message: 'No vulnerable dependencies found' });
                    }
                }

                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Running LLM false-positive filter...' });

                const {
                    filtered: allIssues,
                    suppressed: suppressedIssues,
                    evaluated: llmEvaluatedIssues,
                    enforced: llmEnforced,
                } = await filterIssuesWithLLM(rawIssues, fileContentMap, { enforce: strictEnforcement });

                sendEvent({
                    type: 'success',
                    time: Date.now() - startTime,
                    message: `LLM filter complete: ${suppressedIssues.length} issue(s) suppressed`,
                    data: {
                        evaluatedIssues: llmEvaluatedIssues,
                        rawIssueCount: rawIssues.length,
                        filteredIssueCount: allIssues.length,
                    },
                });

                if (totalCandidateFiles === 0) {
                    sendEvent({
                        type: 'info',
                        time: Date.now() - startTime,
                        message: 'No scannable files found in repository',
                    });
                }

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
                const noFilesMessage = noScannableFiles ? 'No scannable files found in repository' : undefined;

                // Send completion event first (so it gets logged)
                sendEvent({
                    type: 'complete',
                    time: scanDuration,
                    message: `Scan complete: ${filesScanned} files scanned, ${allIssues.length} issues found`,
                    data: {
                        scanId: scanRun.id,
                        score,
                        filesScanned,
                        issuesFound: allIssues.length,
                        secretsCount,
                        piiCount,
                        vulnerabilitiesCount: vulnsCount,
                        scanDurationMs: scanDuration,
                        summary,
                        research: enrichedResearch,
                        ...(aiInsight ? { ai: aiInsight } : {}),
                        ...(aiContext ? { aiContext } : {}),
                        issues: allIssues,
                        rawIssueCount: rawIssues.length,
                        suppressedIssueCount: suppressedIssues.length,
                        totalCandidateFiles,
                        failedFiles,
                        ...(noFilesMessage ? { message: noFilesMessage } : {}),
                    }
                });

                // Save results with full logs
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
                        logs: allLogs,
                    })
                    .eq('id', scanRun.id);

                await supabaseAdmin
                    .from('scan_projects')
                    .update({
                        last_scan_at: new Date().toISOString(),
                        last_scan_score: score,
                        last_scan_issues: allIssues.length,
                        last_scan_files: filesScanned,
                    })
                    .eq('id', id);

                controller.close();

            } catch (error) {
                console.error('[Scan Stream] Error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Scan failed';
                const errorEvent = {
                    type: 'error',
                    time: Date.now() - startTime,
                    message: errorMessage,
                } as const;

                try {
                    sendEvent(errorEvent);
                } catch {
                    // Stream may already be closed; keep the error in persisted logs.
                    allLogs.push(errorEvent);
                }

                if (scanRunId) {
                    try {
                        await supabaseAdmin
                            .from('scan_runs')
                            .update({
                                status: 'failed',
                                error_message: errorMessage,
                                scan_duration_ms: Date.now() - startTime,
                                fix_status: 'not_applicable',
                                logs: allLogs,
                            })
                            .eq('id', scanRunId);
                    } catch (persistError) {
                        console.error('[Scan Stream] Failed to persist failed scan status:', persistError);
                    }
                }

                try {
                    controller.close();
                } catch {
                    // no-op if stream already closed
                }
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
