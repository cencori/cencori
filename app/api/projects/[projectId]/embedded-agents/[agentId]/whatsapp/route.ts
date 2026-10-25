/**
 * /api/projects/:projectId/embedded-agents/:agentId/whatsapp
 *
 * The agent's WhatsApp channel.
 *   GET     the channel (null until connected), with the webhook URL and
 *           verify token to paste into the Meta app
 *   PUT     { phone_number_id, access_token?, app_secret?, enabled?, daily_session_cap? }
 *           Checks the credentials with Meta and saves them. A blank token or
 *           secret keeps the stored one. Turning it on sets up the WhatsApp
 *           customers installation of the published agent.
 *   DELETE  disconnect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import type { SubscriptionTier } from '@/lib/entitlements';
import { ensureWidgetInstallation } from '@/lib/embedded/widget';
import { getMainSiteUrl } from '@/lib/main-site-url';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { getAgentChannel, publicChannel, saveChannel, type WhatsAppChannel } from '@/lib/channels/whatsapp';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string; agentId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function role(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id,subscription_tier').eq('id', organizationId).maybeSingle();
    const tier = ((organization?.subscription_tier as string) || 'free') as SubscriptionTier;
    if (organization?.owner_id === userId) return { canManage: true, tier };
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return { canManage: ['owner', 'admin'].includes((membership?.role as string) ?? ''), tier };
}

async function scopedAgent(db: Admin, projectId: string, agentId: string) {
    const { data } = await db.from('agents').select('id,name').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return data as { id: string; name: string } | null;
}

function serialize(req: NextRequest, channel: WhatsAppChannel | null) {
    if (!channel) return null;
    // Meta calls the public site, never the console host.
    return publicChannel(channel, getMainSiteUrl(`/api/channels/whatsapp/${channel.id}`, resolvePublicOrigin(req)));
}

export async function GET(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await scopedAgent(db, projectId, agentId)) return fail('Agent not found in this project.', 404);
    const [channel, { canManage }] = await Promise.all([getAgentChannel(db, projectId, agentId), role(db, access.organizationId, access.userId)]);
    return NextResponse.json({ channel: serialize(req, channel), can_manage: canManage }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    const { canManage, tier } = await role(db, access.organizationId, access.userId);
    if (!canManage) return fail('Only owners and admins can connect WhatsApp.', 403);

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return fail('Invalid request body.');
    const existing = await getAgentChannel(db, projectId, agentId);
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : undefined;

    // Only a published agent can answer customers.
    if (enabled ?? existing?.metadata.enabled ?? true) {
        const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: agent.name, tier, audience: 'whatsapp' });
        if (!installed.ok) return fail(installed.message, installed.status);
    }

    const saved = await saveChannel(db, {
        projectId,
        organizationId: access.organizationId,
        agentId,
        existing,
        phoneNumberId: typeof body.phone_number_id === 'string' ? body.phone_number_id : existing?.metadata.phone_number_id ?? '',
        accessToken: typeof body.access_token === 'string' ? body.access_token : undefined,
        appSecret: typeof body.app_secret === 'string' ? body.app_secret : undefined,
        enabled,
        dailySessionCap: typeof body.daily_session_cap === 'number' ? body.daily_session_cap : undefined,
    });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({ channel: serialize(req, saved.channel), can_manage: true });
}

export async function DELETE(_req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const { canManage } = await role(db, access.organizationId, access.userId);
    if (!canManage) return fail('Only owners and admins can disconnect WhatsApp.', 403);
    const existing = await getAgentChannel(db, projectId, agentId);
    if (existing) await db.from('tool_connections').delete().eq('id', existing.id).eq('project_id', projectId);
    return NextResponse.json({ channel: null, can_manage: true });
}
