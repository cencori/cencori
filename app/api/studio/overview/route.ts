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
import { getOwnerAlerts } from '@/lib/embedded/owner-alerts';
import { conversationCapacity, conversationsUsed, getOrganizationPlan } from '@/lib/business/plans';
import { periodStarts, safeTimeZone } from '@/lib/studio/time';
import { mintWidgetShareToken } from '@/lib/embedded/widget';
import { earnedSince, paidThroughAssistant } from '@/lib/studio/earned';
import { latestBrief } from '@/lib/studio/brief';

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

    const [summary, today, month, money, plan, widget, brief] = await Promise.all([
        agent
            ? runAgentReadTool('get_agent', { agent: agent.id }, { admin: db, organization: organization as { id: string; name: string; slug: string }, project: project as { id: string; name: string; slug: string } })
            : Promise.resolve(null),
        chats(starts.day),
        chats(starts.month),
        paidThroughAssistant(db, projectId),
        getOrganizationPlan(db as never, access.organizationId),
        agent
            ? db.from('agent_widgets').select('id, public_key').eq('project_id', projectId).eq('agent_id', agent.id).maybeSingle().then(({ data }) => data as { id: string; public_key: string } | null)
            : Promise.resolve(null),
        latestBrief(db, projectId, timeZone).catch(() => null),
    ]);

    const { currency, paid } = money;
    const earned = (since: Date) => earnedSince(paid, since);

    const used = plan.accountType === 'business' && plan.periodStart ? await conversationsUsed(db as never, access.organizationId, plan.periodStart) : null;

    return NextResponse.json({
        assistant: summary && !('error' in (summary as object)) ? summary : null,
        // The customer link (/talk/<token>), for sharing and its QR code.
        share_token: widget ? mintWidgetShareToken(widget) : null,
        time_zone: timeZone,
        // This morning's brief (covering yesterday), if one went out.
        brief: brief ? { headline: brief.headline, points: brief.points, at: brief.at } : null,
        today: { chats: today.count ?? 0, earned: earned(starts.day) },
        month: { chats: month.count ?? 0, earned: earned(starts.month) },
        currency,
        payments_connected: money.connected,
        plan: plan.accountType === 'business' && plan.plan
            ? { name: plan.plan.name, conversations: plan.plan.conversations, capacity: conversationCapacity(plan.plan), agents: plan.plan.agents, used: used ?? 0, active: plan.active, in_grace: plan.inGrace, period_end: plan.periodEnd, grace_end: plan.graceEnd, earned: plan.periodStart ? earned(new Date(plan.periodStart)) : null }
            : null,
    }, { headers: { 'Cache-Control': 'no-store' } });
}
