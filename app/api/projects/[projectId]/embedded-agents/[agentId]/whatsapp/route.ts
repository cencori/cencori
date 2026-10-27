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
 *   POST    { action: 'kapso_finish' }
 *           After that: save the number Kapso connected and have Kapso forward
 *           its messages here.
 *   POST    { code, phone_number_id, waba_id, coexistence? }
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
import { randomInt } from 'crypto';
import { encryptApiKey } from '@/lib/encryption';
import { createKapsoSetupLink, ensureKapsoCustomer, ensureKapsoWebhook, kapsoConfigured, listKapsoNumbers } from '@/lib/channels/kapso';
import {
    META_GRAPH_VERSION,
    assignSystemUserToWaba,
    exchangeSignupCode,
    getAgentChannel,
    publicChannel,
    registerPhoneNumber,
    saveChannel,
    saveKapsoChannel,
    saveSignupChannel,
    subscribeAppToWaba,
    type WhatsAppChannel,
} from '@/lib/channels/whatsapp';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string; agentId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** What the console needs to open Meta's sign-up popup; null until Cencori's Meta app is configured. */
function signupConfig() {
    const appId = process.env.META_APP_ID;
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;
    return appId && configId && process.env.META_APP_SECRET ? { app_id: appId, config_id: configId, graph_version: META_GRAPH_VERSION } : null;
}

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
    return NextResponse.json({ channel: serialize(req, channel), can_manage: canManage, signup: signupConfig(), kapso: kapsoConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
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
    if (!code || !/^\d{5,25}$/.test(phoneNumberId) || !/^\d{5,25}$/.test(wabaId)) return fail('The WhatsApp sign-up didn\'t finish. Try again.');

    const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: agent.name, tier, audience: 'whatsapp' });
    if (!installed.ok) return fail(installed.message, installed.status);

    let token: string;
    try {
        token = await exchangeSignupCode(code, config.app_id, process.env.META_APP_SECRET!);
        await subscribeAppToWaba(wabaId, token);
    } catch (error) {
        return fail(`Meta didn't finish connecting the number: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
    }
    // A new number has to be turned on for the Cloud API, with a two-step PIN we keep.
    let pinEncrypted: string | null = null;
    if (!coexistence) {
        const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
        try {
            await registerPhoneNumber(phoneNumberId, token, pin);
            pinEncrypted = encryptApiKey(pin, access.organizationId);
        } catch (error) {
            // Already registered (a reconnect) is fine; anything else is surfaced.
            const message = error instanceof Error ? error.message : 'unknown error';
            if (!/already registered|registered/i.test(message)) return fail(`Meta didn't turn the number on: ${message}`, 502);
        }
    }

    const existing = await getAgentChannel(db, projectId, agentId);
    const saved = await saveSignupChannel(db, { projectId, organizationId: access.organizationId, agentId, existing, phoneNumberId, wabaId, accessToken: token, coexistence });
    if (!saved.ok) return fail(saved.message, saved.status);
    // The signup token lasts 60 days; Cencori's system user doesn't expire. Best-effort:
    // without it the stored token is used, and the console shows when it runs out.
    let systemUserAssigned = false;
    const systemUserId = process.env.META_SYSTEM_USER_ID;
    const systemUserToken = process.env.META_SYSTEM_USER_TOKEN;
    if (systemUserId && systemUserToken) {
        try {
            await assignSystemUserToWaba(wabaId, systemUserId, systemUserToken);
            systemUserAssigned = true;
        } catch (error) {
            console.error('[whatsapp] system user assignment failed', error instanceof Error ? error.message : error);
        }
    }
    await db.from('tool_connections').update({
        metadata: {
            ...saved.channel.metadata,
            system_user_assigned: systemUserAssigned,
            token_expires_at: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            ...(pinEncrypted ? { registration_pin_encrypted: pinEncrypted } : {}),
        },
    }).eq('id', saved.channel.id);
    saved.channel.metadata.system_user_assigned = systemUserAssigned;
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
        const back = (outcome: string) => `${req.nextUrl.origin}${returnPath}?whatsapp=${outcome}#whatsapp`;
        try {
            const url = await createKapsoSetupLink(customer.id, { successUrl: back('connected'), failureUrl: back('failed') });
            return NextResponse.json({ url });
        } catch (error) {
            return fail(`Couldn't start connecting WhatsApp: ${error instanceof Error ? error.message : 'unknown error'}`, 502);
        }
    }

    // kapso_finish: the newest connected number of this agent's customer.
    let number;
    try {
        const numbers = await listKapsoNumbers(customer.id);
        number = numbers.find((item) => !item.status || /connected|active/i.test(item.status)) ?? numbers[0];
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
