import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import {
    calculateScore,
    getTierDescription,
    scanFileContent,
    summarizeIssues,
    type ScanIssue,
    type ScanScore,
    type ScanSummary,
} from '../../../../packages/scan/src/scanner/core';

interface ScanResult {
    score: ScanScore;
    tierDescription: string;
    issues: ScanIssue[];
    filesScanned: number;
    scanDuration: number;
    summary: ScanSummary;
}

export async function POST(request: NextRequest) {
    // Auth guard — endpoint must not be publicly accessible
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { code } = body;

        if (!code || typeof code !== 'string') {
            return NextResponse.json(
                { error: 'Code is required' },
                { status: 400 }
            );
        }

        if (code.length > 100000) {
            return NextResponse.json(
                { error: 'Code too large (max 100KB)' },
                { status: 400 }
            );
        }

        const startTime = Date.now();
        const issues = scanFileContent('snippet.ts', code);
        const scanDuration = Date.now() - startTime;

        const score = calculateScore(issues);

        const result: ScanResult = {
            score,
            tierDescription: getTierDescription(score),
            issues,
            filesScanned: 1,
            scanDuration,
            summary: summarizeIssues(issues),
        };

        return NextResponse.json(result);
    } catch {
        return NextResponse.json(
            { error: 'Scan failed' },
            { status: 500 }
        );
    }
}
