/**
 * GET /api/studio/overview?project_id=&agent_id=
 *
 * What Studio's Home and Assistant tabs show, in one call: the assistant's
 * setup (what it knows, can do, where it works, what's left), today's and
 * this month's chats and money, and the business plan's usage. Days are the
 * business's own (its owner-alerts time zone, Lagos otherwise).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { runAgentReadTool } from '@/lib/copilot/agent-tools';
import { getPaymentsConnection } from '@/lib/embedded/payments';
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import { conversationsUsed, getOrganizationPlan } from '@/lib/business/plans';
import { periodStarts, safeTimeZone } from '@/lib/studio/time';
import { mintWidgetShareToken } from '@/lib/embedded/widget';
import { transferHistory } from '@/lib/embedded/transfers';
import { getCatalog } from '@/lib/embedded/catalog';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();

    const [{ data: project }, { data: organization }, { data: agents }] = await Promise.all([
        db.from('projects').select('id, name, slug').eq('id', projectId).maybeSingle(),
        db.from('organizations').select('id, name, slug').eq('id', access.organizationId).maybeSingle(),
        db.from('agents').select('id, is_active, stable_version_id, created_at').eq('project_id', projectId).order('created_at', { ascending: true }),
    ]);
    if (!project || !organization) return fail('Project not found.', 404);

    // The asked-for assistant, else the first live one, else the first.
    const list = (agents ?? []) as Array<{ id: string; is_active: boolean | null; stable_version_id: string | null }>;
    const wanted = req.nextUrl.searchParams.get('agent_id');
    const agent = list.find((item) => item.id === wanted) ?? list.find((item) => item.is_active && item.stable_version_id) ?? list[0] ?? null;

    const alerts = agent ? await getOwnerAlerts(db, projectId, agent.id).catch(() => null) : null;
    const timeZone = safeTimeZone(alerts?.settings.time_zone);
    const starts = periodStarts(timeZone);

    const chats = (since: Date) => db.from('sessions').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('created_at', since.toISOString())
        // Console previews and tests aren't customers, and a chat nobody wrote in isn't a chat.
        .or('metadata->>preview.is.null,metadata->>preview.eq.false')
        .or('last_turn_number.gt.0,metadata->manual_messages.not.is.null');

    const [summary, today, month, payments, plan, widget] = await Promise.all([
        agent
            ? runAgentReadTool('get_agent', { agent: agent.id }, { admin: db, organization: organization as { id: string; name: string; slug: string }, project: project as { id: string; name: string; slug: string } })
            : Promise.resolve(null),
        chats(starts.day),
        chats(starts.month),
        getPaymentsConnection(db, projectId).catch(() => null),
        getOrganizationPlan(db as never, access.organizationId),
        agent
            ? db.from('agent_widgets').select('id, public_key').eq('project_id', projectId).eq('agent_id', agent.id).maybeSingle().then(({ data }) => data as { id: string; public_key: string } | null)
            : Promise.resolve(null),
    ]);

    // Money that came in through the assistant, counted like the Money tab: paid
    // links, confirmed transfers, and orders the owner marked paid (cash).
    const currency = payments?.metadata.currency ?? 'NGN';
    const [transfers, catalog] = await Promise.all([
        transferHistory(db, projectId).catch(() => []),
        getCatalog(db, projectId).catch(() => null),
    ]);
    const paid = [
        ...(payments?.metadata.payments ?? []).filter((entry) => entry.status === 'paid' && entry.paid_at && entry.currency === currency).map((entry) => ({ amount: entry.amount, at: entry.paid_at! })),
        ...transfers.filter((entry) => entry.status === 'paid' && entry.paid_at && entry.currency === currency).map((entry) => ({ amount: entry.amount, at: entry.paid_at! })),
        ...(catalog?.metadata.orders ?? []).filter((order) => order.paid_by === 'owner' && order.paid_at && order.status !== 'cancelled' && order.currency === currency).map((order) => ({ amount: order.total, at: order.paid_at! })),
    ];
    const earned = (since: Date) => {
        const inPeriod = paid.filter((entry) => new Date(entry.at).getTime() >= since.getTime());
        return { amount: inPeriod.reduce((sum, entry) => sum + entry.amount, 0), count: inPeriod.length };
    };

    const used = plan.accountType === 'business' && plan.periodStart ? await conversationsUsed(db as never, access.organizationId, plan.periodStart) : null;

    return NextResponse.json({
        assistant: summary && !('error' in (summary as object)) ? summary : null,
        // The customer link (/talk/<token>), for sharing and its QR code.
        share_token: widget ? mintWidgetShareToken(widget) : null,
        time_zone: timeZone,
        today: { chats: today.count ?? 0, earned: earned(starts.day) },
        month: { chats: month.count ?? 0, earned: earned(starts.month) },
        currency,
        payments_connected: !!payments,
        plan: plan.accountType === 'business' && plan.plan
            ? { name: plan.plan.name, conversations: plan.plan.conversations, used: used ?? 0, active: plan.active, period_end: plan.periodEnd }
            : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
