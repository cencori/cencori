import { describe, expect, it } from 'vitest';
import {
    bachsInvoiceNumber,
    composeBachsInvoice,
    renderBachsInvoicePdf,
    toInvoiceSummary,
    type BachsTopupRecord,
    type InvoiceOrg,
} from '@/lib/billing/bachs-invoices';

const org: InvoiceOrg = {
    id: 'org-1',
    slug: 'acme',
    name: 'Acme Co',
    billing_email: 'billing@acme.test',
    billing_address_line1: '1 Main St',
    billing_address_line2: null,
    billing_city: 'San Francisco',
    billing_state: 'California',
    billing_zip: '94127',
    billing_country: 'US',
    billing_tax_id: null,
};

const record: BachsTopupRecord = {
    chargeId: 'ch_ca4f04ff81a140df982589496592cfe1',
    createdAt: '2026-10-06T13:23:08.151Z',
    grossUsd: 50,
    netCreditsUsd: 47.25,
    chargedUsd: null,
};

describe('Bachs invoices', () => {
    it('numbers invoices by payment date and charge ID', () => {
        expect(bachsInvoiceNumber(record.chargeId, record.createdAt)).toBe('INV-20261006-CA4F04');
    });

    it('splits the card total into the pack and the processing fee', () => {
        const invoice = composeBachsInvoice(org, record, { amount: '52.90', currency: 'USD', created_at: '2026-10-06T12:39:15Z' });
        expect(invoice.lines.map((l) => l.amountUsd)).toEqual([50, 2.9]);
        expect(invoice.totalUsd).toBe(52.9);
        expect(invoice.paidAt).toBe('2026-10-06T12:39:15Z');
    });

    it('falls back to the ledger row when Bachs is unreachable', () => {
        const invoice = composeBachsInvoice(org, { ...record, chargedUsd: 52.9 }, null);
        expect(invoice.totalUsd).toBe(52.9);
        expect(composeBachsInvoice(org, record, null).lines).toHaveLength(1);
        expect(composeBachsInvoice(org, record, null).totalUsd).toBe(50);
    });

    it('lists the card total and links to the PDF route', () => {
        expect(toInvoiceSummary('acme', { ...record, chargedUsd: 52.9 })).toMatchObject({
            id: 'INV-20261006-CA4F04',
            amount: 52.9,
            status: 'paid',
            pdfUrl: '/api/billing/invoices/ch_ca4f04ff81a140df982589496592cfe1?org=acme',
        });
    });

    it('renders a PDF', () => {
        const pdf = renderBachsInvoicePdf(composeBachsInvoice(org, record, null));
        expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    });
});
