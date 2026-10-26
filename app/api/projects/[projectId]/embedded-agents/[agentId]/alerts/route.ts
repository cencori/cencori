/**
 * /api/projects/:projectId/embedded-agents/:agentId/alerts
 *
 * Owner alerts: who's emailed about the agent's bookings and callback
 * requests, and the morning summary.
 *   GET   the settings and the latest alerts
 *   PUT   { emails, bookings?, callbacks?, daily_summary?, time_zone? }
 *   POST  { action: 'test' } send a test email to the saved addresses
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { getOwnerAlerts, publicAlerts, saveOwnerAlerts, sendTestAlert } from '@/lib/embedded/owner-alerts';

type Admin = ReturnType<typeof createAdminClient>;
type Context = { params: Promise<{ projectId: string; agentId: string }> };

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function canManage(db: Admin, organizationId: string, userId: string) {
    const { data: organization } = await db.from('organizations').select('owner_id').eq('id', organizationId).maybeSingle();
    if (organization?.owner_id === userId) return true;
    const { data: membership } = await db.from('organization_members').select('role').eq('organization_id', organizationId).eq('user_id', userId).maybeSingle();
    return ['owner', 'admin'].includes((membership?.role as string) ?? '');
}

async function scopedAgent(db: Admin, projectId: string, agentId: string) {
    const { data } = await db.from('agents').select('id,name').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    return data as { id: string; name: string } | null;
}

export async function GET(_req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await scopedAgent(db, projectId, agentId)) return fail('Agent not found in this project.', 404);
    const [alerts, manage] = await Promise.all([getOwnerAlerts(db, projectId, agentId), canManage(db, access.organizationId, access.userId)]);
    return NextResponse.json({ alerts: publicAlerts(alerts), configured: !!alerts, can_manage: manage }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    if (!await scopedAgent(db, projectId, agentId)) return fail('Agent not found in this project.', 404);
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can change alerts.', 403);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return fail('Invalid request body.');
    const existing = await getOwnerAlerts(db, projectId, agentId);
    const saved = await saveOwnerAlerts(db, {
        projectId, agentId, existing,
        emails: body.emails, bookings: body.bookings, callbacks: body.callbacks, dailySummary: body.daily_summary, timeZone: body.time_zone,
    });
    if (!saved.ok) return fail(saved.message);
    return NextResponse.json({ alerts: publicAlerts(saved.alerts), configured: true, can_manage: true });
}

export async function POST(req: NextRequest, ctx: Context) {
    const { projectId, agentId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const agent = await scopedAgent(db, projectId, agentId);
    if (!agent) return fail('Agent not found in this project.', 404);
    if (!await canManage(db, access.organizationId, access.userId)) return fail('Only owners and admins can send test alerts.', 403);
    const body = await req.json().catch(() => null) as { action?: string } | null;
    if (body?.action !== 'test') return fail('Unknown action.');
    const { checkCustomRateLimit } = await import('@/lib/rate-limit');
    if (!(await checkCustomRateLimit(`owner_alert_test:${agentId}`, 5, 3600)).allowed) return fail('That\'s a lot of test emails. Try again in an hour.', 429);
    const alerts = await getOwnerAlerts(db, projectId, agentId);
    if (!alerts || alerts.settings.emails.length === 0) return fail('Add an email address and save first.');
    if (!await sendTestAlert(alerts, agent.name)) return fail('The test email couldn\'t be sent. Try again shortly.', 502);
    return NextResponse.json({ sent: alerts.settings.emails.length });
}
