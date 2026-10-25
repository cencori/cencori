/**
 * /api/projects/:projectId/embedded-agents/:agentId/widget
 *
 * The agent's website widget.
 *   GET  the widget (null until first saved), a console preview token and,
 *        for admins, the shareable link's token
 *   PUT  { enabled?, allowed_origins?, appearance?, daily_session_cap?, rotate_key? }
 *        Creates the widget on first save. Turning it on sets up the website
 *        visitors customer and a stable-channel installation of the agent.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    WIDGET_COLUMNS,
    WIDGET_MAX_ORIGINS,
    ensureWidgetInstallation,
    generateWidgetKey,
    isMissingWidgetTable,
    mintWidgetPreviewToken,
    mintWidgetShareToken,
    normalizeWidgetOrigin,
    sanitizeAppearance,
    type WidgetRow,
} from '@/lib/embedded/widget';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string; agentId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const NOT_READY = 'The website widget needs a database update (migration 20261025_040000_agent_widgets).';

async function role(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id,subscription_tier').eq('id', organizationId).maybeSingle();
    const tier = ((organization?.subscription_tier as string) || 'free') as SubscriptionTier;
    if (organization?.owner_id === userId) return { canManage: true, tier };
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return { canManage: ['owner', 'admin'].includes((membership?.role as string) ?? ''), tier };
}

async function scopedAgent(db: Admin, projectId: string, agentId: string) {
    const { data } = await db.from('agents').select('id,name,stable_version_id').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return data as { id: string; name: string; stable_version_id: string | null } | null;
}

function serialize(row: WidgetRow, agentName: string) {
    return {
        id: row.id,
        public_key: row.public_key,
        enabled: row.enabled,
        allowed_origins: row.allowed_origins ?? [],
        appearance: sanitizeAppearance(row.appearance, agentName),
        daily_session_cap: row.daily_session_cap,
        ready: Boolean(row.tenant_id && row.installation_id),
        updated_at: row.updated_at,
    };
}

export async function GET(_request: Request, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);

    const [{ data, error }, { canManage }] = await Promise.all([
        db.from('agent_widgets').select(WIDGET_COLUMNS).eq('project_id', projectId).eq('agent_id', agentId).maybeSingle(),
        role(db, access.organizationId, access.userId),
    ]);
    if (error) {
        if (isMissingWidgetTable(error)) return NextResponse.json({ ready: false, message: NOT_READY, widget: null, can_manage: canManage });
        return fail('Could not load the widget.', 502);
    }
    const row = data as WidgetRow | null;
    return NextResponse.json({
        ready: true,
        can_manage: canManage,
        published: Boolean(agent.stable_version_id),
        defaults: sanitizeAppearance(null, agent.name),
        widget: row ? serialize(row, agent.name) : null,
        preview_token: row ? mintWidgetPreviewToken(row.id) : null,
        share_token: row && canManage ? mintWidgetShareToken(row) : null,
    });
}

export async function PUT(request: Request, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    const { canManage, tier } = await role(db, access.organizationId, access.userId);
    if (!canManage) return fail('Only project admins can change the website widget.', 403);

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return fail('Send the widget settings as JSON.');

    const { data: existing, error: loadError } = await db.from('agent_widgets').select(WIDGET_COLUMNS).eq('project_id', projectId).eq('agent_id', agentId).maybeSingle();
    if (loadError) return fail(isMissingWidgetTable(loadError) ? NOT_READY : 'Could not load the widget.', isMissingWidgetTable(loadError) ? 503 : 502);
    const current = existing as WidgetRow | null;

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.allowed_origins !== undefined) {
        if (!Array.isArray(body.allowed_origins) || body.allowed_origins.some((origin) => typeof origin !== 'string')) return fail('Websites must be a list of addresses.');
        const entries = (body.allowed_origins as string[]).map((origin) => origin.trim()).filter(Boolean);
        const invalid = entries.filter((origin) => !normalizeWidgetOrigin(origin));
        if (invalid.length) return fail(`Not a website address: ${invalid.slice(0, 3).join(', ')}`);
        const origins = [...new Set(entries.map((origin) => normalizeWidgetOrigin(origin)!))];
        if (origins.length > WIDGET_MAX_ORIGINS) return fail(`Add up to ${WIDGET_MAX_ORIGINS} websites.`);
        patch.allowed_origins = origins;
    }
    if (body.appearance !== undefined) patch.appearance = sanitizeAppearance(body.appearance, agent.name);
    if (body.daily_session_cap !== undefined) {
        const cap = Number(body.daily_session_cap);
        if (!Number.isInteger(cap) || cap < 1 || cap > 100000) return fail('Daily conversations must be between 1 and 100,000.');
        patch.daily_session_cap = cap;
    }
    if (body.rotate_key === true) patch.public_key = generateWidgetKey();

    const enable = body.enabled === true;
    if (body.enabled !== undefined) patch.enabled = enable;
    if (enable) {
        const origins = (patch.allowed_origins as string[] | undefined) ?? current?.allowed_origins ?? [];
        if (origins.length === 0) return fail('Add the website the widget will run on before turning it on.');
        const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: agent.name, tier });
        if (!installed.ok) return fail(installed.message, installed.status);
        patch.tenant_id = installed.tenantId;
        patch.installation_id = installed.installationId;
    }

    const write = current
        ? db.from('agent_widgets').update(patch).eq('id', current.id).select(WIDGET_COLUMNS).single()
        : db.from('agent_widgets').insert({ project_id: projectId, agent_id: agentId, public_key: generateWidgetKey(), appearance: sanitizeAppearance(null, agent.name), ...patch }).select(WIDGET_COLUMNS).single();
    const { data: saved, error: saveError } = await write;
    if (saveError || !saved) return fail(saveError?.code === '23505' ? 'The widget changed while you were editing. Refresh and try again.' : 'Could not save the widget.', saveError?.code === '23505' ? 409 : 502);

    // Preview needs a running installation even while the widget is off.
    let row = saved as WidgetRow;
    if (!row.installation_id && agent.stable_version_id) {
        const installed = await ensureWidgetInstallation(db, { projectId, agentId, agentName: agent.name, tier });
        if (installed.ok) {
            const { data: linked } = await db.from('agent_widgets').update({ tenant_id: installed.tenantId, installation_id: installed.installationId }).eq('id', row.id).select(WIDGET_COLUMNS).single();
            if (linked) row = linked as WidgetRow;
        }
    }
    return NextResponse.json({ widget: serialize(row, agent.name), preview_token: mintWidgetPreviewToken(row.id), share_token: mintWidgetShareToken(row) });
}
