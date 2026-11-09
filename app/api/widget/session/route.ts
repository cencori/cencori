/**
 * POST /api/widget/session
 *
 * Called by the widget frame (same origin as this route) to open or resume a
 * visitor's conversation. Returns a 15-minute client token scoped to that one
 * session, which the frame uses against /v1/sessions/:id/turns.
 *   body { key, visitor_id, session_id?, parent_origin?, preview?, share? }
 *
 * Visitors are anonymous, so this is the abuse boundary: the frame's origin,
 * the site allowlist (or a signed share-link token instead), a per-IP hourly cap on new conversations and a per-day
 * cap per widget. Turn pace and length are capped in the turns route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { mintClientToken } from '@/lib/embedded/client-tokens';
import {
    WIDGET_COLUMNS,
    WIDGET_SESSIONS_PER_IP_PER_HOUR,
    isMissingWidgetTable,
    isWidgetKey,
    originAllowed,
    verifyWidgetPreviewToken,
    verifyWidgetShareToken,
    type WidgetRow,
} from '@/lib/embedded/widget';

const fail = (status: number, code: string, message: string) => NextResponse.json({ error: { code, message } }, { status });

/**
 * Agent UI (<AgentChat widgetKey>) calls this from the business's own site
 * rather than from our frame. That's allowed when the browser's Origin is one
 * of the widget's allowed sites: the same check the frame makes on the page
 * it's embedded in, but on the header a browser can't forge.
 */
function withCors(res: NextResponse, origin: string | null): NextResponse {
    if (origin) {
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Vary', 'Origin');
    }
    return res;
}

export async function OPTIONS(req: NextRequest) {
    const res = new NextResponse(null, { status: 204 });
    res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    res.headers.set('Access-Control-Max-Age', '86400');
    return withCors(res, req.headers.get('origin'));
}

function sameOrigin(req: NextRequest) {
    const origin = req.headers.get('origin');
    if (!origin) return false;
    try {
        return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host'));
    } catch {
        return false;
    }
}

export async function POST(req: NextRequest) {
    const crossOrigin = !sameOrigin(req);
    const requestOrigin = req.headers.get('origin');
    const res = await open(req, crossOrigin ? requestOrigin : null);
    return crossOrigin ? withCors(res, requestOrigin) : res;
}

