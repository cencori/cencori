/**
 * /api/channels/whatsapp — the webhook of Cencori's own Meta app, for every
 * number a business connected through Embedded Signup ("Connect WhatsApp").
 *
 * GET  Meta's one-time check: echo `hub.challenge` when `hub.verify_token`
 *      is META_WEBHOOK_VERIFY_TOKEN.
 * POST Deliveries for all those numbers, signed with Cencori's app secret
 *      (META_APP_SECRET), routed to each number's agent by phone number id.
 *      Acknowledged at once; the replies are written after.
 *
 * Numbers on a business's own Meta app keep their per-channel webhook
 * (/api/channels/whatsapp/:channelId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getManagedChannelByPhoneNumberId, parseInbound, verifyWhatsAppSignature, type InboundMessage } from '@/lib/channels/whatsapp';

export const maxDuration = 300;

const MAX_BODY_BYTES = 1_000_000;

function sameSecret(given: string | null, expected: string | undefined): boolean {
    if (!given || !expected) return false;
    const a = Buffer.from(given);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams;
    if (query.get('hub.mode') !== 'subscribe' || !sameSecret(query.get('hub.verify_token'), process.env.META_WEBHOOK_VERIFY_TOKEN)) {
        return new NextResponse('Forbidden', { status: 403 });
    }
    return new NextResponse(query.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: NextRequest) {
    const secret = process.env.META_APP_SECRET;
    if (!secret) return new NextResponse(null, { status: 503 });
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    if (!verifyWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
        return new NextResponse(null, { status: 401 });
    }

    let payload: unknown;
    try {
        payload = JSON.parse(raw);
    } catch {
        return new NextResponse(null, { status: 400 });
    }
    const messages = parseInbound(payload);
    if (messages.length > 0) {
        waitUntil(route(messages).catch((error) => console.error('[whatsapp] delivery failed', error instanceof Error ? error.message : error)));
    }
    return NextResponse.json({ ok: true });
}

/** Each number's messages to its agent; numbers nobody connected (or turned off) are dropped. */
async function route(messages: InboundMessage[]): Promise<void> {
    const db = createAdminClient();
    const byNumber = new Map<string, InboundMessage[]>();
    for (const message of messages) byNumber.set(message.phoneNumberId, [...(byNumber.get(message.phoneNumberId) ?? []), message]);
    const { handleInboundMessages } = await import('@/lib/channels/whatsapp-runner');
    await Promise.all([...byNumber.entries()].map(async ([phoneNumberId, list]) => {
        const channel = await getManagedChannelByPhoneNumberId(db, phoneNumberId);
        if (!channel || !channel.metadata.enabled || channel.status !== 'active') return;
        await handleInboundMessages(db, channel, list);
    }));
}
