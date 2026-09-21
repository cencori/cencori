import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';

// GET /api/projects/:projectId/embedded-agents/summary — dashboard support view
// for the Embedded Agents capability page (session-authenticated, redacted).
export async function GET(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await ctx.params;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;

    const supabase = createAdminClient();
    const since = new Date(Date.now() - 7 * 86400 * 1000).toISOString();

    const [{ count: tenants }, { count: installations }, { count: knowledgeBases }] = await Promise.all([
        supabase.from('platform_tenants').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('agent_installations').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
        supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
    ]).then((rows) => rows as Array<{ count: number | null }>);

    const { data: runs } = await supabase
        .from('embedded_runs')
        .select('status')
        .eq('project_id', projectId)
        .gte('created_at', since)
        .limit(1000);
    const runRows = (runs ?? []) as Array<{ status: string }>;
    const completed = runRows.filter((r) => r.status === 'completed').length;

    const [{ count: pendingActions }, { data: connections }, { data: webhooks }] = await Promise.all([
        supabase.from('actions').select('id', { count: 'exact', head: true }).eq('project_id', projectId).eq('status', 'pending'),
        supabase.from('tool_connections').select('status').eq('project_id', projectId).limit(100),
        supabase.from('webhooks').select('is_active,failure_count').eq('project_id', projectId).limit(100),
    ]) as unknown as [{ count: number | null }, { data: Array<{ status: string }> | null }, { data: Array<{ is_active: boolean; failure_count: number }> | null }];

    const unhealthyConnections = (connections ?? []).filter((c) => c.status !== 'active').length;
    const failingWebhooks = (webhooks ?? []).filter((w) => (w.failure_count ?? 0) > 0).length;

    return NextResponse.json({
        tenants: tenants ?? 0,
        installations: installations ?? 0,
        knowledge_bases: knowledgeBases ?? 0,
        runs_7d: runRows.length,
        run_success_rate_7d: runRows.length > 0 ? completed / runRows.length : null,
        pending_actions: pendingActions ?? 0,
        unhealthy_connections: unhealthyConnections,
        failing_webhooks: failingWebhooks,
    });
}
