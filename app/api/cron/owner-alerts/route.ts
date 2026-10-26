import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sendDueSummaries } from '@/lib/embedded/owner-alerts';
import { cronDisabled } from '@/lib/cron';

/** Hourly: send each agent owner's morning summary once it's 8am where they are. */
async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[Cron] Missing CRON_SECRET - refusing to send owner summaries');
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        console.error('[Cron] Unauthorized owner summary attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    try {
        const result = await sendDueSummaries(createAdminClient());
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[Cron] Error sending owner summaries:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
