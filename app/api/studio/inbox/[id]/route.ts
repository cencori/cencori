/**
 * GET  /api/studio/inbox/:id?project_id=
 *      One conversation for Studio's Inbox: who it's with, on which channel,
 *      every message in order, and whether the owner can reply here.
 * POST /api/studio/inbox/:id  { project_id, action: 'step_in' | 'hand_back' | 'reply' | 'mark_read' | 'mark_unread', text? }
 *      Stepping in: pause the assistant in this chat, hand it back, or send the
 *      customer a message as the owner (it keeps the assistant paused). On
 *      WhatsApp it's sent inside the 24-hour window; on website and link chats
 *      it's kept on the conversation, where the visitor's chat window polls it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getConversation } from '@/lib/studio/inbox';
import { addManualMessage, handBack, markRead, markUnread, stepIn } from '@/lib/studio/takeover';
import { channelAccessToken, getChannelById, sendText } from '@/lib/channels/whatsapp';
import { decryptApiKey } from '@/lib/encryption';

const MAX_REPLY = 4000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const found = await getConversation(db, projectId, id, access.userId);
    if (!found) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    // Opening it reads it (written only when there's something new, not on every refresh).
    if (found.conversation.unread) {
        await markRead(db, id, access.userId);
        found.conversation.unread = false;
    }
    return NextResponse.json(found, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await req.json().catch(() => null) as { project_id?: unknown; action?: unknown; text?: unknown } | null;
    const projectId = typeof body?.project_id === 'string' ? body.project_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const found = await getConversation(db, projectId, id, access.userId);
    if (!found) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

    if (body?.action === 'mark_unread') {
        await markUnread(db, id, access.userId);
    } else if (body?.action === 'mark_read') {
        await markRead(db, id, access.userId);
    } else if (body?.action === 'step_in') {
        await stepIn(db, id);
    } else if (body?.action === 'hand_back') {
        await handBack(db, id);
    } else if (body?.action === 'reply') {
        const text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_REPLY) : '';
        if (!text) return NextResponse.json({ error: 'Write a message first.' }, { status: 400 });
        if (!found.reply.possible) {
            return NextResponse.json({
                error: found.reply.reason === 'window'
                    ? 'WhatsApp only lets a business reply within 24 hours of the customer\'s last message. Call them, or wait for them to message again.'
                    : 'You can reply from here on WhatsApp, website and link chats.',
            }, { status: 409 });
        }
        // Website and link chats: the visitor's chat window picks it up.
        if (found.conversation.channel !== 'whatsapp') {
            await addManualMessage(db, id, { from: 'owner', text });
            const updated = await getConversation(db, projectId, id, access.userId);
            return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } });
        }
        const { data: session } = await db.from('sessions').select('metadata').eq('id', id).maybeSingle();
        const metadata = (session?.metadata ?? {}) as { channel_id?: string; customer_number?: string };
        const channel = metadata.channel_id ? await getChannelById(db, metadata.channel_id) : null;
        if (!channel || channel.projectId !== projectId || !metadata.customer_number) {
            return NextResponse.json({ error: 'This chat\'s WhatsApp number isn\'t connected any more.' }, { status: 409 });
        }
        const token = channelAccessToken(channel, (value) => {
            try {
                return decryptApiKey(value, access.organizationId);
            } catch {
                return null;
            }
        });
        if (!token) return NextResponse.json({ error: 'This chat\'s WhatsApp number isn\'t connected any more.' }, { status: 409 });
        try {
            await sendText(channel, token, metadata.customer_number, text);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'unknown error';
            return NextResponse.json({ error: `WhatsApp didn't send it: ${message}` }, { status: 502 });
        }
        await addManualMessage(db, id, { from: 'owner', text });
    } else {
        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
    const updated = await getConversation(db, projectId, id, access.userId);
    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } });
}
