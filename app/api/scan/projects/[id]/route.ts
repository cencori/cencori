import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { listContinuityMemoryEntries } from '@/lib/scan/scan-memory';

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

        // Auto-recover stale "running" scans — if a scan has been "running" for more
        // than 6 minutes it almost certainly lost its connection before the DB update.
        const STALE_RUNNING_MS = 6 * 60 * 1000;
        if (scans) {
            const now = Date.now();
            for (const scan of scans) {
                if (scan.status !== 'running') continue;
                const ageMs = now - new Date(scan.created_at).getTime();
                if (ageMs > STALE_RUNNING_MS) {
                    scan.status = 'failed';
                    scan.error_message = 'Scan was interrupted before it could finish. Please run a new scan.';
                    // Fire-and-forget DB fix so the stale row doesn't persist
                    void supabaseAdmin
                        .from('scan_runs')
                        .update({
                            status: 'failed',
                            error_message: scan.error_message,
                            fix_status: 'not_applicable',
                        })
                        .eq('id', scan.id)
                        .then(({ error: updateErr }) => {
                            if (updateErr) {
                                console.error('[Scan Project] Failed to auto-recover stale scan:', updateErr);
                            }
                        });
                }
            }
        }

        let continuity: Awaited<ReturnType<typeof listContinuityMemoryEntries>> = [];
        try {
            continuity = await listContinuityMemoryEntries(id, user.id, supabaseAdmin, { limit: 12 });
        } catch (continuityError) {
            console.error('[Scan Project] Failed to load continuity memory:', continuityError);
        }

        return NextResponse.json({ project, scans: scans || [], continuity });
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

        const allowedKeys = ['auto_scan_enabled', 'slack_webhook_url', 'discord_webhook_url'];
        const hasValidKey = allowedKeys.some((k) => k in body);
        if (!hasValidKey) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        // Strict type checks to prevent SSRF and type confusion
        if (auto_scan_enabled !== undefined && typeof auto_scan_enabled !== 'boolean') {
            return NextResponse.json({ error: 'auto_scan_enabled must be a boolean' }, { status: 400 });
        }
        if (slack_webhook_url !== undefined && slack_webhook_url !== null) {
            if (typeof slack_webhook_url !== 'string' || !slack_webhook_url.startsWith('https://hooks.slack.com/')) {
                return NextResponse.json({ error: 'slack_webhook_url must be a valid Slack webhook URL (https://hooks.slack.com/...)' }, { status: 400 });
            }
        }
        if (discord_webhook_url !== undefined && discord_webhook_url !== null) {
            if (typeof discord_webhook_url !== 'string' || !discord_webhook_url.startsWith('https://discord.com/api/webhooks/')) {
                return NextResponse.json({ error: 'discord_webhook_url must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)' }, { status: 400 });
            }
        }

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
