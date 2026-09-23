import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';

// Session-authenticated overview. Every metric belongs to Embedded Agents,
// rather than the project's unrelated Compute or generic gateway traffic.
export async function GET(_request: Request, ctx: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const db = createAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [
        agents, publishedAgents, tenants, installations, runs, completedRuns,
        failedRuns, recentRuns, pendingActions, unhealthyProviders,
        unhealthyConnections, failingWebhooks,
    ] = await Promise.all([
        db.from('agents').select('id,name,description,is_active,stable_version_id,created_at', { count: 'exact' })
            .eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
        db.from('agents').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).eq('is_active', true).not('stable_version_id', 'is', null),
        db.from('platform_tenants').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).eq('status', 'active'),
        db.from('agent_installations').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).eq('status', 'active'),
        db.from('embedded_runs').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).gte('created_at', since),
        db.from('embedded_runs').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).gte('created_at', since).eq('status', 'completed'),
        db.from('embedded_runs').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).gte('created_at', since).eq('status', 'failed'),
        db.from('embedded_runs').select('id,agent_id,status,created_at')
            .eq('project_id', projectId).order('created_at', { ascending: false }).limit(5),
        db.from('actions').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).eq('status', 'pending'),
        db.from('provider_connections').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).eq('status', 'unhealthy'),
        db.from('tool_connections').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).in('status', ['error', 'expired']),
        db.from('webhooks').select('id', { count: 'exact', head: true })
            .eq('project_id', projectId).gt('failure_count', 0),
    ]);

    const results = {
        agents, publishedAgents, tenants, installations, runs, completedRuns,
        failedRuns, recentRuns, pendingActions, unhealthyProviders,
        unhealthyConnections, failingWebhooks,
    };
    const failedQuery = Object.entries(results).find(([, result]) => result.error);
    if (failedQuery) {
        console.error('[Embedded Agents summary] Query failed:', failedQuery[0], failedQuery[1].error);
        return NextResponse.json({ error: 'Could not load Embedded Agents overview' }, { status: 502 });
    }

    const terminalRuns = (completedRuns.count ?? 0) + (failedRuns.count ?? 0);

    return NextResponse.json({
        agents: agents.count ?? 0,
        published_agents: publishedAgents.count ?? 0,
        active_tenants: tenants.count ?? 0,
        active_installations: installations.count ?? 0,
        runs_7d: runs.count ?? 0,
        failed_runs_7d: failedRuns.count ?? 0,
        run_success_rate_7d: terminalRuns > 0 ? (completedRuns.count ?? 0) / terminalRuns : null,
        pending_actions: pendingActions.count ?? 0,
        unhealthy_providers: unhealthyProviders.count ?? 0,
        unhealthy_connections: unhealthyConnections.count ?? 0,
        failing_webhooks: failingWebhooks.count ?? 0,
        recent_agents: agents.data ?? [],
        recent_runs: recentRuns.data ?? [],
    });
}
