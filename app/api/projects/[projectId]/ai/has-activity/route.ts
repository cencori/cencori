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
            .select('user_id')
            .eq('organization_id', project.organization_id)
            .eq('user_id', user.id)
            .single();

        if (memberError || !member) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Lightweight check: does at least one request exist?
        const { data: request, error: requestError } = await supabaseAdmin
            .from('ai_requests')
            .select('id')
            .eq('project_id', projectId)
            .limit(1)
            .maybeSingle();

        if (requestError) {
            console.error('[AI Activity Check] Error:', requestError);
            return NextResponse.json({ error: 'Failed to check activity' }, { status: 500 });
        }

        return NextResponse.json({ hasActivity: !!request });
    } catch (error) {
        console.error('[AI Activity Check] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
