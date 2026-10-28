/**
 * POST /api/events/:slug/checkout  { tier_id, quantity, name, phone?, email? }
 *
 * A buyer's order from the public event page. Seats are reserved first, so a
 * tier can't oversell; the answer says how to pay (a payment link, or transfer
 * details) or, for free tickets, that they're ready. No sign-in: rate-limited
 * per connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { buyTickets, eventBySlug } from '@/lib/studio/events';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
    const { slug } = await ctx.params;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const { checkCustomRateLimit } = await import('@/lib/rate-limit');
    const limited = await checkCustomRateLimit(`event_checkout:${ip}`, 20, 600);
    if (!limited.allowed) return fail('Too many tries from this connection. Wait a few minutes.', 429);

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return fail('Send the order.');
    const db = createAdminClient();
    const event = await eventBySlug(db, slug);
    if (!event) return fail('Event not found.', 404);
    const email = typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ? body.email.trim().slice(0, 200) : null;
    const phone = typeof body.phone === 'string' && body.phone.replace(/\D/g, '').length >= 7 ? body.phone.trim().slice(0, 30) : null;
    const result = await buyTickets(db, event, {
        tierId: typeof body.tier_id === 'string' ? body.tier_id : '',
        quantity: Number(body.quantity ?? 1),
        name: typeof body.name === 'string' ? body.name : '',
        phone,
        email,
    });
    if (!result.ok) return fail(result.message, 409);
    const order = `/e/${event.slug}/order/${result.orderRef}`;
    return NextResponse.json(result.paid ? { order } : 'link' in result ? { order, pay_url: result.link } : { order });
}
