/**
 * Invoices for Bachs card payments.
 *
 * Bachs sends a payment receipt but no invoice, and its payins listing
 * doesn't return our customers' charges, so customers had no invoice to
 * download. Each paid credit top-up is recorded in credit_transactions with
 * its Bachs charge ID; that row is the source of truth for the list, and the
 * PDF is rendered on request from the row plus the charge Bachs holds.
 */

import { createAdminClient } from '@/lib/supabaseAdmin';
import { getCharge, type BachsCharge } from '@/lib/bachsClient';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

export interface InvoiceOrg {
    id: string;
    slug: string;
    name: string;
    billing_email: string | null;
    billing_address_line1: string | null;
    billing_address_line2: string | null;
    billing_city: string | null;
    billing_state: string | null;
    billing_zip: string | null;
    billing_country: string | null;
    billing_tax_id: string | null;
}

export interface BachsTopupRecord {
    chargeId: string;
    createdAt: string;
    grossUsd: number;
    netCreditsUsd: number;
    /** What the card was charged, fee included; null for rows written before it was stored. */
    chargedUsd: number | null;
}

export interface BachsInvoiceSummary {
    id: string;
    orderId: string;
    date: string;
    amount: number;
    status: 'paid';
    pdfUrl: string;
}

export interface BachsInvoiceDocument {
    number: string;
    paidAt: string;
    chargeId: string;
    org: InvoiceOrg;
    lines: { title: string; detail: string; amountUsd: number }[];
    totalUsd: number;
    netCreditsUsd: number;
}

/** Stable per charge, so a re-download carries the number the customer already filed. */
export function bachsInvoiceNumber(chargeId: string, paidAt: string): string {
    const date = paidAt.slice(0, 10).replace(/-/g, '');
    const suffix = chargeId.replace(/^ch_/, '').slice(0, 6).toUpperCase();
    return `INV-${date}-${suffix}`;
}

export function bachsInvoiceUrl(orgSlug: string, chargeId: string): string {
    return `/api/billing/invoices/${encodeURIComponent(chargeId)}?org=${encodeURIComponent(orgSlug)}`;
}

function toRecord(row: { created_at: string; amount: string | number; metadata: Record<string, unknown> | null }): BachsTopupRecord | null {
    const metadata = row.metadata ?? {};
    const chargeId = typeof metadata.payment_reference === 'string' ? metadata.payment_reference : null;
    if (!chargeId?.startsWith('ch_')) return null;
    const net = Number(row.amount);
    const gross = Number(metadata.gross_credits_usd ?? net);
    const charged = metadata.charged_usd == null ? null : Number(metadata.charged_usd);
    return {
        chargeId,
        createdAt: row.created_at,
        grossUsd: gross,
        netCreditsUsd: net,
        chargedUsd: Number.isFinite(charged) ? charged : null,
    };
}

const TOPUP_COLUMNS = 'created_at, amount, metadata';

export async function listBachsTopups(supabase: SupabaseAdmin, organizationId: string): Promise<BachsTopupRecord[]> {
    const { data, error } = await supabase
        .from('credit_transactions')
        .select(TOPUP_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'topup')
        .eq('metadata->>payment_provider', 'bachs')
        .order('created_at', { ascending: false })
        .limit(50);
    if (error) throw error;
    return (data ?? []).flatMap((row) => toRecord(row) ?? []);
}

export async function getBachsTopup(
    supabase: SupabaseAdmin,
    organizationId: string,
    chargeId: string,
): Promise<BachsTopupRecord | null> {
    const { data, error } = await supabase
        .from('credit_transactions')
        .select(TOPUP_COLUMNS)
        .eq('organization_id', organizationId)
        .eq('transaction_type', 'topup')
        .eq('metadata->>payment_provider', 'bachs')
        .eq('metadata->>payment_reference', chargeId)
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data ? toRecord(data) : null;
}

export function toInvoiceSummary(orgSlug: string, record: BachsTopupRecord): BachsInvoiceSummary {
    return {
        id: bachsInvoiceNumber(record.chargeId, record.createdAt),
        orderId: record.chargeId,
        date: record.createdAt,
        amount: record.chargedUsd ?? record.grossUsd,
        status: 'paid',
        pdfUrl: bachsInvoiceUrl(orgSlug, record.chargeId),
    };
}

/**
 * The invoice for one paid top-up. The charge is fetched from Bachs for the
 * amount actually taken from the card and the time it succeeded; if Bachs is
 * unreachable, the ledger row alone still gives a correct invoice for the pack.
 */
export async function buildBachsInvoice(org: InvoiceOrg, record: BachsTopupRecord): Promise<BachsInvoiceDocument> {
    let charge: BachsCharge | null = null;
    try {
        charge = await getCharge(record.chargeId);
    } catch (error) {
        console.error('[Bachs invoices] Charge lookup failed; invoicing from the ledger row:', error);
    }
    return composeBachsInvoice(org, record, charge);
}

export function composeBachsInvoice(
    org: InvoiceOrg,
    record: BachsTopupRecord,
    charge: Pick<BachsCharge, 'amount' | 'currency' | 'created_at'> | null,
): BachsInvoiceDocument {
    const chargeUsd = charge && charge.currency === 'USD' ? Number(charge.amount) : NaN;
    const totalUsd = round2(Number.isFinite(chargeUsd) ? chargeUsd : record.chargedUsd ?? record.grossUsd);
    const feeUsd = round2(totalUsd - record.grossUsd);
    const paidAt = charge?.created_at ?? record.createdAt;

    const lines: BachsInvoiceDocument['lines'] = [{
        title: 'API Credits',
        detail: `${usd(record.grossUsd)} of prepaid usage credits for the ${org.slug} organization`,
        amountUsd: record.grossUsd,
    }];
    if (feeUsd > 0) {
        lines.push({ title: 'Card Processing Fee', detail: 'Charged by our payment processor', amountUsd: feeUsd });
    }

    return {
        number: bachsInvoiceNumber(record.chargeId, record.createdAt),
        paidAt,
        chargeId: record.chargeId,
        org,
        lines,
        totalUsd: feeUsd > 0 ? totalUsd : record.grossUsd,
        netCreditsUsd: record.netCreditsUsd,
    };
}

function usd(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export { renderBachsInvoicePdf } from './invoice-pdf';
