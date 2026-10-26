import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sweepPendingPayments } from '@/lib/embedded/payments';
import { cronDisabled } from '@/lib/cron';

/** Every half hour: confirm payments whose customers closed Paystack before coming back. */
async function run(req: NextRequest) {
    const off = cronDisabled();
    if (off) return off;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    try {
        const result = await sweepPendingPayments(createAdminClient());
        return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[Cron] Payment sweep failed:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
