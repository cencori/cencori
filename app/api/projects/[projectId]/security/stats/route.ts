import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

// GET - Fetch security dashboard stats
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, organization_id, organizations!inner(owner_id)')
        .eq('id', projectId)
        .single();

    if (projectError || !project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get incident counts by severity (last 30 days)
    const { data: severityCounts } = await supabase
        .from('security_incidents')
        .select('severity')
        .eq('project_id', projectId)
        .gte('created_at', last30d);

    const severityBreakdown = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
    };

    severityCounts?.forEach(inc => {
        severityBreakdown[inc.severity as keyof typeof severityBreakdown]++;
    });

    // Get blocked count last 24h
    const { count: blocked24h } = await supabase
        .from('security_incidents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('created_at', last24h);

    // Get blocked count last 7d
    const { count: blocked7d } = await supabase
        .from('security_incidents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('created_at', last7d);

    // Get pending reviews
    const { count: pendingReviews } = await supabase
        .from('security_incidents')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('reviewed', false);

    // Get total requests in last 7d for blocked rate calculation
    const { count: totalRequests7d } = await supabase
        .from('ai_requests')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .gte('created_at', last7d);

    // Calculate threat score (weighted average)
    const totalIncidents30d = severityCounts?.length || 0;
    const threatScore = totalIncidents30d > 0
        ? Math.min(100, Math.round(
            ((severityBreakdown.critical * 4) +
                (severityBreakdown.high * 3) +
                (severityBreakdown.medium * 2) +
                (severityBreakdown.low * 1)) / totalIncidents30d * 10
        ))
        : 0;

    // Get incident types breakdown
    const { data: typeCounts } = await supabase
        .from('security_incidents')
        .select('incident_type')
        .eq('project_id', projectId)
        .gte('created_at', last30d);

    const typeBreakdown: Record<string, number> = {};
    typeCounts?.forEach(inc => {
        typeBreakdown[inc.incident_type] = (typeBreakdown[inc.incident_type] || 0) + 1;
    });

    // Get trend data (incidents per day for last 7 days)
    const trendData: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setUTCDate(dayStart.getUTCDate() - i);
        dayStart.setUTCHours(0, 0, 0, 0);

        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

        const { count } = await supabase
            .from('security_incidents')
            .select('id', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', dayStart.toISOString())
            .lt('created_at', dayEnd.toISOString());

        trendData.push({
            date: dayStart.toISOString().split('T')[0],
            count: count || 0,
        });
    }

    return NextResponse.json({
        stats: {
            threatScore,
            blocked24h: blocked24h || 0,
            blocked7d: blocked7d || 0,
            pendingReviews: pendingReviews || 0,
            blockedRate: totalRequests7d && blocked7d
                ? ((blocked7d / totalRequests7d) * 100).toFixed(2)
                : '0.00',
            severityBreakdown,
            typeBreakdown,
            trendData,
            totalIncidents30d,
        }
    });
}
