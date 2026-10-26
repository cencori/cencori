/**
 * Invoices for Bachs card payments.
 *
 * Bachs sends a payment receipt but no invoice, and its payins listing
 * doesn't return our customers' charges, so customers had no invoice to
 * download. Each paid credit top-up is recorded in credit_transactions with
 * its Bachs charge ID; that row is the source of truth for the list, and the
 * PDF is rendered on request from the row plus the charge Bachs holds.
 */

import { jsPDF } from 'jspdf';
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
    lines: { description: string; detail?: string; amountUsd: number }[];
    totalUsd: number;
    netCreditsUsd: number;
}

const ISSUER = ['Cencori, Inc.', 'San Francisco, CA, United States', 'support@cencori.com'];

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
        description: `Cencori prepaid API credits: ${usd(record.grossUsd)} pack`,
        detail: `Organization: ${org.slug}`,
        amountUsd: record.grossUsd,
    }];
    if (feeUsd > 0) {
        lines.push({ description: 'Card payment processing fee', amountUsd: feeUsd });
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

// ── PDF ─────────────────────────────────────────────────────────

const MARGIN = 56;
const MUTED: [number, number, number] = [110, 110, 110];
const INK: [number, number, number] = [17, 17, 17];

export function renderBachsInvoicePdf(invoice: BachsInvoiceDocument): ArrayBuffer {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const width = doc.internal.pageSize.getWidth();
    const right = width - MARGIN;
    doc.setProperties({ title: `Invoice ${invoice.number}`, author: 'Cencori, Inc.' });

    // Header
    doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...INK);
    doc.text('Cencori', MARGIN, 72);
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
    doc.text(ISSUER, MARGIN, 90, { lineHeightFactor: 1.5 });

    doc.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...INK);
    doc.text('Invoice', right, 72, { align: 'right' });
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
    doc.text(invoice.number, right, 90, { align: 'right' });
    doc.setDrawColor(21, 128, 61).setTextColor(21, 128, 61).setFont('helvetica', 'bold').setFontSize(8);
    doc.roundedRect(right - 38, 98, 38, 15, 2, 2);
    doc.text('PAID', right - 19, 108.5, { align: 'center' });

    // Parties and dates
    const top = 160;
    const col2 = MARGIN + 180;
    const col3 = MARGIN + 330;
    label(doc, 'Billed to', MARGIN, top);
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...INK);
    doc.text(invoice.org.name, MARGIN, top + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(billedToLines(invoice.org), MARGIN, top + 30, { lineHeightFactor: 1.5, maxWidth: 170 });

    label(doc, 'Invoice date', col2, top);
    value(doc, longDate(invoice.paidAt), col2, top + 16);
    label(doc, 'Payment date', col2, top + 40);
    value(doc, longDate(invoice.paidAt), col2, top + 56);

    label(doc, 'Payment method', col3, top);
    value(doc, 'Card (via Bachs)', col3, top + 16);
    label(doc, 'Payment reference', col3, top + 40);
    doc.setFont('courier', 'normal').setFontSize(7.5).setTextColor(...INK);
    doc.text(invoice.chargeId, col3, top + 56);

    // Line items
    let y = 320;
    doc.setDrawColor(220, 220, 220).setLineWidth(0.75);
    label(doc, 'Description', MARGIN, y);
    label(doc, 'Amount', right, y, 'right');
    y += 8;
    doc.line(MARGIN, y, right, y);
    for (const line of invoice.lines) {
        y += 20;
        value(doc, line.description, MARGIN, y);
        doc.text(usd(line.amountUsd), right, y, { align: 'right' });
        if (line.detail) {
            y += 13;
            doc.setFontSize(8.5).setTextColor(...MUTED);
            doc.text(line.detail, MARGIN, y);
        }
        y += 10;
        doc.setDrawColor(235, 235, 235);
        doc.line(MARGIN, y, right, y);
    }

    // Totals
    const totalsX = right - 220;
    y += 24;
    const row = (name: string, amount: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(bold ? 11 : 9.5);
        doc.setTextColor(...(bold ? INK : MUTED));
        doc.text(name, totalsX, y);
        doc.setTextColor(...INK);
        doc.text(amount, right, y, { align: 'right' });
        y += bold ? 22 : 18;
    };
    row('Subtotal', usd(invoice.totalUsd));
    row('Tax', usd(0));
    doc.setDrawColor(...INK).line(totalsX, y - 8, right, y - 8);
    y += 6;
    row('Total (USD)', usd(invoice.totalUsd), true);
    row(`Amount paid (${shortDate(invoice.paidAt)})`, usd(invoice.totalUsd));
    row('Balance due', usd(0), true);

    // Notes
    y += 24;
    doc.setDrawColor(235, 235, 235).line(MARGIN, y, right, y);
    y += 20;
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(70, 70, 70);
    doc.text([
        'This invoice covers a payment already received in full. No further payment is due.',
        `${usd(invoice.netCreditsUsd)} in API credits was applied to the ${invoice.org.name} organization, net of the card top-up fee.`,
        'Questions about this invoice: support@cencori.com',
    ], MARGIN, y, { lineHeightFactor: 1.8, maxWidth: right - MARGIN });

    return doc.output('arraybuffer');
}

function label(doc: jsPDF, text: string, x: number, y: number, align: 'left' | 'right' = 'left') {
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
    doc.text(text.toUpperCase(), x, y, { align, charSpace: 0.6 });
}

function value(doc: jsPDF, text: string, x: number, y: number) {
    doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...INK);
    doc.text(text, x, y);
}

function billedToLines(org: InvoiceOrg): string[] {
    const cityLine = [org.billing_city, [org.billing_state, org.billing_zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ');
    return [
        org.billing_address_line1,
        org.billing_address_line2,
        cityLine,
        countryName(org.billing_country),
        org.billing_tax_id ? `Tax ID: ${org.billing_tax_id}` : null,
        org.billing_email,
    ].filter((line): line is string => Boolean(line));
}

function countryName(code: string | null): string | null {
    if (!code) return null;
    try {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
    } catch {
        return code;
    }
}

function longDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function usd(amount: number): string {
    return `$${amount.toFixed(2)}`;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
