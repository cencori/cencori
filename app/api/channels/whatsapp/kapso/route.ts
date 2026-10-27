/**
 * /api/channels/whatsapp/kapso — where Kapso forwards the webhooks of every
 * number a business connected through Kapso ("Connect WhatsApp").
 *
 * POST Deliveries in Meta's own format (Kapso's `kind: meta` webhooks),
 *      trusted by Kapso's signature (X-Webhook-Signature) or the shared
 *      secret in Cencori's header, both from KAPSO_WEBHOOK_SECRET. Routed to
 *      each number's agent by phone number id; acknowledged at once and
 *      answered after. Kapso may deliver twice: the runner skips message ids
 *      it has already seen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { KAPSO_TOKEN_HEADER, verifyKapsoDelivery } from '@/lib/channels/kapso';
import { getKapsoChannelByPhoneNumberId, parseInbound, type InboundMessage } from '@/lib/channels/whatsapp';

export const maxDuration = 300;

const MAX_BODY_BYTES = 1_000_000;

export async function POST(req: NextRequest) {
    if (!process.env.KAPSO_WEBHOOK_SECRET) return new NextResponse(null, { status: 503 });
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
    if (!verifyKapsoDelivery(raw, req.headers.get('x-webhook-signature'), req.headers.get(KAPSO_TOKEN_HEADER))) {
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
        waitUntil(route(messages).catch((error) => console.error('[whatsapp:kapso] delivery failed', error instanceof Error ? error.message : error)));
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
        const channel = await getKapsoChannelByPhoneNumberId(db, phoneNumberId);
        if (!channel || !channel.metadata.enabled || channel.status !== 'active') return;
        await handleInboundMessages(db, channel, list);
    }));
}
