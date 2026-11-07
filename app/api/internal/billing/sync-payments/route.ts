import { getAuthUser } from '@/lib/auth/get-auth-user';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isFounderEmail } from '@/lib/internal-admin-auth';
import { getCharge, listPayins, type BachsPayin } from '@/lib/bachsClient';
import { CRYPTO_TOPUP_FEE_PERCENT } from '@/lib/billing/credit-pricing';
import { bachsPaymentRow, isPaidStatus, recordPayments, type PaymentRow } from '@/lib/billing/payments-ledger';

/**
 * Backfill and re-sync the revenue ledger (public.payments):
 *   - every paid Bachs payin, read back as a charge for fees and settlement;
 *   - CoinCircuit crypto top-ups, rebuilt from the credit grants we keep.
 * Idempotent: rows upsert on (provider, provider_payment_id). Founders only,
 * since it reads payment data.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

const PER_PAGE = 100;
const MAX_PAGES = 100;
const CONCURRENCY = 5;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await fn(items[index]);
        }
    }));
    return results;
}

async function bachsRows(supabase: ReturnType<typeof createAdminClient>) {
    const payins: BachsPayin[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await listPayins({ page, per_page: PER_PAGE });
        payins.push(...(response.payins ?? []));
        if ((response.payins ?? []).length < PER_PAGE || page * PER_PAGE >= response.total_count) break;
    }

    const paid = payins.filter((payin) => isPaidStatus(payin.status));
    const rows = (await mapLimit(paid, CONCURRENCY, async (payin) => {
        // The charge carries the fee and settlement; fall back to the payin.
        if (payin.charge_id) {
            try {
                return bachsPaymentRow(await getCharge(payin.charge_id));
            } catch {
                /* use the payin below */
            }
        }
        return bachsPaymentRow(payin);
    })).filter((row): row is PaymentRow => row !== null);

    // Subscriptions don't always carry org_id; Bachs customers map to orgs.
    const { data: orgs } = await supabase
        .from('organizations')
        .select('id, bachs_customer_id')
        .not('bachs_customer_id', 'is', null);
    const byCustomer = new Map((orgs ?? []).map((org) => [org.bachs_customer_id as string, org.id as string]));
    const customerOf = new Map(paid.map((payin) => [payin.charge_id ?? payin.id, payin.customer?.id]));
    for (const row of rows) {
        if (!row.organization_id) {
            const customerId = customerOf.get(row.provider_payment_id);
            row.organization_id = customerId ? byCustomer.get(customerId) ?? null : null;
        }
    }

    return { listed: payins.length, paid: paid.length, rows };
}

async function coinCircuitRows(supabase: ReturnType<typeof createAdminClient>): Promise<PaymentRow[]> {
    const grossFromNet = (net: number) => Math.round((net / (1 - CRYPTO_TOPUP_FEE_PERCENT / 100)) * 100) / 100;
    const rows = new Map<string, PaymentRow>();
    const row = (reference: string, orgId: string | null, gross: number, paidAt: string, pack: unknown): PaymentRow => ({
        provider: 'coincircuit',
        provider_payment_id: reference,
        organization_id: orgId,
        product_type: 'credits_topup',
        product_id: pack ? String(pack) : null,
        billing_interval: null,
        amount: gross,
        currency: 'USD',
        amount_usd: gross,
        fx_ngn_per_usd: null,
        processing_fee: Math.round((gross - gross * (1 - CRYPTO_TOPUP_FEE_PERCENT / 100)) * 100) / 100,
        settlement_amount: null,
        settlement_currency: null,
        payment_method: 'crypto',
        customer_email: null,
        paid_at: paidAt,
    });

    // Older top-ups: the reference lives in the credit transaction's metadata.
    const { data: legacy, error: legacyError } = await supabase
        .from('credit_transactions')
        .select('organization_id, amount, metadata, created_at')
        .eq('transaction_type', 'topup')
        .not('metadata->>coincircuit_reference', 'is', null);
    if (legacyError) throw legacyError;
    for (const tx of legacy ?? []) {
        const meta = (tx.metadata ?? {}) as Record<string, unknown>;
        const reference = String(meta.coincircuit_reference);
        const gross = Number(meta.gross_credits_usd) || grossFromNet(Number(tx.amount));
        rows.set(reference, row(reference, tx.organization_id, gross, tx.created_at, meta.credit_pack));
    }

    // Current top-ups: the atomic grant table, keyed by the payment reference.
    const { data: grants, error: grantsError } = await supabase
        .from('payment_credit_grants')
        .select('payment_reference, organization_id, amount, created_at')
        .eq('provider', 'coincircuit');
    if (grantsError) throw grantsError;
    for (const grant of grants ?? []) {
        if (rows.has(grant.payment_reference)) continue;
        rows.set(
            grant.payment_reference,
            row(grant.payment_reference, grant.organization_id, grossFromNet(Number(grant.amount)), grant.created_at, null),
        );
    }

    return [...rows.values()];
}

export async function POST() {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isFounderEmail(user.email)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    try {
        const bachs = await bachsRows(admin);
        const crypto = await coinCircuitRows(admin);
        const all = [...bachs.rows, ...crypto];
        let recorded = 0;
        for (let i = 0; i < all.length; i += 200) {
            recorded += await recordPayments(admin, all.slice(i, i + 200));
        }
        return NextResponse.json({
            bachs: { listed: bachs.listed, paid: bachs.paid, recorded: bachs.rows.length },
            coincircuit: { recorded: crypto.length },
            total: recorded,
        });
    } catch (error) {
        console.error('[Payments sync] failed', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Sync failed' },
            { status: 500 },
        );
    }
}
