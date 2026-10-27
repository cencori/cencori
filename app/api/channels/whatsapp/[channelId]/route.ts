/**
 * /api/channels/whatsapp/:channelId — the webhook a business's Meta app sends
 * WhatsApp messages to.
 *
 * GET  Meta's one-time check: echo `hub.challenge` when `hub.verify_token`
 *      is the channel's verify token.
 * POST Message deliveries, signed with the Meta app's secret. Meta wants a
 *      quick 200 (it retries slow or failed deliveries), so the reply is
 *      written after responding.
 */

import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey } from '@/lib/encryption';
import { getChannelById, parseInbound, parseOwnerEchoes, patchChannelMetadata, verifyWhatsAppSignature } from '@/lib/channels/whatsapp';

export const maxDuration = 300;

const MAX_BODY_BYTES = 1_000_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const query = req.nextUrl.searchParams;
    const db = createAdminClient();
    const channel = await getChannelById(db, channelId);
    if (!channel || query.get('hub.mode') !== 'subscribe' || query.get('hub.verify_token') !== channel.metadata.verify_token) {
        return new NextResponse('Forbidden', { status: 403 });
    }
    await patchChannelMetadata(db, channel, { webhook_verified_at: new Date().toISOString() });
    return new NextResponse(query.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
    const { channelId } = await params;
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

    const db = createAdminClient();
    const channel = await getChannelById(db, channelId);
    // Numbers connected through Cencori's app arrive on /api/channels/whatsapp instead.
    if (!channel || !channel.metadata.app_secret_encrypted) return new NextResponse(null, { status: 404 });

    const { data: project } = await db.from('projects').select('organization_id').eq('id', channel.projectId).maybeSingle();
    let secret: string;
    try {
        secret = decryptApiKey(channel.metadata.app_secret_encrypted, (project?.organization_id as string | undefined) ?? '');
    } catch {
        return new NextResponse(null, { status: 500 });
    }
    if (!verifyWhatsAppSignature(raw, req.headers.get('x-hub-signature-256'), secret)) {
        return new NextResponse(null, { status: 401 });
    }

    // Deliveries keep arriving while the channel is off; they're acknowledged and dropped.
    if (!channel.metadata.enabled || channel.status !== 'active') return NextResponse.json({ ok: true });

    let payload: unknown;
    try {
        payload = JSON.parse(raw);
    } catch {
        return new NextResponse(null, { status: 400 });
    }
    const messages = parseInbound(payload);
    // Replies the owner sent from the WhatsApp Business app on their phone (coexistence).
    const echoes = parseOwnerEchoes(payload);
    if (messages.length > 0 || echoes.length > 0) {
        waitUntil((async () => {
            const { handleInboundMessages, handleOwnerEchoes } = await import('@/lib/channels/whatsapp-runner');
            await handleOwnerEchoes(db, channel, echoes);
            if (messages.length) await handleInboundMessages(db, channel, messages);
        })().catch((error) => console.error('[whatsapp] delivery failed', error instanceof Error ? error.message : error)));
    }
    return NextResponse.json({ ok: true });
}
