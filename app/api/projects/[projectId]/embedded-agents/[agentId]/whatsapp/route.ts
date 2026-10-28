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
 *   POST    { action: 'kapso_link', return_path }
 *           Start "Connect WhatsApp" through Kapso: a setup link the business
 *           opens; it comes back to return_path with ?whatsapp=connected.
 *   POST    { action: 'kapso_finish', phone_number_id? }
 *           After that: save the number Kapso connected (the one it named on
 *           the way back) and have Kapso forward its messages here.
 *   POST    { code, phone_number_id?, waba_id?, coexistence? }
 *           Finish Embedded Signup ("Connect WhatsApp"): swap the code for the
 *           business's token, subscribe Cencori's app to their WhatsApp
 *           account, turn the number on for the Cloud API and save it.
 *   DELETE  disconnect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import type { SubscriptionTier } from '@/lib/entitlements';
import { ensureWidgetInstallation } from '@/lib/embedded/widget';
import { getMainSiteUrl } from '@/lib/main-site-url';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { createKapsoSetupLink, ensureKapsoCustomer, ensureKapsoWebhook, kapsoConfigured, listKapsoNumbers } from '@/lib/channels/kapso';
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import {
    getAgentChannel,
    publicChannel,
    saveChannel,
    saveKapsoChannel,
    type WhatsAppChannel,
} from '@/lib/channels/whatsapp';
import { finishSignup, signupConfig } from '@/lib/channels/whatsapp-signup';

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

/**
 * What Facebook will ask for when the business connects, from what Cencori
 * already knows, so the console can show it ready to copy (Meta's sign-up
 * can't be pre-filled through Kapso).
 */
async function businessDetails(db: Admin, projectId: string, agent: { id: string; name: string }, userId: string) {
    const [alerts, { data: widget }, { data: user }] = await Promise.all([
        getOwnerAlerts(db, projectId, agent.id).catch(() => null),
        db.from('agent_widgets').select('allowed_origins').eq('project_id', projectId).eq('agent_id', agent.id).maybeSingle(),
        db.auth.admin.getUserById(userId),
    ]);
    const origin = ((widget?.allowed_origins as string[] | null) ?? []).find((value) => !value.includes('*'));
    return {
        business_name: agent.name,
        email: alerts?.settings.emails[0] ?? user?.user?.email ?? null,
        website: origin ? origin.replace(/^https?:\/\//, '').replace(/^www\./, '') : null,
    };
}

export async function GET(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    const kapso = kapsoConfigured();
    const [channel, { canManage }, details] = await Promise.all([
        getAgentChannel(db, projectId, agentId),
        role(db, access.organizationId, access.userId),
        kapso ? businessDetails(db, projectId, agent, access.userId) : Promise.resolve(null),
    ]);
    return NextResponse.json({ channel: serialize(req, channel), can_manage: canManage, signup: signupConfig(), kapso, details }, { headers: { 'Cache-Control': 'no-store' } });
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
    return NextResponse.json({ channel: serialize(req, saved.channel), can_manage: true, signup: signupConfig() });
}

export async function POST(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (body?.action === 'kapso_link' || body?.action === 'kapso_finish') return kapso(req, projectId, agentId, access, body);
    const config = signupConfig();
    if (!config) return fail('Connecting WhatsApp isn\'t set up on this server yet.', 503);
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    const { canManage, tier } = await role(db, access.organizationId, access.userId);
    if (!canManage) return fail('Only owners and admins can connect WhatsApp.', 403);

    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    const phoneNumberId = typeof body?.phone_number_id === 'string' ? body.phone_number_id.trim() : '';
    const wabaId = typeof body?.waba_id === 'string' ? body.waba_id.trim() : '';
    const coexistence = body?.coexistence === true;
    if (!code) return fail('The WhatsApp sign-up didn\'t finish. Try again.');
    // Without the number (the popup's message never came), the token says which it was.
    const reported = /^\d{5,25}$/.test(phoneNumberId) && /^\d{5,25}$/.test(wabaId);

    const saved = await finishSignup(db, {
        projectId, organizationId: access.organizationId, agentId, agentName: agent.name, tier, code, coexistence,
        ...(reported ? { phoneNumberId, wabaId } : {}),
    });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({ channel: serialize(req, saved.channel), can_manage: true, signup: config });
}

/** The Kapso customer behind one agent's number: the same one on every attempt. */
const kapsoCustomerRef = (projectId: string, agentId: string) => `cencori:${projectId}:${agentId}`;

async function kapso(
    req: NextRequest,
    projectId: string,
    agentId: string,
    access: { organizationId: string; userId: string },
    body: Record<string, unknown>,
) {
    if (!kapsoConfigured()) return fail('Connecting WhatsApp isn\'t set up on this server yet.', 503);
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    const { canManage, tier } = await role(db, access.organizationId, access.userId);
    if (!canManage) return fail('Only owners and admins can connect WhatsApp.', 403);

    let customer;
    try {
        customer = await ensureKapsoCustomer(agent.name, kapsoCustomerRef(projectId, agentId));
    } catch (error) {
        return fail(`Couldn't start connecting WhatsApp: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
    }

    if (body.action === 'kapso_link') {
        // Back to the page they started on, in the console.
        const returnPath = typeof body.return_path === 'string' && /^\/[^/\\]/.test(body.return_path) ? body.return_path.split('?')[0].split('#')[0] : '/';
        // No fragment: Kapso adds its own query parameters to these.
        const back = (outcome: string) => `${req.nextUrl.origin}${returnPath}?whatsapp=${outcome}`;
        try {
            const url = await createKapsoSetupLink(customer.id, { successUrl: back('connected'), failureUrl: back('failed') });
            return NextResponse.json({ url });
        } catch (error) {
            return fail(`Couldn't start connecting WhatsApp: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
        }
    }

    // kapso_finish: the number Kapso named on the way back, if it's this agent's
    // customer's; else its newest connected one.
    const named = typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : '';
    let number;
    try {
        const numbers = await listKapsoNumbers(customer.id);
        number = numbers.find((item) => item.phone_number_id === named)
            ?? numbers.find((item) => !item.status || /connected|active/i.test(item.status))
            ?? numbers[0];
    } catch (error) {
        return fail(`Couldn't read the connected number: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
    }
    if (!number) return fail('WhatsApp didn\'t finish connecting. Try Connect WhatsApp again.', 409);

    const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: agent.name, tier, audience: 'whatsapp' });
    if (!installed.ok) return fail(installed.message, installed.status);
    try {
        // Kapso calls the public site, never the console host.
        await ensureKapsoWebhook(number.phone_number_id, getMainSiteUrl('/api/channels/whatsapp/kapso', resolvePublicOrigin(req)));
    } catch (error) {
        return fail(`Couldn't route the number's messages here: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
    }
    const existing = await getAgentChannel(db, projectId, agentId);
    const saved = await saveKapsoChannel(db, { projectId, agentId, existing, customerId: customer.id, number });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({ channel: serialize(req, saved.channel), can_manage: true, signup: signupConfig(), kapso: true });
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
    return NextResponse.json({ channel: null, can_manage: true, signup: signupConfig(), kapso: kapsoConfigured() });
}
