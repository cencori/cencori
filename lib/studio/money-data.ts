/**
 * What the Money tab shows, loaded once for both it (app/api/studio/money)
 * and the owner's employee (Copilot's get_money), so the two never disagree:
 * payments by link, transfers the owner confirmed and orders marked paid,
 * summed over the period in the business's own time zone.
 */
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { getCatalog } from '@/lib/embedded/catalog';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import { getTransfers, transferHistory } from '@/lib/embedded/transfers';
import { summarizeMoney, type MoneyPeriod } from '@/lib/studio/money';
import { safeTimeZone } from '@/lib/studio/time';

type Admin = ReturnType<typeof createAdminClient>;

export async function loadMoney(db: Admin, projectId: string, period: MoneyPeriod) {
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
    // Customers who said they've sent money, newest first, then ones asked to pay in the last week.
    const transfersToConfirm = history
        .filter((t) => t.status === 'claimed' || (t.status === 'awaiting' && Date.now() - Date.parse(t.created_at) < 7 * 86_400_000))
        .sort((a, b) => (a.status === b.status ? Date.parse(b.created_at) - Date.parse(a.created_at) : a.status === 'claimed' ? -1 : 1))
        .slice(0, 30)
        .map(({ reference, amount, currency, description, customer, status, created_at, claimed_at, conversation_id }) => ({ reference, amount, currency, description, customer, status, created_at, claimed_at, conversation_id }));
    return { summary, payments, transfers, transfersToConfirm };
}
