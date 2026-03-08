import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';
import { analyzeRepositoryResearch } from '@/lib/scan/research';
import { generateRepositoryAiInsight } from '@/lib/scan/gemini';
import { scanGithubRepository } from '@/lib/scan/repository-scan';
import { filterIssuesWithLLM, type LlmFilterWarning } from '@/lib/scan/llm-filter';
import { generateAiCodeQualityIssues } from '@/lib/scan/ai-quality';
import { scanDependencies, isLockfile } from '@/lib/scan/dependency-scanner';
import { createRepositoryAiContextTracker } from '@/lib/scan/llm-context';
import { isScanStrictEnforcementEnabled } from '@/lib/scan/policy';
import { getScanPaywallForUser, getScanRunPaywallForProject } from '@/lib/scan/entitlements';
import { persistScanContinuity } from '@/lib/scan/continuity';
import {
    calculateScore,
    scanFileContent,
    shouldScanFile,
    summarizeIssues,
} from '../../../../../../../packages/scan/src/scanner/core';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Allow up to 5 minutes — scan + LLM filter + AI insight can be slow on large repos
export const maxDuration = 300;
const RUNNING_SCAN_STALE_MS = (maxDuration + 60) * 1000;
const RUNNING_SCAN_PROGRESS_STALE_MS = 45_000;

type ScanRunRow = {
    id: string;
    created_at?: string | null;
    status: string;
    score: string | null;
    files_scanned: number | null;
    issues_found: number | null;
    scan_duration_ms: number | null;
    results?: Record<string, unknown> | null;
    error_message?: string | null;
};

type RunningScanProgress = {
    processedFiles: number;
    totalFiles: number;
    currentFile: string | null;
    issuesFound: number;
    updatedAt: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function asArray<T = unknown>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function asNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
}

function getAgeMs(timestamp: string | null | undefined): number | null {
    if (!timestamp) return null;
    const parsed = Date.parse(timestamp);
    if (!Number.isFinite(parsed)) return null;
    return Date.now() - parsed;
}

function getRunningScanProgress(scanRun: ScanRunRow): RunningScanProgress | null {
    const results = asRecord(scanRun.results);
    const progress = asRecord(results?.progress);
    if (!progress) return null;

    return {
        processedFiles: asNumber(progress.processedFiles),
        totalFiles: asNumber(progress.totalFiles),
        currentFile: asString(progress.currentFile),
        issuesFound: asNumber(progress.issuesFound),
        updatedAt: asString(progress.updatedAt),
    };
}

function buildResumeProgressMessage(progress: RunningScanProgress | null): string {
    if (progress && progress.totalFiles > 0) {
        return `Still scanning... (${progress.processedFiles}/${progress.totalFiles} files)`;
    }
    return 'Waiting for the active scan to report progress...';
}

function buildCompletePayloadFromRun(scanRun: ScanRunRow): Record<string, unknown> {
    const results = asRecord(scanRun.results) ?? {};
    const issues = asArray(results.issues);
    const summary = asRecord(results.summary) ?? null;
    const research = asRecord(results.research) ?? null;
    const aiContext = asRecord(results.ai_context) ?? null;

    return {
        scanId: scanRun.id,
        score: scanRun.score,
        filesScanned: asNumber(scanRun.files_scanned),
        issuesFound: asNumber(scanRun.issues_found, issues.length),
        scanDurationMs: asNumber(scanRun.scan_duration_ms),
        summary,
        research,
        aiContext,
        issues,
    };
}

function toUserFacingErrorMessage(rawMessage: string): string {
    if (
        rawMessage.includes('[LLM Filter]') ||
        rawMessage.includes('Invalid AI response format') ||
        rawMessage.includes('No AI provider response')
    ) {
        return 'AI validation fallback triggered. Findings were kept for safety.';
    }
    return rawMessage;
}

function summarizeLlmWarnings(warnings: LlmFilterWarning[]): string | null {
    if (warnings.length === 0) {
        return null;
    }

    const hasInvalidFormat = warnings.some((warning) => warning.code === 'invalid_format');
    if (hasInvalidFormat) {
        return 'AI validator returned unexpected output for some files; findings were kept for safety.';
    }

    const hasProviderUnavailable = warnings.some((warning) => warning.code === 'provider_unavailable');
    if (hasProviderUnavailable) {
        return 'AI validator was temporarily unavailable for some files; findings were kept for safety.';
    }

    return 'AI validator fell back to safe mode for some files; findings were kept for safety.';
}

