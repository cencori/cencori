/**
 * GET   /api/studio/assistants?project_id=
 *       Studio's AI tab: every assistant in the business, with whether it's
 *       live, where it answers and its chats this week.
 * PATCH /api/studio/assistants  { project_id, agent_id, active }
 *       Pause an assistant (it stops starting chats everywhere) or switch it
 *       back on. Owners and admins.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { WHATSAPP_CHANNEL_SLUG } from '@/lib/channels/whatsapp';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id');
    if (!isId(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [{ data: agents }, { data: widgets }, { data: channels }, { data: sessions }] = await Promise.all([
        db.from('agents').select('id, name, is_active, stable_version_id, created_at').eq('project_id', projectId).order('created_at', { ascending: true }),
        db.from('agent_widgets').select('agent_id, enabled').eq('project_id', projectId),
        db.from('tool_connections').select('metadata').eq('project_id', projectId).eq('connector_slug', WHATSAPP_CHANNEL_SLUG),
        // Chats this week: real customers only (no previews), where someone said something.
        db.from('sessions').select('agent_id').eq('project_id', projectId).gte('created_at', weekAgo)
            .or('metadata->>preview.is.null,metadata->>preview.eq.false')
            .or('last_turn_number.gt.0,metadata->manual_messages.not.is.null')
            .limit(5000),
    ]);
    const chats = new Map<string, number>();
    for (const row of (sessions ?? []) as Array<{ agent_id: string | null }>) if (row.agent_id) chats.set(row.agent_id, (chats.get(row.agent_id) ?? 0) + 1);
    const whatsappFor = new Map<string, string | null>();
    for (const row of (channels ?? []) as Array<{ metadata: { agent_id?: string; display_phone_number?: string; phone?: string } | null }>) {
        const agentId = row.metadata?.agent_id;
        if (agentId) whatsappFor.set(agentId, row.metadata?.display_phone_number ?? row.metadata?.phone ?? null);
    }
    const widgetFor = new Map(((widgets ?? []) as Array<{ agent_id: string; enabled: boolean }>).map((row) => [row.agent_id, row.enabled]));
    return NextResponse.json({
        assistants: ((agents ?? []) as Array<{ id: string; name: string; is_active: boolean | null; stable_version_id: string | null }>).map((agent) => ({
            id: agent.id,
            name: agent.name,
            published: !!agent.stable_version_id,
            active: agent.is_active !== false,
            whatsapp: whatsappFor.has(agent.id) ? { number: whatsappFor.get(agent.id) ?? null } : null,
            // The link works once there's a widget; the website only when it's switched on.
            link: widgetFor.has(agent.id),
            website: widgetFor.get(agent.id) === true,
            chats_this_week: chats.get(agent.id) ?? 0,
        })),
    }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; agent_id?: unknown; active?: unknown } | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id) || typeof body?.active !== 'boolean') return fail('Say which assistant, and on or off.');
    const access = await requireProjectAccess(body.project_id);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can pause an assistant.', 403);
    const db = createAdminClient();
    const { data, error } = await db.from('agents').update({ is_active: body.active }).eq('project_id', body.project_id).eq('id', body.agent_id).select('id, is_active').maybeSingle();
    if (error || !data) return fail('That assistant isn\'t there any more.', 404);
    return NextResponse.json({ id: data.id, active: data.is_active !== false });
}
