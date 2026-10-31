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
import type { MoneyPeriod } from '@/lib/studio/money';
import { loadMoney } from '@/lib/studio/money-data';

const PERIODS = new Set<MoneyPeriod>(['week', 'month', 'year']);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const requested = req.nextUrl.searchParams.get('period') as MoneyPeriod | null;
    const period: MoneyPeriod = requested && PERIODS.has(requested) ? requested : 'week';

    const { summary, payments, transfers, transfersToConfirm } = await loadMoney(createAdminClient(), projectId, period);
    return NextResponse.json({
        ...summary,
        payments: payments ? { provider: payments.metadata.provider, mode: payments.metadata.mode } : null,
        bank_account: transfers?.metadata.account ? { ...transfers.metadata.account, logo: await bankLogo(transfers.metadata.account.bank) } : null,
        // Every account, the main one (the one customers are given) first, with its bank's logo.
        bank_accounts: await Promise.all(accountsOf(transfers?.metadata).map(async (account) => ({ ...account, logo: await bankLogo(account.bank) }))),
        // Customers who said they've sent money, newest first, then ones asked to pay in the last week.
        transfers_to_confirm: transfersToConfirm,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
