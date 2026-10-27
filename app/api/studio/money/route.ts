/**
 * GET /api/studio/money?project_id=&period=week|month|year
 *
 * Studio's Money tab: what came in through the assistant (paid links and
 * orders marked paid) in the business's own time zone, with the period
 * before it, a bar per day / week / month, and the best sellers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getCatalog } from '@/lib/embedded/catalog';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import { summarizeMoney, type MoneyPeriod } from '@/lib/studio/money';
import { safeTimeZone } from '@/lib/studio/time';

const PERIODS = new Set<MoneyPeriod>(['week', 'month', 'year']);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const requested = req.nextUrl.searchParams.get('period') as MoneyPeriod | null;
    const period: MoneyPeriod = requested && PERIODS.has(requested) ? requested : 'week';

    const db = createAdminClient();
    const { data: agent } = await db.from('agents').select('id').eq('project_id', projectId).order('created_at', { ascending: true }).limit(1).maybeSingle();
    const [payments, catalog, alerts] = await Promise.all([
        getPaymentsConnection(db, projectId).catch(() => null),
        getCatalog(db, projectId),
        agent ? getOwnerAlerts(db, projectId, agent.id as string).catch(() => null) : Promise.resolve(null),
    ]);
    const currency = payments?.metadata.currency ?? catalog?.metadata.currency ?? 'NGN';
    const summary = summarizeMoney({
        payments: payments?.metadata.payments ?? [],
        orders: catalog?.metadata.orders ?? [],
        period,
        timeZone: safeTimeZone(alerts?.settings.time_zone),
        currency,
    });
    return NextResponse.json({
        ...summary,
        payments: payments ? { provider: payments.metadata.provider, mode: payments.metadata.mode } : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