async function open(req: NextRequest, crossOrigin: string | null): Promise<NextResponse> {
    // The widget frame (served from this origin) opens conversations; so can a
    // page on one of the widget's allowed sites (checked below).
    if (crossOrigin === null && !sameOrigin(req)) return fail(403, 'widget_origin_denied', 'Open this chat from the website widget.');

    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || !isWidgetKey(body.key)) return fail(400, 'invalid_request', 'Missing widget key.');
    const visitorId = typeof body.visitor_id === 'string' && /^v_[A-Za-z0-9-]{8,64}$/.test(body.visitor_id) ? body.visitor_id : null;
    if (!visitorId) return fail(400, 'invalid_request', 'Missing visitor id.');

    const db = createAdminClient();
    const { data, error } = await db.from('agent_widgets').select(WIDGET_COLUMNS).eq('public_key', body.key).maybeSingle();
    if (error && !isMissingWidgetTable(error)) return fail(502, 'widget_unavailable', 'This chat is unavailable right now.');
    const widget = data as WidgetRow | null;
    if (!widget) return fail(404, 'widget_not_found', 'This chat no longer exists.');

    // Preview and share links belong to our own pages, never another site's.
    const preview = crossOrigin === null && verifyWidgetPreviewToken(body.preview, widget.id);
    // The shareable link is its own page, so there's no embedding site to check.
    const shared = crossOrigin === null && !preview && verifyWidgetShareToken(body.share, widget);
    if (!preview && !shared) {
        if (!widget.enabled) return fail(403, 'widget_disabled', 'This chat is turned off.');
        // From another site, the browser's own Origin header is the site. The frame
        // names the page it's embedded in; a page of ours calling directly (Agent UI
        // on our own site) is its own site.
        const parentOrigin = crossOrigin ?? (typeof body.parent_origin === 'string' ? body.parent_origin : req.headers.get('origin'));
        if (!originAllowed(parentOrigin, widget.allowed_origins)) return fail(403, 'widget_origin_denied', 'This chat isn’t enabled on this website.');
    }
    if (!widget.tenant_id || !widget.installation_id) return fail(409, 'widget_not_ready', 'This chat isn’t set up yet.');

    const { data: installation } = await db.from('agent_installations').select('id, agent_id, status').eq('project_id', widget.project_id).eq('id', widget.installation_id).maybeSingle();
    if (!installation || installation.status !== 'active') return fail(409, 'widget_not_ready', 'This chat isn’t available right now.');
    const { checkAgentActivity } = await import('@/lib/embedded/agents');
    const activity = await checkAgentActivity(db as never, widget.project_id, widget.agent_id);
    if ('unavailable' in activity) return fail(503, 'widget_unavailable', 'This chat is unavailable right now. Try again shortly.');
    if (!activity.active) return fail(409, 'widget_unavailable', 'This chat is turned off.');
    // A lapsed Pro subscription past its grace period pauses the org's projects.
    {
        const { data: owner } = await db.from('projects').select('organization_id').eq('id', widget.project_id).maybeSingle();
        const { pausedPlanBody } = await import('@/lib/billing/plan-gate');
        if (await pausedPlanBody(owner?.organization_id as string | undefined, db as never)) {
            return fail(402, 'widget_unavailable', 'This chat is unavailable right now. Please contact the business directly.');
        }
    }

    // Resume the visitor's conversation when it's still open.
    let sessionId: string | null = null;
    if (typeof body.session_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.session_id)) {
        const { data: existing } = await db.from('sessions').select('id, status')
            .eq('id', body.session_id).eq('project_id', widget.project_id)
            .eq('installation_id', widget.installation_id).eq('external_user_id', visitorId)
            .maybeSingle();
        if (existing?.status === 'active') sessionId = existing.id as string;
    }

    const resumed = sessionId !== null;
    if (!sessionId) {
        if (!preview) {
            const { checkCustomRateLimit } = await import('@/lib/rate-limit');
            const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
            const [perIp, perDay] = await Promise.all([
                checkCustomRateLimit(`widget_ip:${widget.id}:${ip}`, WIDGET_SESSIONS_PER_IP_PER_HOUR, 3600),
                checkCustomRateLimit(`widget_day:${widget.id}`, widget.daily_session_cap, 86400),
            ]);
            if (!perIp.allowed) return fail(429, 'widget_rate_limited', 'Too many conversations from this connection. Try again later.');
            if (!perDay.allowed) return fail(429, 'widget_daily_limit', 'This chat is busy right now. Try again later.');
        }
        const { data: project } = await db.from('projects').select('organization_id').eq('id', widget.project_id).maybeSingle();
        // A business plan pays per conversation, counted when the first message is
        // sent (the turns route), so a chat opened and never used costs nothing. A
        // plan that's used up or inactive still says so before anyone types.
        if (!preview && project?.organization_id) {
            const { getOrganizationPlan, conversationsUsed, conversationCapacity } = await import('@/lib/business/plans');
            const plan = await getOrganizationPlan(db as never, project.organization_id as string);
            if (plan.accountType === 'business') {
                const closed = !plan.active || !plan.plan || !plan.periodStart
                    || await conversationsUsed(db as never, project.organization_id as string, plan.periodStart) >= conversationCapacity(plan.plan);
                if (closed) return fail(402, plan.active ? 'plan_conversations_used' : 'plan_inactive', 'This chat isn’t taking new conversations right now. Please contact the business directly.');
            }
        }
        const { data: created, error: createError } = await db.from('sessions').insert({
            project_id: widget.project_id,
            organization_id: (project?.organization_id as string | undefined) ?? null,
            status: 'active',
            agent_id: widget.agent_id,
            tenant_id: widget.tenant_id,
            external_user_id: visitorId,
            installation_id: widget.installation_id,
            metadata: {
                source: shared ? 'link' : 'widget', widget_id: widget.id, preview,
                parent_origin: (crossOrigin ?? (typeof body.parent_origin === 'string' ? body.parent_origin : req.headers.get('origin')))?.slice(0, 200) ?? null,
                ...(crossOrigin || typeof body.parent_origin !== 'string' ? { client: 'agent-ui' } : {}),
            },
        }).select('id').single();
        if (createError || !created) return fail(502, 'widget_unavailable', 'Could not start the conversation. Try again.');
        sessionId = created.id as string;
    }

    const { token, expiresAt } = mintClientToken({
        projectId: widget.project_id,
        environment: 'production',
        tenantId: widget.tenant_id,
        externalUserId: visitorId,
        installationIds: [widget.installation_id],
        permissions: ['sessions:turn'],
        sessionId,
        expiresInSeconds: 900,
    });
    return NextResponse.json({ token, expires_at: expiresAt, session_id: sessionId, resumed }, { headers: { 'Cache-Control': 'no-store' } });
}
