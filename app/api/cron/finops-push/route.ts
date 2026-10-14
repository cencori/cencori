/**
 * Nightly FinOps push: send each organization's settled usage to CostGraph as FOCUS 1.2.
 *
 * For every enabled `organization_finops_connections` row: the days since the last push (up to
 * yesterday, UTC), then — from the 3rd of the month — the whole previous month again so late rows
 * restate. Every window is sent with `complete: true`, so a re-run is always safe.
 *
 * GET|POST /api/cron/finops-push   (Authorization: Bearer $CRON_SECRET)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { cronDisabled } from '@/lib/cron';
import { runAllFinopsPushes } from '@/lib/finops/costgraph-push';

export const maxDuration = 300;

async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Cron] Missing CRON_SECRET - refusing to run FinOps push');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        console.error('[Cron] Unauthorized FinOps push attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const results = await runAllFinopsPushes(createAdminClient());
        const failed = results.filter((r) => r.status === 'error');
        for (const failure of failed) {
            console.error(`[Cron] FinOps push failed for connection ${failure.connectionId}: ${failure.error}`);
        }
        return NextResponse.json({
            success: true,
            connections: results.length,
            failed: failed.length,
            rows: results.reduce((sum, r) => sum + r.rows, 0),
            results: results.map((r) => ({
                connection: r.connectionId,
                status: r.status,
                rows: r.rows,
                windows: r.windows.length,
                ...(r.error ? { error: r.error } : {}),
            })),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('[Cron] FinOps push failed:', message);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return run(req);
}

export async function POST(req: NextRequest) {
    return run(req);
}
