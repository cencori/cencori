import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { verifyProjectGithubAccess } from '@/lib/scan/github-access';
import { analyzeRepositoryResearch } from '@/lib/scan/research';
import {
    calculateScore,
    scanFileContent,
    shouldScanFile,
    summarizeIssues,
    type ScanIssue,
} from '../../../../../../../packages/scan/src/scanner/core';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/scan/projects/[id]/scan/stream - Stream scan events via SSE
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const encoder = new TextEncoder();
    const startTime = Date.now();

    const stream = new ReadableStream({
        async start(controller) {
            // Accumulate all logs for persistence
            const allLogs: Array<{ type: string; time: number; message?: string; data?: unknown }> = [];
            const supabaseAdmin = createAdminClient();
            let scanRunId: string | null = null;

            const sendEvent = (event: { type: string; time: number; message?: string; data?: unknown }) => {
                allLogs.push(event);
                const data = JSON.stringify(event);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                // Send initial event
                sendEvent({ type: 'start', time: 0, message: 'Starting security scan...' });

                // Get project
                const { data: project, error: projectError } = await supabaseAdmin
                    .from('scan_projects')
                    .select('*')
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .single();

                if (projectError || !project) {
                    sendEvent({ type: 'error', time: Date.now() - startTime, message: 'Project not found' });
                    controller.close();
                    return;
                }

                const githubAccess = await verifyProjectGithubAccess(user, project);
                if (!githubAccess) {
                    sendEvent({
                        type: 'error',
                        time: Date.now() - startTime,
                        message: 'GitHub access for this project is no longer authorized',
                    });
                    controller.close();
                    return;
                }

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

                // Get repository tree
                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Fetching file tree...' });

                let treeData;
                try {
                    const response = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
                        owner,
                        repo,
                        tree_sha: 'HEAD',
                        recursive: '1',
                    });
                    treeData = response.data;
                } catch (treeError: unknown) {
                    if (treeError && typeof treeError === 'object' && 'status' in treeError && treeError.status === 409) {
                        const emptySummary = summarizeIssues([]);
                        const emptyResearch = analyzeRepositoryResearch({ files: [], issues: [] });
                        sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Repository is empty - no files to scan' });
                        sendEvent({
                            type: 'complete',
                            time: Date.now() - startTime,
                            message: 'Scan completed',
                            data: {
                                scanId: scanRun.id,
                                score: 'A',
                                filesScanned: 0,
                                issuesFound: 0,
                                summary: emptySummary,
                                research: emptyResearch,
                                issues: []
                            }
                        });

                        // Save logs for empty repo
                        await supabaseAdmin
                            .from('scan_runs')
                            .update({
                                status: 'completed',
                                score: 'A',
                                files_scanned: 0,
                                issues_found: 0,
                                scan_duration_ms: Date.now() - startTime,
                                secrets_count: 0,
                                vulnerabilities_count: 0,
                                results: {
                                    issues: [],
                                    summary: emptySummary,
                                    research: emptyResearch,
                                    message: 'Repository is empty',
                                },
                                logs: allLogs,
                            })
                            .eq('id', scanRun.id);

                        await supabaseAdmin
                            .from('scan_projects')
                            .update({
                                last_scan_at: new Date().toISOString(),
                                last_scan_score: 'A',
                                last_scan_issues: 0,
                                last_scan_files: 0,
                            })
                            .eq('id', id);

                        controller.close();
                        return;
                    }
                    throw treeError;
                }

                // Filter scannable files
                const filesToScan = treeData.tree
                    .filter(item => item.type === 'blob' && item.path && shouldScanFile(item.path))
                    .slice(0, 100);

                sendEvent({
                    type: 'info',
                    time: Date.now() - startTime,
                    message: `Found ${filesToScan.length} files to scan`
                });

                const allIssues: ScanIssue[] = [];
                const scannedFiles: Array<{ path: string; content: string }> = [];
                let filesScanned = 0;
                let lastProgressUpdate = 0;

                // Scan files
                for (let i = 0; i < filesToScan.length; i++) {
                    const file = filesToScan[i];
                    if (!file.path || !file.sha) continue;

                    try {
                        const { data: blobData } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
                            owner,
                            repo,
                            file_sha: file.sha,
                        });

                        const content = Buffer.from(blobData.content, 'base64').toString('utf-8');
                        if (content.length > 500000) continue;

                        const fileIssues = scanFileContent(file.path, content);
                        scannedFiles.push({ path: file.path, content });

                        // If issues found, report them immediately
                        if (fileIssues.length > 0) {
                            allIssues.push(...fileIssues);
                            sendEvent({
                                type: 'issue',
                                time: Date.now() - startTime,
                                message: `Found ${fileIssues.length} issue(s) in ${file.path}`,
                                data: { file: file.path, issues: fileIssues }
                            });
                        }

                        filesScanned++;

                        // Send progress update every 10 files or every 2 seconds
                        const now = Date.now();
                        if (filesScanned % 10 === 0 || now - lastProgressUpdate > 2000) {
                            sendEvent({
                                type: 'progress',
                                time: now - startTime,
                                message: `Scanning... (${filesScanned}/${filesToScan.length} files)`,
                                data: {
                                    filesScanned,
                                    totalFiles: filesToScan.length,
                                    currentFile: file.path,
                                    issuesFound: allIssues.length
                                }
                            });
                            lastProgressUpdate = now;
                        }

                    } catch {
                        // Skip files that can't be fetched
                    }
                }

                const scanDuration = Date.now() - startTime;
                const score = calculateScore(allIssues);
                const summary = summarizeIssues(allIssues);
                const research = analyzeRepositoryResearch({ files: scannedFiles, issues: allIssues });
                const secretsCount = summary.secrets;
                const vulnsCount = summary.vulnerabilities;

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
                        vulnerabilitiesCount: vulnsCount,
                        scanDurationMs: scanDuration,
                        summary,
                        research,
                        issues: allIssues
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
                        vulnerabilities_count: vulnsCount,
                        results: { issues: allIssues, summary, research },
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
