import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { writeAuditLog } from '@/lib/audit-log';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
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

        const { data: ratePlans, error: plansError } = await supabaseAdmin
            .from('rate_plans')
            .select('*')
            .eq('project_id', projectId)
            .order('priority', { ascending: true });

        if (plansError) {
            console.error('Error fetching rate plans:', plansError);
            return NextResponse.json({ error: 'Failed to fetch rate plans' }, { status: 500 });
        }

        return NextResponse.json({ ratePlans });
    } catch (error) {
        console.error('Error in GET /api/projects/[projectId]/rate-plans:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
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

        const body = await req.json();
        const { name, slug } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json({ error: 'Plan name is required' }, { status: 400 });
        }

        if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
            return NextResponse.json({ error: 'Plan slug is required' }, { status: 400 });
        }

        // If setting as default, unset existing default
        if (body.is_default) {
            await supabaseAdmin
                .from('rate_plans')
                .update({ is_default: false })
                .eq('project_id', projectId)
                .eq('is_default', true);
        }

        const insert: Record<string, unknown> = {
            project_id: projectId,
            name: name.trim(),
            slug: slug.trim(),
            is_default: body.is_default ?? false,
            priority: body.priority ?? 0,
        };

        // Map optional fields to actual DB columns
        const optionalFields: [string, string][] = [
            ['daily_token_limit', 'daily_token_limit'],
            ['monthly_token_limit', 'monthly_token_limit'],
            ['daily_request_limit', 'daily_request_limit'],
            ['monthly_request_limit', 'monthly_request_limit'],
            ['requests_per_minute', 'requests_per_minute'],
            ['daily_cost_limit_usd', 'daily_cost_limit_usd'],
            ['monthly_cost_limit_usd', 'monthly_cost_limit_usd'],
            ['markup_percentage', 'markup_percentage'],
            ['flat_rate_per_request', 'flat_rate_per_request'],
            ['allowed_models', 'allowed_models'],
            ['overage_action', 'overage_action'],
        ];

        for (const [bodyKey, dbKey] of optionalFields) {
            if (bodyKey in body) {
                insert[dbKey] = body[bodyKey];
            }
        }

        const { data: ratePlan, error: createError } = await supabaseAdmin
            .from('rate_plans')
            .insert(insert)
            .select()
            .single();

        if (createError) {
            console.error('Error creating rate plan:', createError);
            return NextResponse.json({ error: 'Failed to create rate plan' }, { status: 500 });
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'rate_plan',
            action: 'created',
            resourceType: 'rate_plan',
            resourceId: ratePlan.id,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Created rate plan "${name.trim()}"`,
            metadata: { plan_name: name.trim(), is_default: body.is_default ?? false, priority: body.priority ?? 0 },
        });

        return NextResponse.json({ ratePlan }, { status: 201 });
    } catch (error) {
        console.error('Error in POST /api/projects/[projectId]/rate-plans:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