// GET /api/scan/projects/[id]/scan/stream - Stream scan events via SSE
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const requestUrl = new URL(req.url);
    const reconnectMode = requestUrl.searchParams.get('reconnect') === '1';
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

    if (!reconnectMode) {
        const scanRunLimitResponse = await getScanRunPaywallForProject(user.id, id);
        if (scanRunLimitResponse) {
            return scanRunLimitResponse;
        }
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
            let streamClosed = false;
            let heartbeat: ReturnType<typeof setInterval> | null = null;

            const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

            const sendEvent = (event: { type: string; time: number; message?: string; data?: unknown }) => {
                if (streamClosed) return;
                allLogs.push(event);
                const data = JSON.stringify(event);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            const closeStream = () => {
                if (streamClosed) return;
                streamClosed = true;
                if (heartbeat) {
                    clearInterval(heartbeat);
                    heartbeat = null;
                }
                try {
                    controller.close();
                } catch {
                    // no-op if stream already closed
                }
            };

            const safeSendEvent = (event: { type: string; time: number; message?: string; data?: unknown }) => {
                try {
                    sendEvent(event);
                    return true;
                } catch {
                    allLogs.push(event);
                    closeStream();
                    return false;
                }
            };

            const markScanRunFailed = async (existingScanRunId: string, errorMessage: string) => {
                try {
                    await supabaseAdmin
                        .from('scan_runs')
                        .update({
                            status: 'failed',
                            error_message: errorMessage,
                            fix_status: 'not_applicable',
                        })
                        .eq('id', existingScanRunId);
                } catch (persistError) {
                    console.error('[Scan Stream] Failed to mark stale scan as failed:', persistError);
                }
            };

            const streamScanRunStatus = async (existingScanRunId: string, reconnectLabel: string) => {
                safeSendEvent({
                    type: 'info',
                    time: Date.now() - startTime,
                    message: reconnectLabel,
                    data: { scanId: existingScanRunId },
                });

                let lastProgressEventAt = 0;
                while (!streamClosed) {
                    const { data: scanRunSnapshot, error: scanRunSnapshotError } = await supabaseAdmin
                        .from('scan_runs')
                        .select('id,created_at,status,score,files_scanned,issues_found,scan_duration_ms,error_message,results')
                        .eq('id', existingScanRunId)
                        .single();

                    if (scanRunSnapshotError || !scanRunSnapshot) {
                        safeSendEvent({
                            type: 'error',
                            time: Date.now() - startTime,
                            message: 'Unable to resume scan stream. Please run scan again.',
                        });
                        break;
                    }

                    const runningProgress = getRunningScanProgress(scanRunSnapshot as ScanRunRow);
                    const progressAgeMs = getAgeMs(runningProgress?.updatedAt);
                    const runAgeMs = getAgeMs((scanRunSnapshot as ScanRunRow).created_at);
                    const isProgressStale = progressAgeMs !== null && progressAgeMs > RUNNING_SCAN_PROGRESS_STALE_MS;
                    const isRunStale = progressAgeMs === null && runAgeMs !== null && runAgeMs > RUNNING_SCAN_STALE_MS;

                    if (scanRunSnapshot.status === 'running' && (isProgressStale || isRunStale)) {
                        const staleMessage = 'Scan stalled before completion. Start a fresh scan.';
                        await markScanRunFailed(existingScanRunId, staleMessage);
                        safeSendEvent({
                            type: 'error',
                            time: Date.now() - startTime,
                            message: staleMessage,
                        });
                        break;
                    }

                    if (scanRunSnapshot.status === 'completed') {
                        safeSendEvent({
                            type: 'complete',
                            time: Date.now() - startTime,
                            message: `Scan complete: ${scanRunSnapshot.files_scanned ?? 0} files scanned, ${scanRunSnapshot.issues_found ?? 0} issues found`,
                            data: buildCompletePayloadFromRun(scanRunSnapshot as ScanRunRow),
                        });
                        break;
                    }

                    if (scanRunSnapshot.status === 'failed') {
                        safeSendEvent({
                            type: 'error',
                            time: Date.now() - startTime,
                            message: toUserFacingErrorMessage(
                                scanRunSnapshot.error_message || 'Scan failed while reconnecting to stream'
                            ),
                        });
                        break;
                    }

                    const now = Date.now();
                    if (now - lastProgressEventAt > 5000) {
                        safeSendEvent({
                            type: 'progress',
                            time: now - startTime,
                            message: buildResumeProgressMessage(runningProgress),
                            data: {
                                scanId: existingScanRunId,
                                ...(runningProgress ? {
                                    processedFiles: runningProgress.processedFiles,
                                    totalFiles: runningProgress.totalFiles,
                                    currentFile: runningProgress.currentFile,
                                    issuesFound: runningProgress.issuesFound,
                                } : {}),
                            },
                        });
                        lastProgressEventAt = now;
                    }

                    await sleep(1500);
                }

                closeStream();
            };

            heartbeat = setInterval(() => {
                if (streamClosed) return;
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                    closeStream();
                }
            }, 25000);

            const onAbort = () => {
                closeStream();
            };
            req.signal.addEventListener('abort', onAbort);

            try {
                const { data: activeScanRun } = await supabaseAdmin
                    .from('scan_runs')
                    .select('id,created_at,status,results')
                    .eq('project_id', id)
                    .eq('status', 'running')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (activeScanRun?.id) {
                    const runningProgress = getRunningScanProgress(activeScanRun as ScanRunRow);
                    const progressAgeMs = getAgeMs(runningProgress?.updatedAt);
                    const runAgeMs = getAgeMs((activeScanRun as ScanRunRow).created_at);
                    const isProgressStale = progressAgeMs !== null && progressAgeMs > RUNNING_SCAN_PROGRESS_STALE_MS;
                    const isRunStale = progressAgeMs === null && runAgeMs !== null && runAgeMs > RUNNING_SCAN_STALE_MS;

                    if (isProgressStale || isRunStale) {
                        safeSendEvent({
                            type: 'info',
                            time: Date.now() - startTime,
                            message: 'Previous running scan appears stalled. Resetting state...',
                        });
                        await markScanRunFailed(activeScanRun.id, 'Scan stalled before completion. Start a fresh scan.');
                    } else {
                        await streamScanRunStatus(
                            activeScanRun.id,
                            reconnectMode
                                ? 'Resuming the active scan...'
                                : 'Another scan is already running for this project. Attaching to its live log...'
                        );
                        return;
                    }
                }

                if (reconnectMode) {
                    const { data: latestScanRun } = await supabaseAdmin
                        .from('scan_runs')
                        .select('id,status,score,files_scanned,issues_found,scan_duration_ms,error_message,results')
                        .eq('project_id', id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (latestScanRun?.status === 'completed') {
                        safeSendEvent({
                            type: 'complete',
                            time: Date.now() - startTime,
                            message: `Scan complete: ${latestScanRun.files_scanned ?? 0} files scanned, ${latestScanRun.issues_found ?? 0} issues found`,
                            data: buildCompletePayloadFromRun(latestScanRun as ScanRunRow),
                        });
                    } else if (latestScanRun?.status === 'failed') {
                        safeSendEvent({
                            type: 'error',
                            time: Date.now() - startTime,
                            message: toUserFacingErrorMessage(latestScanRun.error_message || 'Scan failed'),
                        });
                    } else {
                        safeSendEvent({
                            type: 'error',
                            time: Date.now() - startTime,
                            message: 'Unable to resume scan stream. Please run scan again.',
                        });
                    }
                    closeStream();
                    return;
                }

                // Send initial event
                sendEvent({ type: 'start', time: 0, message: 'Starting security + code quality scan...' });

                // Create scan run record
                const { data: scanRun, error: runError } = await supabaseAdmin
                    .from('scan_runs')
                    .insert({
                        project_id: id,
                        status: 'running',
                    })
                    .select('id')
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
                let lastPersistedProgressUpdate = 0;
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

                        if (
                            progress.processedFiles === progress.totalFiles ||
                            progress.processedFiles % 10 === 0 ||
                            now - lastPersistedProgressUpdate > 4000
                        ) {
                            try {
                                await supabaseAdmin
                                    .from('scan_runs')
                                    .update({
                                        files_scanned: progress.processedFiles,
                                        issues_found: progress.issuesFound,
                                        scan_duration_ms: now - startTime,
                                        results: {
                                            progress: {
                                                processedFiles: progress.processedFiles,
                                                totalFiles: progress.totalFiles,
                                                currentFile: progress.currentFile,
                                                issuesFound: progress.issuesFound,
                                                updatedAt: new Date(now).toISOString(),
                                            },
                                        },
                                    })
                                    .eq('id', scanRun.id);
                                lastPersistedProgressUpdate = now;
                            } catch (persistProgressError) {
                                console.error('[Scan Stream] Failed to persist running scan progress:', persistProgressError);
                            }
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
                    filtered: filteredIssues,
                    suppressed: suppressedIssues,
                    evaluated: llmEvaluatedIssues,
                    enforced: llmEnforced,
                    warnings: llmWarnings,
                } = await filterIssuesWithLLM(rawIssues, fileContentMap, { enforce: strictEnforcement });
                let allIssues = filteredIssues;

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
                const llmWarningSummary = summarizeLlmWarnings(llmWarnings);
                if (llmWarningSummary) {
                    sendEvent({
                        type: 'info',
                        time: Date.now() - startTime,
                        message: llmWarningSummary,
                        data: {
                            warningCount: llmWarnings.length,
                            warnings: llmWarnings,
                        },
                    });
                }

                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Running AI code-quality review...' });
                const aiCodeQuality = await generateAiCodeQualityIssues({
                    repository: githubAccess.repository.fullName,
                    scannedFiles,
                    existingIssues: allIssues,
                });
                if (aiCodeQuality.warning) {
                    sendEvent({
                        type: 'info',
                        time: Date.now() - startTime,
                        message: aiCodeQuality.warning,
                    });
                }
                if (aiCodeQuality.issues.length > 0) {
                    allIssues = [...allIssues, ...aiCodeQuality.issues];
                    sendEvent({
                        type: 'success',
                        time: Date.now() - startTime,
                        message: `AI code-quality review added ${aiCodeQuality.issues.length} issue(s)`,
                        data: {
                            addedCount: aiCodeQuality.issues.length,
                            evaluatedFiles: aiCodeQuality.evaluatedFiles,
                            ...(aiCodeQuality.provider ? { provider: aiCodeQuality.provider } : {}),
                            ...(aiCodeQuality.model ? { model: aiCodeQuality.model } : {}),
                        },
                    });
                }

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
                        projectBrief: {
                            summary: research.projectBrief.summary,
                            appPurpose: research.projectBrief.appPurpose,
                            authModel: research.projectBrief.authModel,
                            deploymentShape: research.projectBrief.deploymentShape,
                            trustBoundaries: research.projectBrief.trustBoundaries,
                            sensitiveFlows: research.projectBrief.sensitiveFlows,
                            criticalModules: research.projectBrief.criticalModules,
                        },
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
                                warnings: llmWarnings,
                            },
                            ai_code_quality: {
                                enabled: true,
                                evaluated_files: aiCodeQuality.evaluatedFiles,
                                added_count: aiCodeQuality.issues.length,
                                ...(aiCodeQuality.provider ? { provider: aiCodeQuality.provider } : {}),
                                ...(aiCodeQuality.model ? { model: aiCodeQuality.model } : {}),
                                ...(aiCodeQuality.warning ? { warning: aiCodeQuality.warning } : {}),
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

                try {
                    await persistScanContinuity({
                        projectId: id,
                        userId: user.id,
                        repository: githubAccess.repository.fullName,
                        scanRunId: scanRun.id,
                        score,
                        issues: allIssues,
                        summary,
                        research: enrichedResearch,
                        supabase: supabaseAdmin,
                    });
                } catch (continuityError) {
                    console.error('[Scan Stream] Failed to persist continuity memory:', continuityError);
                }

                closeStream();

            } catch (error) {
                console.error('[Scan Stream] Error:', error);
                const technicalErrorMessage = error instanceof Error ? error.message : 'Scan failed';
                const errorMessage = toUserFacingErrorMessage(technicalErrorMessage);
                const errorEvent = {
                    type: 'error',
                    time: Date.now() - startTime,
                    message: errorMessage,
                } as const;

                safeSendEvent(errorEvent);

                if (scanRunId) {
                    try {
                        await supabaseAdmin
                            .from('scan_runs')
                            .update({
                                status: 'failed',
                                error_message: technicalErrorMessage,
                                scan_duration_ms: Date.now() - startTime,
                                fix_status: 'not_applicable',
                                logs: allLogs,
                            })
                            .eq('id', scanRunId);
                    } catch (persistError) {
                        console.error('[Scan Stream] Failed to persist failed scan status:', persistError);
                    }
                }
            } finally {
                req.signal.removeEventListener('abort', onAbort);
                closeStream();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
