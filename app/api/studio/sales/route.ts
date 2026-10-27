/**
 * GET  /api/studio/sales?project_id=
 *      Studio's Sales tab: orders from the product list and bookings the
 *      assistant made, newest first, with each booking's deposit if one was
 *      paid in the same chat.
 * POST /api/studio/sales  { project_id, kind: 'order' | 'booking', id, action: 'paid' | 'done' | 'cancelled' }
 *      The owner's changes: an order paid another way (cash, transfer), or an
 *      order or booking done or cancelled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getCatalog, markOrderPaidByOwner, setOrderStatus } from '@/lib/embedded/catalog';
import { listBookings, setBookingStatus } from '@/lib/embedded/bookings';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { confirmTransfer, transferHistory } from '@/lib/embedded/transfers';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

async function sales(projectId: string) {
    const db = createAdminClient();
    const [catalog, bookings, payments, transfers] = await Promise.all([getCatalog(db, projectId), listBookings(db, projectId), getPaymentsConnection(db, projectId).catch(() => null), transferHistory(db, projectId).catch(() => [])]);
    // Deposits came in by link or by a transfer the owner confirmed.
    const paid = [...(payments?.metadata.payments ?? []), ...transfers].filter((p) => p.status === 'paid');
    return {
        currency: catalog?.metadata.currency ?? payments?.metadata.currency ?? 'NGN',
        has_products: !!catalog?.metadata.products.length,
        orders: (catalog?.metadata.orders ?? []).slice(-150).reverse().map((order) => ({
            id: order.id,
            items: order.items.map((item) => ({ name: item.name, option: item.option, quantity: item.quantity })),
            total: order.total,
            currency: order.currency,
            customer: order.customer,
            delivery: order.delivery,
            note: order.note,
            status: order.status,
            paid_by: order.paid_by ?? (order.status === 'paid' && order.payment_reference ? 'link' : null),
            conversation_id: order.conversation_id,
            created_at: order.created_at,
            paid_at: order.paid_at,
        })),
        bookings: bookings.slice(-200).reverse().map((booking) => {
            const deposit = booking.conversation_id ? paid.find((p) => p.conversation_id === booking.conversation_id) : null;
            return { ...booking, deposit: deposit ? { amount: deposit.amount, currency: deposit.currency } : null };
        }),
    };
}

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    return NextResponse.json(await sales(projectId), { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; kind?: unknown; id?: unknown; action?: unknown } | null;
    if (!isId(body?.project_id)) return fail('Say which project.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    // Orders are "ORD-1A2B3C4D"; bookings are UUIDs.
    if (typeof body.id !== 'string' || !/^[A-Za-z0-9-]{4,64}$/.test(body.id)) return fail('Say which one.');
    const db = createAdminClient();
    let ok = false;
    if (body.kind === 'order' && body.action === 'paid') {
        // Waiting on a bank transfer: confirming the transfer pays the order (and counts it once).
        const order = (await getCatalog(db, body.project_id))?.metadata.orders.find((o) => o.id === body.id);
        ok = order?.payment_reference?.startsWith('TRF-') && order.status === 'awaiting_payment'
            ? !!await confirmTransfer(db, body.project_id, order.payment_reference)
            : !!await markOrderPaidByOwner(db, body.project_id, body.id);
    }
    else if (body.kind === 'order' && (body.action === 'done' || body.action === 'cancelled')) ok = !!await setOrderStatus(db, body.project_id, body.id, body.action);
    else if (body.kind === 'booking' && (body.action === 'done' || body.action === 'cancelled')) ok = await setBookingStatus(db, body.project_id, body.id, body.action);
    else return fail('Unknown change.');
    if (!ok) return fail('That one isn\'t there any more. Refresh and try again.', 404);
    return NextResponse.json(await sales(body.project_id), { headers: { 'Cache-Control': 'no-store' } });
}
