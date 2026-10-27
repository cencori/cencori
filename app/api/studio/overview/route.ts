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

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Midnight today and the 1st of this month in a time zone, as UTC instants. */
function periodStarts(timeZone: string, now = new Date()): { day: Date; month: Date } {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
            .formatToParts(now)
            .map((part) => [part.type, part.value]),
    );
    // How far the zone's wall clock is ahead of UTC right now.
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const offset = wall - Math.floor(now.getTime() / 1000) * 1000;
    return {
        day: new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day) - offset),
        month: new Date(Date.UTC(+parts.year, +parts.month - 1, 1) - offset),
    };
}

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
    const timeZone = (alerts?.settings as { time_zone?: string } | undefined)?.time_zone || 'Africa/Lagos';
    let starts: { day: Date; month: Date };
    try {
        starts = periodStarts(timeZone);
    } catch {
        starts = periodStarts('Africa/Lagos');
    }

    const chats = (since: Date) => db.from('sessions').select('id', { count: 'exact', head: true })
        .eq('project_id', projectId).gte('created_at', since.toISOString())
        // Console previews and tests aren't customers.
        .or('metadata->>preview.is.null,metadata->>preview.eq.false');

    const [summary, today, month, payments, plan] = await Promise.all([
        agent
            ? runAgentReadTool('get_agent', { agent: agent.id }, { admin: db, organization: organization as { id: string; name: string; slug: string }, project: project as { id: string; name: string; slug: string } })
            : Promise.resolve(null),
        chats(starts.day),
        chats(starts.month),
        getPaymentsConnection(db, projectId).catch(() => null),
        getOrganizationPlan(db as never, access.organizationId),
    ]);

    // Money that came in through the assistant's payment links.
    const paid = (payments?.metadata.payments ?? []).filter((entry) => entry.status === 'paid' && entry.paid_at);
    const earned = (since: Date) => {
        const inPeriod = paid.filter((entry) => new Date(entry.paid_at!).getTime() >= since.getTime());
        return { amount: inPeriod.reduce((sum, entry) => sum + entry.amount, 0), count: inPeriod.length };
    };

    const used = plan.accountType === 'business' && plan.periodStart ? await conversationsUsed(db as never, access.organizationId, plan.periodStart) : null;

    return NextResponse.json({
        assistant: summary && !('error' in (summary as object)) ? summary : null,
        time_zone: timeZone,
        today: { chats: today.count ?? 0, ...(payments ? { earned: earned(starts.day) } : {}) },
        month: { chats: month.count ?? 0, ...(payments ? { earned: earned(starts.month) } : {}) },
        currency: payments?.metadata.currency ?? 'NGN',
        payments_connected: !!payments,
        plan: plan.accountType === 'business' && plan.plan
            ? { name: plan.plan.name, conversations: plan.plan.conversations, used: used ?? 0, active: plan.active, period_end: plan.periodEnd }
            : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
