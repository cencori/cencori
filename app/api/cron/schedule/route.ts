import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sweepSchedules } from '@/lib/studio/schedule';
import { cronDisabled } from '@/lib/cron';

/** Every half hour: let go of appointment slots whose deposit never came, and send the reminders that are due. */
async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const result = await sweepSchedules(createAdminClient());
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[Cron] Schedule sweep failed:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
