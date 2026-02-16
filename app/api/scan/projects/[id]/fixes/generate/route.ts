import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';
import { randomUUID } from 'crypto';

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
}

interface ScanIssue {
    type: string;
    severity: string;
    name: string;
    match: string;
    line: number;
    file: string;
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
        case 'Google AI Key':
        case 'AWS Access Key':
        case 'GitHub Token':
        case 'Stripe Secret Key':
        case 'Generic Secret':
        case 'Hardcoded Password': {
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

        case 'XSS (innerHTML)': {
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

        case 'eval() Usage':
        case 'SQL Injection':
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

// ─── AI Fix Generation (batched, with timeout) ──────────────────────────

interface AIFixInput {
    issue: ScanIssue;
    snippet: string;
}

async function generateAIFixesBatched(
    inputs: AIFixInput[]
): Promise<Map<string, { fixedCode: string; explanation: string }>> {
    const results = new Map<string, { fixedCode: string; explanation: string }>();

    if (inputs.length === 0) return results;

    try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log('[Fix Gen] No Google AI API key found, skipping AI fixes');
            return results;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        // Build a single prompt for ALL issues
        const issueDescriptions = inputs.map((input, idx) => `
--- Issue ${idx + 1} ---
ID: issue_${idx}
Type: ${input.issue.type}
Name: ${input.issue.name}
Severity: ${input.issue.severity}
File: ${input.issue.file}:${input.issue.line}
Code:
\`\`\`
${input.snippet}
\`\`\`
`).join('\n');

        const prompt = `You are a security engineer fixing code vulnerabilities. Fix ALL ${inputs.length} issues below.

IMPORTANT: Respond ONLY with a valid JSON array. Each element must have this exact shape:
{"id": "issue_0", "fixedCode": "the complete fixed code snippet", "explanation": "brief explanation"}

Rules:
- For hardcoded secrets: Replace with environment variables (process.env.VAR_NAME)
- For XSS: Add proper escaping/sanitization
- For SQL injection: Use parameterized queries
- For eval(): Replace with safer alternatives (JSON.parse, etc.)
- Keep the same code structure, only fix the security issue
- Return the COMPLETE snippet with the fix applied

${issueDescriptions}

Respond with JSON array only, no markdown fences.`;

        console.log(`[Fix Gen] Sending batched AI request for ${inputs.length} issues...`);
        const startTime = Date.now();

        // Race against a 30-second timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI fix generation timed out after 30s')), 30000)
        );

        const result = await Promise.race([
            model.generateContent(prompt),
            timeoutPromise,
        ]);

        const elapsed = Date.now() - startTime;
        console.log(`[Fix Gen] AI response received in ${elapsed}ms`);

        const text = result.response.text();

        // Extract JSON from response
        let jsonStr = text.trim();
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr);
        const fixArray = Array.isArray(parsed) ? parsed : [parsed];

        for (const fix of fixArray) {
            const id = fix.id || fix.ID;
            const fixedCode = fix.fixedCode || fix.fixed_code;
            if (id && fixedCode) {
                results.set(id, {
                    fixedCode,
                    explanation: fix.explanation || 'AI-generated security fix',
                });
            }
        }

        console.log(`[Fix Gen] Parsed ${results.size} AI fixes from response`);
    } catch (error) {
        console.error('[Fix Gen] Batched AI fix failed:', error instanceof Error ? error.message : error);
    }

    return results;
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

    console.log(`[Fix Gen] User ${user.id} authenticated`);

    const body = await req.json();
    const { scanRunId } = body;

    if (!scanRunId) {
        console.log('[Fix Gen] Missing scanRunId in request body');
        return NextResponse.json({ error: 'scanRunId is required' }, { status: 400 });
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
    console.log(`[Fix Gen] Found ${issues.length} issues from scan run`);

    if (issues.length === 0) {
        console.log('[Fix Gen] No issues to fix');
        return NextResponse.json({ fixes: [], message: 'No issues to fix' });
    }

    // ─── Fetch file contents in PARALLEL ────────────────────────────
    const octokit = await getInstallationOctokit(project.github_installation_id);
    const [owner, repo] = project.github_repo_full_name.split('/');

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

    // ─── Phase 1: Deterministic fixes (instant) ─────────────────────
    const fixes: FixProposal[] = [];
    const aiInputs: AIFixInput[] = [];

    for (const issue of issues) {
        const fileContent = fileContents.get(issue.file);
        if (!fileContent) {
            console.log(`[Fix Gen]   Skipping ${issue.name} in ${issue.file} — no file content`);
            continue;
        }

        const lines = fileContent.split('\n');
        const startLine = Math.max(0, issue.line - 6);
        const endLine = Math.min(lines.length, issue.line + 5);
        const snippet = lines.slice(startLine, endLine).join('\n');

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
            });
        } else {
            // Queue for batched AI processing
            aiInputs.push({ issue, snippet });
        }
    }

    console.log(`[Fix Gen] Phase 1 done: ${fixes.length} deterministic, ${aiInputs.length} queued for AI`);

    // ─── Phase 2: Batched AI fixes (single LLM call) ────────────────
    if (aiInputs.length > 0) {
        const aiResults = await generateAIFixesBatched(aiInputs);

        for (let i = 0; i < aiInputs.length; i++) {
            const { issue, snippet } = aiInputs[i];
            const aiFix = aiResults.get(`issue_${i}`);

            if (aiFix) {
                console.log(`[Fix Gen]   ✓ AI: ${issue.name} in ${issue.file}:${issue.line}`);
                fixes.push({
                    id: randomUUID(),
                    file: issue.file,
                    line: issue.line,
                    issueType: issue.type,
                    issueName: issue.name,
                    severity: issue.severity,
                    strategy: 'ai',
                    originalCode: snippet,
                    fixedCode: aiFix.fixedCode,
                    explanation: aiFix.explanation,
                });
            }
        }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Fix Gen] Complete in ${totalTime}ms: ${fixes.length} fixes (${fixes.filter(f => f.strategy === 'deterministic').length} deterministic, ${fixes.filter(f => f.strategy === 'ai').length} AI)`);

    return NextResponse.json({
        fixes,
        totalIssues: issues.length,
        fixesGenerated: fixes.length,
        deterministicCount: fixes.filter(f => f.strategy === 'deterministic').length,
        aiCount: fixes.filter(f => f.strategy === 'ai').length,
    });
}
