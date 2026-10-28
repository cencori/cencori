/**
 * GET /api/studio/money?project_id=&period=week|month|year
 *
 * Studio's Money tab: what came in through the assistant (paid links,
 * confirmed transfers and orders marked paid) in the business's own time
 * zone, with the period before it, a bar per day / week / month, the best
 * sellers, the bank account customers transfer to, and transfers to confirm.
 */

import { bankLogo } from '@/lib/payouts/name-enquiry';
import { accountsOf } from '@/lib/embedded/transfers';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getCatalog } from '@/lib/embedded/catalog';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import { getTransfers, transferHistory } from '@/lib/embedded/transfers';
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
    const [payments, catalog, alerts, transfers, history] = await Promise.all([
        getPaymentsConnection(db, projectId).catch(() => null),
        getCatalog(db, projectId),
        agent ? getOwnerAlerts(db, projectId, agent.id as string).catch(() => null) : Promise.resolve(null),
        getTransfers(db, projectId).catch(() => null),
        transferHistory(db, projectId).catch(() => []),
    ]);
    const currency = payments?.metadata.currency ?? catalog?.metadata.currency ?? 'NGN';
    const summary = summarizeMoney({
        payments: payments?.metadata.payments ?? [],
        transfers: history,
        orders: catalog?.metadata.orders ?? [],
        period,
        timeZone: safeTimeZone(alerts?.settings.time_zone),
        currency,
    });
    return NextResponse.json({
        ...summary,
        payments: payments ? { provider: payments.metadata.provider, mode: payments.metadata.mode } : null,
        bank_account: transfers?.metadata.account ? { ...transfers.metadata.account, logo: await bankLogo(transfers.metadata.account.bank) } : null,
        // Every account, the main one (the one customers are given) first, with its bank's logo.
        bank_accounts: await Promise.all(accountsOf(transfers?.metadata).map(async (account) => ({ ...account, logo: await bankLogo(account.bank) }))),
        // Customers who said they've sent money, newest first, then ones asked to pay in the last week.
        transfers_to_confirm: history
            .filter((t) => t.status === 'claimed' || (t.status === 'awaiting' && Date.now() - Date.parse(t.created_at) < 7 * 86_400_000))
            .sort((a, b) => (a.status === b.status ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.status === 'claimed' ? -1 : 1))
            .slice(0, 30)
            .map(({ reference, amount, currency, description, customer, status, created_at, claimed_at, conversation_id }) => ({ reference, amount, currency, description, customer, status, created_at, claimed_at, conversation_id })),
    }, { headers: { 'Cache-Control': 'no-store' } });
}
