/**
 * GET /api/payments/return?ref=…
 *
 * Where the payment provider (Paystack, Flutterwave, Stripe) sends a
 * customer's browser after they pay an agent's payment link. The payment is
 * checked with the provider (never trusted from the URL); the first time
 * it's paid, the customer is told on WhatsApp and the owner by email. The
 * page says what happened and sends them back.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { findPayment, formatMoney, settlePayment } from '@/lib/embedded/payments';
import { PAYMENT_PROVIDERS } from '@/lib/integrations/payment-providers';
import { escapeHtml } from '@/lib/email/sendbyte';

function page(title: string, message: string, ok: boolean): NextResponse {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>
<style>html,body{margin:0;height:100%;font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif;background:#fafafa;color:#111}main{min-height:100%;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}.card{max-width:380px;width:100%;background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:28px;text-align:center}.icon{width:48px;height:48px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:24px;background:${ok ? '#dcfce7' : '#fef3c7'};color:${ok ? '#15803d' : '#b45309'}}h1{font-size:20px;margin:0 0 8px}p{margin:0;color:#555}small{display:block;margin-top:20px;color:#999;font-size:12px}</style></head>
<body><main><div class="card"><div class="icon">${ok ? '✓' : '…'}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><small>Powered by Cencori</small></div></main></body></html>`;
    return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function GET(req: NextRequest) {
    // Our own ref; providers append theirs (Paystack's reference, Flutterwave's tx_ref), which are the same id.
    const params = req.nextUrl.searchParams;
    const reference = params.get('ref') ?? params.get('reference') ?? params.get('tx_ref') ?? '';
    const db = createAdminClient();
    const found = await findPayment(db, reference);
    if (!found) return page('Payment not found', 'We couldn\'t find this payment. If you were charged, reply in your chat and we\'ll check.', false);
    try {
        const payment = await settlePayment(db, found.connection, found.payment);
        if (payment.status === 'paid') {
            // Event tickets: straight to them.
            const { data: ticket } = await db.from('studio_tickets' as never).select('order_ref, event_id').eq('payment_reference', payment.reference).limit(1).maybeSingle();
            if (ticket) {
                const { data: event } = await db.from('studio_events' as never).select('slug').eq('id', (ticket as { event_id: string }).event_id).maybeSingle();
                if (event) return NextResponse.redirect(`https://studio.cencori.com/e/${(event as { slug: string }).slug}/order/${(ticket as { order_ref: string }).order_ref}`);
            }
            return page('Payment received', `${formatMoney(payment.amount, payment.currency)} for ${payment.description}. You can close this page and go back to your chat.`, true);
        }
        return page('Payment not completed', 'It hasn\'t gone through yet. If you just paid, wait a moment and refresh, or go back to your chat for a new link.', false);
    } catch {
        return page('We couldn\'t check your payment', `${PAYMENT_PROVIDERS[found.connection.metadata.provider]?.name ?? 'The payment provider'} didn't answer just now. Refresh in a moment, or go back to your chat and say you've paid.`, false);
    }
}
