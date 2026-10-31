/**
 * GET /api/widget/messages?since=<iso>
 *
 * What the business owner said in this conversation from Studio, after
 * `since`, and whether they're handling it right now (the assistant is
 * paused). Also what the assistant passed on for the owner (Copilot's
 * message_customer and payment links: from "assistant"), which arrives this
 * way too, not as a reply to the visitor. The widget polls this while it's
 * open. Authorized by the conversation's client token, so it only ever reads
 * that one session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { extractBearerToken } from '@/lib/api-keys';
import { verifyClientToken } from '@/lib/embedded/client-tokens';
import { isOwnerActive, manualMessages } from '@/lib/studio/takeover';

export async function GET(req: NextRequest) {
    const verified = verifyClientToken(extractBearerToken(req.headers.get('Authorization')) ?? '');
    if (!verified.ok) return NextResponse.json({ error: { code: verified.code, message: verified.message } }, { status: 401 });
    const sessionId = verified.claims.session_id;
    if (!sessionId) return NextResponse.json({ owner_active: false, messages: [] });

    const db = createAdminClient();
    const { data } = await db.from('sessions').select('metadata')
        .eq('id', sessionId).eq('project_id', verified.claims.project_id)
        .eq('external_user_id', verified.claims.external_user_id)
        .maybeSingle();
    if (!data) return NextResponse.json({ owner_active: false, messages: [] });

    const metadata = data.metadata as Record<string, unknown> | null;
    const since = Date.parse(req.nextUrl.searchParams.get('since') ?? '');
    const messages = manualMessages(metadata)
        .filter((m) => (m.from === 'owner' || m.from === 'assistant') && (!Number.isFinite(since) || Date.parse(m.at) > since))
        .slice(-20)
        .map((m) => ({ id: m.id, from: m.from, text: m.text, at: m.at }));
    return NextResponse.json({ owner_active: isOwnerActive(metadata), messages }, { headers: { 'Cache-Control': 'no-store' } });
}
