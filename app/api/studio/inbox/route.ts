/**
 * GET /api/studio/inbox?project_id=&channel=whatsapp|website|link
 *
 * Studio's Inbox: the project's customer conversations, newest first, each
 * with its last message.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { listConversations, type InboxChannel } from '@/lib/studio/inbox';

const CHANNELS = new Set<InboxChannel>(['whatsapp', 'website', 'link']);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: 'Say which project.' }, { status: 400 });
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const requested = req.nextUrl.searchParams.get('channel') as InboxChannel | null;
    const conversations = await listConversations(createAdminClient(), projectId, { channel: requested && CHANNELS.has(requested) ? requested : null });
    return NextResponse.json({ conversations }, { headers: { 'Cache-Control': 'no-store' } });
}
