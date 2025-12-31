import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';

// GET - Fetch security audit log
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

    // Parse query params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '50'), 100);
    const eventType = url.searchParams.get('event_type');
    const timeRange = url.searchParams.get('time_range') || '7d';

    // Calculate time filter
    let startDate = new Date();
    switch (timeRange) {
        case '1h':
            startDate = new Date(Date.now() - 60 * 60 * 1000);
            break;
        case '24h':
            startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            break;
        case '7d':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '30d':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'all':
            startDate = new Date(0);
            break;
    }

    // Build query
    let query = supabase
        .from('security_audit_log')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

    if (eventType && eventType !== 'all') {
        query = query.eq('event_type', eventType);
    }

    const { data: logs, count, error: logsError } = await query;

    if (logsError) {
        console.error('Error fetching audit logs:', logsError);
        return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    return NextResponse.json({
        logs: logs || [],
        pagination: {
            page,
            per_page: perPage,
            total: count || 0,
            total_pages: Math.ceil((count || 0) / perPage),
        }
    });
}
