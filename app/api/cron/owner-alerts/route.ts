import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { sendDueSummaries } from '@/lib/embedded/owner-alerts';
import { sendPlanReminders } from '@/lib/business/reminders';
import { sendMorningBriefs } from '@/lib/studio/brief';
import { syncAllStores } from '@/lib/embedded/store-sync';
import { cronDisabled } from '@/lib/cron';

/**
 * Hourly: send each agent owner's morning summary and each business's
 * morning brief once it's 8am where they are, and each business plan's
 * reminders (ending soon, ended, stopped), and sync each connected online
 * store's products.
 */
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
        const db = createAdminClient();
        const [result, reminders, briefs, stores] = await Promise.all([sendDueSummaries(db), sendPlanReminders(db), sendMorningBriefs(db), syncAllStores(db)]);
        return NextResponse.json({ success: true, ...result, plan_reminders: reminders.sent, briefs, stores, timestamp: new Date().toISOString() });
    } catch (error) {
        console.error('[Cron] Error sending owner summaries:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}

export const maxDuration = 300;

export const GET = run;
export const POST = run;
