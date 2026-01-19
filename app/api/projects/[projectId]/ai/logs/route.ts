import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { projectId } = await params;
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, organization_id')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { data: member, error: memberError } = await supabase
            .from('organization_members')
            .select('id')
            .eq('organization_id', project.organization_id)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        let query = supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact' })
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        const { data: logs, error: logsError, count } = await query;

        if (logsError) {
            console.error('[AI Logs] Error fetching logs:', logsError);
            return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
        }

        return NextResponse.json({
            logs: logs || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
            },
        });
    } catch (error) {
        console.error('[AI Logs] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
