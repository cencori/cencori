import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; endUserId: string }> }
) {
    try {
        const { projectId, endUserId } = await params;
        const supabase = await createServerClient();
        const supabaseAdmin = createAdminClient();

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('id, organization_id, organizations!inner(owner_id)')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const ownerId = (project.organizations as { owner_id?: string } | null)?.owner_id || null;
        const isOwner = ownerId === user.id;

        if (!isOwner) {
            const { data: membership } = await supabaseAdmin
                .from('organization_members')
                .select('role')
                .eq('organization_id', project.organization_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!membership) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        // Verify end-user exists and belongs to project
        const { data: endUser, error: endUserError } = await supabaseAdmin
            .from('end_users')
            .select('id, external_id')
            .eq('id', endUserId)
            .eq('project_id', projectId)
            .single();

        if (endUserError || !endUser) {
            return NextResponse.json({ error: 'End-user not found' }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const period = searchParams.get('period') || 'daily'; // 'daily' | 'monthly'
        const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30', 10)));

        const since = new Date();
        since.setDate(since.getDate() - days);

        let query = supabaseAdmin
            .from('end_user_usage')
            .select('*')
            .eq('end_user_id', endUserId)
            .gte('period_start', since.toISOString());

        if (period === 'monthly') {
            query = query.eq('period_type', 'monthly');
        } else {
            query = query.eq('period_type', 'daily');
        }

        query = query.order('period_start', { ascending: true });

        const { data: usage, error: usageError } = await query;

        if (usageError) {
            console.error('Error fetching end-user usage:', usageError);
            return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
        }

        // Transform to frontend-compatible shape
        const transformed = (usage || []).map(u => ({
            date: u.period_start ? new Date(u.period_start).toISOString().split('T')[0] : '',
            requests: u.total_requests ?? 0,
            tokens: u.total_tokens ?? 0,
            cost: parseFloat(u.total_cost_usd) || 0,
        }));

        return NextResponse.json(transformed);
    } catch (error) {
        console.error('Error in GET /api/projects/[projectId]/end-users/[endUserId]/usage:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
