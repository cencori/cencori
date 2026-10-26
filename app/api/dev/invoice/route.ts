/**
 * GET /api/dev/invoice: the sample invoice PDF, for /api/dev/invoice/preview.
 * `?format=hash` returns a fingerprint of the PDF so the preview can tell
 * when a code change altered it. Only served by `next dev`.
 */

import { createHash } from 'node:crypto';
import { renderBachsInvoicePdf } from '@/lib/billing/bachs-invoices';
import { sampleInvoice } from '@/lib/billing/invoice-sample';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    if (process.env.NODE_ENV !== 'development') {
        return new Response('Not found', { status: 404 });
    }
    // jsPDF stamps the creation time into the file; blank it so the hash only
    // moves when the layout does.
    const pdf = renderBachsInvoicePdf(sampleInvoice);
    if (new URL(req.url).searchParams.get('format') === 'hash') {
        const stable = new TextDecoder('latin1').decode(pdf).replace(/\/CreationDate \(D:[^)]*\)/, '').replace(/\/ID \[[^\]]*\]/, '');
        return new Response(createHash('sha1').update(stable).digest('hex'), {
            headers: { 'Cache-Control': 'no-store' },
        });
    }
    return new Response(pdf, {
        headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' },
    });
}
