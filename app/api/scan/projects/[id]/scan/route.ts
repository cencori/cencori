import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// Scanner patterns (same as analyze endpoint)
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

// File extensions to scan
const SCANNABLE_EXTENSIONS = [
    '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.java',
    '.php', '.cs', '.cpp', '.c', '.h', '.swift', '.kt', '.rs',
    '.env', '.json', '.yaml', '.yml', '.toml', '.xml', '.sh', '.bash'
];

// Files/folders to skip
const SKIP_PATHS = [
    'node_modules', '.git', 'dist', 'build', '.next', 'coverage',
    'vendor', '__pycache__', '.venv', 'venv', 'package-lock.json',
    'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'
];

function shouldScan(path: string): boolean {
    // Skip if in ignore list
    if (SKIP_PATHS.some(skip => path.includes(skip))) return false;

    // Check if has scannable extension
    return SCANNABLE_EXTENSIONS.some(ext => path.endsWith(ext));
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
            const octokit = await getInstallationOctokit(project.github_installation_id);

            // Parse owner/repo from full name
            const [owner, repo] = project.github_repo_full_name.split('/');

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
                            results: { issues: [], message: 'Repository is empty - no files to scan' },
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
                            issues: [],
                            message: 'Repository is empty - no files to scan',
                        }
                    });
                }
                throw treeError;
            }

            const allIssues: ScanIssue[] = [];
            let filesScanned = 0;

            // Filter and scan files (limit to first 100 scannable files for performance)
            const filesToScan = treeData.tree
                .filter(item => item.type === 'blob' && item.path && shouldScan(item.path))
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
                    const fileIssues = scanCode(content, file.path);
                    allIssues.push(...fileIssues);
                    filesScanned++;

                } catch (fileErr) {
                    // Skip files that can't be fetched (binary, etc)
                    console.warn(`[Scan] Could not scan file ${file.path}:`, fileErr);
                }
            }

            const scanDuration = Date.now() - startTime;
            const score = calculateScore(allIssues);

            // Count issues by type
            const secretsCount = allIssues.filter(i => i.type === 'secret').length;
            const vulnsCount = allIssues.filter(i => i.type === 'vulnerability').length;

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
                    results: { issues: allIssues },
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
