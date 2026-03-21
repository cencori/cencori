import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { writeAuditLog } from '@/lib/audit-log';

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

        const { data: endUser, error: endUserError } = await supabaseAdmin
            .from('end_users')
            .select('*, rate_plans(id, name, display_name, requests_per_minute, requests_per_day, tokens_per_minute, tokens_per_day)')
            .eq('id', endUserId)
            .eq('project_id', projectId)
            .single();

        if (endUserError || !endUser) {
            return NextResponse.json({ error: 'End-user not found' }, { status: 404 });
        }

        // Fetch usage history
        const { data: usageHistory } = await supabaseAdmin
            .from('end_user_usage')
            .select('*')
            .eq('end_user_id', endUserId)
            .order('period_start', { ascending: false })
            .limit(30);

        return NextResponse.json({
            endUser,
            usageHistory: usageHistory || [],
        });
    } catch (error) {
        console.error('Error in GET /api/projects/[projectId]/end-users/[endUserId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
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

            if (!membership || !['admin', 'owner'].includes(membership.role)) {
                return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
            }
        }

        // Verify end-user exists
        const { data: existing, error: existError } = await supabaseAdmin
            .from('end_users')
            .select('id, external_id')
            .eq('id', endUserId)
            .eq('project_id', projectId)
            .single();

        if (existError || !existing) {
            return NextResponse.json({ error: 'End-user not found' }, { status: 404 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = {};

        const allowedFields = ['display_name', 'email', 'rate_plan_id', 'is_blocked', 'metadata'];
        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field];
            }
        }

        // Accept `status` as an alias for `is_blocked`
        if ('status' in body) {
            updates.is_blocked = body.status === 'blocked';
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        // Validate rate_plan_id if provided
        if (updates.rate_plan_id) {
            const { data: plan } = await supabaseAdmin
                .from('rate_plans')
                .select('id')
                .eq('id', updates.rate_plan_id as string)
                .eq('project_id', projectId)
                .single();

            if (!plan) {
                return NextResponse.json({ error: 'Rate plan not found for this project' }, { status: 400 });
            }
        }

        const { data: endUser, error: updateError } = await supabaseAdmin
            .from('end_users')
            .update(updates)
            .eq('id', endUserId)
            .eq('project_id', projectId)
            .select('*, rate_plans(id, name, display_name)')
            .single();

        if (updateError) {
            console.error('Error updating end-user:', updateError);
            return NextResponse.json({ error: 'Failed to update end-user' }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'end_user',
            action: 'updated',
            resourceType: 'end_user',
            resourceId: endUserId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Updated end-user "${existing.external_id}"`,
            metadata: { updated_fields: Object.keys(updates).filter(k => k !== 'updated_at') },
        });

        return NextResponse.json({ endUser });
    } catch (error) {
        console.error('Error in PATCH /api/projects/[projectId]/end-users/[endUserId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
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

            if (!membership || !['admin', 'owner'].includes(membership.role)) {
                return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
            }
        }

        // Verify end-user exists
        const { data: endUser, error: endUserError } = await supabaseAdmin
            .from('end_users')
            .select('id, external_id')
            .eq('id', endUserId)
            .eq('project_id', projectId)
            .single();

        if (endUserError || !endUser) {
            return NextResponse.json({ error: 'End-user not found' }, { status: 404 });
        }

        const { error: deleteError } = await supabaseAdmin
            .from('end_users')
            .delete()
            .eq('id', endUserId)
            .eq('project_id', projectId);

        if (deleteError) {
            console.error('Error deleting end-user:', deleteError);
            return NextResponse.json({ error: 'Failed to delete end-user' }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'end_user',
            action: 'deleted',
            resourceType: 'end_user',
            resourceId: endUserId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Deleted end-user "${endUser.external_id}"`,
            metadata: { external_id: endUser.external_id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/projects/[projectId]/end-users/[endUserId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
