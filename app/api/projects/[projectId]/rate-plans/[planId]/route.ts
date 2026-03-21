import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { writeAuditLog } from '@/lib/audit-log';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; planId: string }> }
) {
    try {
        const { projectId, planId } = await params;
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

        const { data: ratePlan, error: planError } = await supabaseAdmin
            .from('rate_plans')
            .select('*')
            .eq('id', planId)
            .eq('project_id', projectId)
            .single();

        if (planError || !ratePlan) {
            return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 });
        }

        return NextResponse.json({ ratePlan });
    } catch (error) {
        console.error('Error in GET /api/projects/[projectId]/rate-plans/[planId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; planId: string }> }
) {
    try {
        const { projectId, planId } = await params;
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

        // Verify plan exists
        const { data: existing, error: existError } = await supabaseAdmin
            .from('rate_plans')
            .select('id')
            .eq('id', planId)
            .eq('project_id', projectId)
            .single();

        if (existError || !existing) {
            return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 });
        }

        const body = await req.json();
        const updates: Record<string, unknown> = {};

        const allowedFields = [
            'name', 'slug', 'is_default', 'priority',
            'daily_token_limit', 'monthly_token_limit',
            'daily_request_limit', 'monthly_request_limit', 'requests_per_minute',
            'daily_cost_limit_usd', 'monthly_cost_limit_usd',
            'markup_percentage', 'flat_rate_per_request',
            'allowed_models', 'overage_action',
        ];

        for (const field of allowedFields) {
            if (field in body) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        // If setting as default, unset existing default
        if (updates.is_default === true) {
            await supabaseAdmin
                .from('rate_plans')
                .update({ is_default: false })
                .eq('project_id', projectId)
                .eq('is_default', true);
        }

        updates.updated_at = new Date().toISOString();

        const { data: ratePlan, error: updateError } = await supabaseAdmin
            .from('rate_plans')
            .update(updates)
            .eq('id', planId)
            .eq('project_id', projectId)
            .select()
            .single();

        if (updateError) {
            console.error('Error updating rate plan:', updateError);
            return NextResponse.json({ error: 'Failed to update rate plan' }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'rate_plan',
            action: 'updated',
            resourceType: 'rate_plan',
            resourceId: planId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Updated rate plan "${ratePlan.name}"`,
            metadata: { updated_fields: Object.keys(updates).filter(k => k !== 'updated_at') },
        });

        return NextResponse.json({ ratePlan });
    } catch (error) {
        console.error('Error in PATCH /api/projects/[projectId]/rate-plans/[planId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string; planId: string }> }
) {
    try {
        const { projectId, planId } = await params;
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

        // Verify plan exists
        const { data: ratePlan, error: planError } = await supabaseAdmin
            .from('rate_plans')
            .select('id, name, is_default')
            .eq('id', planId)
            .eq('project_id', projectId)
            .single();

        if (planError || !ratePlan) {
            return NextResponse.json({ error: 'Rate plan not found' }, { status: 404 });
        }

        // Check if end-users are assigned to this plan
        const { count: assignedCount, error: countError } = await supabaseAdmin
            .from('end_users')
            .select('id', { count: 'exact', head: true })
            .eq('rate_plan_id', planId);

        if (countError) {
            console.error('Error checking end-user assignments:', countError);
            return NextResponse.json({ error: 'Failed to check plan assignments' }, { status: 500 });
        }

        if (assignedCount && assignedCount > 0) {
            // Find default plan for this project to reassign users
            const { data: defaultPlan } = await supabaseAdmin
                .from('rate_plans')
                .select('id')
                .eq('project_id', projectId)
                .eq('is_default', true)
                .neq('id', planId)
                .maybeSingle();

            if (defaultPlan) {
                // Reassign end-users to the default plan
                const { error: reassignError } = await supabaseAdmin
                    .from('end_users')
                    .update({ rate_plan_id: defaultPlan.id, updated_at: new Date().toISOString() })
                    .eq('rate_plan_id', planId);

                if (reassignError) {
                    console.error('Error reassigning end-users:', reassignError);
                    return NextResponse.json({ error: 'Failed to reassign end-users' }, { status: 500 });
                }
            } else {
                return NextResponse.json({
                    error: `Cannot delete plan with ${assignedCount} assigned end-user(s). Create a default plan first or reassign them manually.`,
                }, { status: 409 });
            }
        }

        const { error: deleteError } = await supabaseAdmin
            .from('rate_plans')
            .delete()
            .eq('id', planId)
            .eq('project_id', projectId);

        if (deleteError) {
            console.error('Error deleting rate plan:', deleteError);
            return NextResponse.json({ error: 'Failed to delete rate plan' }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'rate_plan',
            action: 'deleted',
            resourceType: 'rate_plan',
            resourceId: planId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Deleted rate plan "${ratePlan.name}"`,
            metadata: {
                plan_name: ratePlan.name,
                reassigned_users: assignedCount && assignedCount > 0 ? assignedCount : 0,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in DELETE /api/projects/[projectId]/rate-plans/[planId]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
