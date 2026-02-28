import { NextRequest, NextResponse } from 'next/server';
import { resetMonthlyUsage } from '@/lib/usage';

export async function POST(req: NextRequest) {
    try {
        const cronSecret = process.env.CRON_SECRET;
        const authHeader = req.headers.get('authorization');

        if (!cronSecret) {
            console.error('[Cron] Missing CRON_SECRET - refusing to run usage reset');
            return NextResponse.json(
                { error: 'Server misconfiguration' },
                { status: 503 }
            );
        }

        if (authHeader !== `Bearer ${cronSecret}`) {
            console.error('[Cron] Unauthorized usage reset attempt');
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        console.log('[Cron] Starting monthly usage reset...');
        const result = await resetMonthlyUsage();

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: result.error
                },
                { status: 500 }
            );
        }

        console.log(`[Cron] ✓ Successfully reset usage for ${result.count} organizations`);

        return NextResponse.json({
            success: true,
            count: result.count,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Cron] Error resetting usage:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json(
            { error: 'GET not allowed in production' },
            { status: 405 }
        );
    }

    return POST(req);
}
