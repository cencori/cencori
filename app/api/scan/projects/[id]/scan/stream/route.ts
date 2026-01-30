import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Scanner patterns
const SECRET_PATTERNS = [
    { name: "OpenAI API Key", pattern: /sk-[a-zA-Z0-9]{20,}(?:T3BlbkFJ[a-zA-Z0-9]{20,})?/g, severity: "critical" as const },
    { name: "OpenAI Project Key", pattern: /sk-proj-[a-zA-Z0-9_-]{80,}/g, severity: "critical" as const },
    { name: "Anthropic API Key", pattern: /sk-ant-[a-zA-Z0-9_-]{40,}/g, severity: "critical" as const },
    { name: "Google AI Key", pattern: /AIza[0-9A-Za-z_-]{35}/g, severity: "critical" as const },
    { name: "AWS Access Key", pattern: /AKIA[0-9A-Z]{16}/g, severity: "critical" as const },
    { name: "GitHub Token", pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: "critical" as const },
    { name: "Stripe Secret Key", pattern: /sk_(live|test)_[0-9a-zA-Z]{24,}/g, severity: "critical" as const },
    { name: "Private Key", pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/g, severity: "critical" as const },
    { name: "Generic Secret", pattern: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: "high" as const },
];

const VULNERABILITY_PATTERNS = [
    { name: "SQL Injection", pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP).+\$\{[^}]+\}/gi, severity: "high" as const },
    { name: "XSS (innerHTML)", pattern: /\.innerHTML\s*=/g, severity: "medium" as const },
    { name: "Hardcoded Password", pattern: /password\s*[:=]\s*['"][^'"]{4,}['"]/gi, severity: "high" as const },
    { name: "eval() Usage", pattern: /\beval\s*\(/g, severity: "high" as const },
];

interface ScanIssue {
    type: string;
    severity: string;
    name: string;
    match: string;
    line: number;
    file: string;
}

function redact(match: string, showChars = 4): string {
    if (match.length <= showChars * 2) return "****";
    return match.substring(0, showChars) + "****";
}

function getLine(content: string, index: number): number {
    return content.substring(0, index).split("\n").length;
}

function scanCode(code: string, filePath: string): ScanIssue[] {
    const issues: ScanIssue[] = [];

    for (const pattern of SECRET_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(code)) !== null) {
            issues.push({
                type: "secret",
                severity: pattern.severity,
                name: pattern.name,
                match: redact(match[0]),
                line: getLine(code, match.index),
                file: filePath,
            });
        }
    }

    for (const pattern of VULNERABILITY_PATTERNS) {
        pattern.pattern.lastIndex = 0;
        let match;
        while ((match = pattern.pattern.exec(code)) !== null) {
            issues.push({
                type: "vulnerability",
                severity: pattern.severity,
                name: pattern.name,
                match: match[0].substring(0, 40),
                line: getLine(code, match.index),
                file: filePath,
            });
        }
    }

    return issues;
}

function calculateScore(issues: ScanIssue[]): "A" | "B" | "C" | "D" | "F" {
    const critical = issues.filter((i) => i.severity === "critical").length;
    const high = issues.filter((i) => i.severity === "high").length;
    const medium = issues.filter((i) => i.severity === "medium").length;

    if (critical > 0) return "F";
    if (high > 2) return "D";
    if (high > 0 || medium > 3) return "C";
    if (medium > 0) return "B";
    return "A";
}

const SCANNABLE_EXTENSIONS = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java',
    '.php', '.cs', '.cpp', '.c', '.h', '.swift', '.kt', '.rs',
    '.env', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh', '.bash'
];

const SKIP_PATHS = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    'vendor', '__pycache__', '.venv', 'venv', 'package-lock.json',
    'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
];

function shouldScan(path: string): boolean {
    if (SKIP_PATHS.some(skip => path.includes(skip))) return false;
    return SCANNABLE_EXTENSIONS.some(ext => path.endsWith(ext));
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

            const sendEvent = (event: { type: string; time: number; message?: string; data?: unknown }) => {
                allLogs.push(event);
                const data = JSON.stringify(event);
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
                const supabaseAdmin = createAdminClient();

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

                sendEvent({ type: 'info', time: Date.now() - startTime, message: 'Scan initialized', data: { scanId: scanRun.id } });

                // Connect to GitHub
                const octokit = await getInstallationOctokit(project.github_installation_id);
                sendEvent({ type: 'success', time: Date.now() - startTime, message: 'Connected to repository' });

                const [owner, repo] = project.github_repo_full_name.split('/');

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
                                results: { issues: [], message: 'Repository is empty' },
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
                    .filter(item => item.type === 'blob' && item.path && shouldScan(item.path))
                    .slice(0, 100);

                sendEvent({
                    type: 'info',
                    time: Date.now() - startTime,
                    message: `Found ${filesToScan.length} files to scan`
                });

                const allIssues: ScanIssue[] = [];
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

                        const fileIssues = scanCode(content, file.path);

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
                const secretsCount = allIssues.filter(i => i.type === 'secret').length;
                const vulnsCount = allIssues.filter(i => i.type === 'vulnerability').length;

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
                        results: { issues: allIssues },
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
                sendEvent({
                    type: 'error',
                    time: Date.now() - startTime,
                    message: error instanceof Error ? error.message : 'Scan failed'
                });
                controller.close();
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
