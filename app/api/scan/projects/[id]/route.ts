import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getInstallationOctokit } from '@/lib/github';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/scan/projects/[id] - Get single project
export async function GET(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        const { data: project, error: projectError } = await supabaseAdmin
            .from('scan_projects')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get recent scan runs
        const { data: scans } = await supabaseAdmin
            .from('scan_runs')
            .select('*')
            .eq('project_id', id)
            .order('created_at', { ascending: false })
            .limit(10);

        return NextResponse.json({ project, scans: scans || [] });
    } catch (error) {
        console.error('[Scan Project] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE /api/scan/projects/[id] - Delete a project
export async function DELETE(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabaseAdmin = createAdminClient();

        // Check ownership
        const { data: project } = await supabaseAdmin
            .from('scan_projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Delete project (cascades to scan_runs)
        const { error: deleteError } = await supabaseAdmin
            .from('scan_projects')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('[Scan Project] Error deleting:', deleteError);
            return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Scan Project] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH /api/scan/projects/[id] - Update project settings
export async function PATCH(req: NextRequest, { params }: RouteParams) {
    const { id } = await params;
    const supabase = await createServerClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { auto_scan_enabled, slack_webhook_url, discord_webhook_url } = body;

        const supabaseAdmin = createAdminClient();

        // Check ownership
        const { data: project } = await supabaseAdmin
            .from('scan_projects')
            .select('id')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Update settings
        const { data: updated, error: updateError } = await supabaseAdmin
            .from('scan_projects')
            .update({
                ...(auto_scan_enabled !== undefined && { auto_scan_enabled }),
                ...(slack_webhook_url !== undefined && { slack_webhook_url }),
                ...(discord_webhook_url !== undefined && { discord_webhook_url }),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('[Scan Project] Error updating:', updateError);
            return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
        }

        return NextResponse.json({ project: updated });
    } catch (error) {
        console.error('[Scan Project] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
