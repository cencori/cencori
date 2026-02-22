import { NextRequest, NextResponse } from 'next/server';
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
} from '../../../../../../packages/scan/src/scanner/core';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/scan/projects/[id]/scan - Run a scan on the project
export async function POST(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();

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
            // Get GitHub octokit for the installation
            const octokit = await getInstallationOctokit(githubAccess.installationId);

            // Parse owner/repo from full name
            const [owner, repo] = githubAccess.repository.fullName.split('/');

            if (!owner || !repo) {
                throw new Error('Invalid repository reference');
            }

            // Get repository tree (all files)
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
                // Handle empty repository (409 Conflict)
                if (treeError && typeof treeError === 'object' && 'status' in treeError && treeError.status === 409) {
                    console.log('[Scan] Repository is empty, no files to scan');

                    // Update scan run with empty results
                    const emptySummary = summarizeIssues([]);
                    const emptyResearch = analyzeRepositoryResearch({ files: [], issues: [] });
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
                                message: 'Repository is empty - no files to scan',
                            },
                        })
                        .eq('id', scanRun.id);

                    // Update project
                    await supabaseAdmin
                        .from('scan_projects')
                        .update({
                            last_scan_at: new Date().toISOString(),
                            last_scan_score: 'A',
                            last_scan_issues: 0,
                            last_scan_files: 0,
                        })
                        .eq('id', id);

                    return NextResponse.json({
                        scan: {
                            id: scanRun.id,
                            status: 'completed',
                            score: 'A',
                            files_scanned: 0,
                            issues_found: 0,
                            scan_duration_ms: Date.now() - startTime,
                            summary: emptySummary,
                            research: emptyResearch,
                            issues: [],
                            message: 'Repository is empty - no files to scan',
                        }
                    });
                }
                throw treeError;
            }

            const allIssues: ScanIssue[] = [];
            const scannedFiles: Array<{ path: string; content: string }> = [];
            let filesScanned = 0;

            // Filter and scan files (limit to first 100 scannable files for performance)
            const filesToScan = treeData.tree
                .filter(item => item.type === 'blob' && item.path && shouldScanFile(item.path))
                .slice(0, 100);

            for (const file of filesToScan) {
                if (!file.path || !file.sha) continue;

                try {
                    // Fetch file content
                    const { data: blobData } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
                        owner,
                        repo,
                        file_sha: file.sha,
                    });

                    // Decode base64 content
                    const content = Buffer.from(blobData.content, 'base64').toString('utf-8');

                    // Skip very large files (> 500KB)
                    if (content.length > 500000) continue;

                    // Scan the file
                    const fileIssues = scanFileContent(file.path, content);
                    allIssues.push(...fileIssues);
                    scannedFiles.push({ path: file.path, content });
                    filesScanned++;

                } catch (fileErr) {
                    // Skip files that can't be fetched (binary, etc)
                    console.warn(`[Scan] Could not scan file ${file.path}:`, fileErr);
                }
            }

            const scanDuration = Date.now() - startTime;
            const score = calculateScore(allIssues);
            const summary = summarizeIssues(allIssues);
            const research = analyzeRepositoryResearch({ files: scannedFiles, issues: allIssues });
            const secretsCount = summary.secrets;
            const vulnsCount = summary.vulnerabilities;

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
                    vulnerabilities_count: vulnsCount,
                    results: { issues: allIssues, summary, research },
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
                    research,
                    issues: allIssues,
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
