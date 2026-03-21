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

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') || '25', 10)));
        const search = searchParams.get('search')?.trim() || null;
        const planId = searchParams.get('plan_id') || null;
        const status = searchParams.get('status') || null; // 'active' | 'blocked'

        const offset = (page - 1) * perPage;

        let query = supabaseAdmin
            .from('end_users')
            .select('*, rate_plans(id, name, display_name)', { count: 'exact' })
            .eq('project_id', projectId);

        if (search) {
            // Escape special PostgREST filter characters to prevent injection
            const sanitized = search.replace(/[%_\\(),]/g, c => `\\${c}`);
            query = query.or(`external_id.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
        }

        if (planId) {
            query = query.eq('rate_plan_id', planId);
        }

        if (status === 'active') {
            query = query.eq('is_blocked', false);
        } else if (status === 'blocked') {
            query = query.eq('is_blocked', true);
        }

        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + perPage - 1);

        const { data: endUsers, error: usersError, count } = await query;

        if (usersError) {
            console.error('Error fetching end-users:', usersError);
            return NextResponse.json({ error: 'Failed to fetch end-users' }, { status: 500 });
        }

        // Join with latest usage data
        const userIds = endUsers?.map(u => u.id) || [];
        let usageMap: Record<string, { total_requests: number; total_tokens: number; last_active_at: string | null }> = {};

        if (userIds.length > 0) {
            const { data: usageData } = await supabaseAdmin
                .from('end_user_usage')
                .select('end_user_id, total_requests, total_tokens, last_active_at')
                .in('end_user_id', userIds);

            if (usageData) {
                for (const u of usageData) {
                    usageMap[u.end_user_id] = {
                        total_requests: u.total_requests,
                        total_tokens: u.total_tokens,
                        last_active_at: u.last_active_at,
                    };
                }
            }
        }

        const enrichedUsers = (endUsers || []).map(eu => {
            const usage = usageMap[eu.id] || { total_requests: 0, total_tokens: 0, last_active_at: null };
            const ratePlan = eu.rate_plans as { id: string; name: string; display_name?: string } | null;
            return {
                id: eu.id,
                external_id: eu.external_id,
                display_name: eu.display_name,
                rate_plan_id: eu.rate_plan_id,
                rate_plan_name: ratePlan?.name ?? null,
                status: eu.is_blocked ? 'blocked' as const : 'active' as const,
                metadata: eu.metadata,
                requests_30d: usage.total_requests,
                tokens_30d: usage.total_tokens,
                cost_30d: 0,
                last_seen_at: eu.last_seen_at ?? usage.last_active_at ?? null,
                created_at: eu.created_at,
            };
        });

        return NextResponse.json({
            users: enrichedUsers,
            pagination: {
                page,
                per_page: perPage,
                total: count || 0,
                total_pages: Math.ceil((count || 0) / perPage),
            },
        });
    } catch (error) {
        console.error('Error in GET /api/projects/[projectId]/end-users:', error);
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

            if (!membership) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const body = await req.json();
        const {
            external_id,
            display_name,
            email,
            rate_plan_id,
            is_blocked = false,
            metadata,
        } = body;

        if (!external_id || typeof external_id !== 'string' || external_id.trim().length === 0) {
            return NextResponse.json({ error: 'external_id is required' }, { status: 400 });
        }

        // Validate rate_plan_id belongs to this project if provided
        if (rate_plan_id) {
            const { data: plan, error: planError } = await supabaseAdmin
                .from('rate_plans')
                .select('id')
                .eq('id', rate_plan_id)
                .eq('project_id', projectId)
                .single();

            if (planError || !plan) {
                return NextResponse.json({ error: 'Rate plan not found for this project' }, { status: 400 });
            }
        }

        // Upsert by external_id + project_id
        const { data: existing } = await supabaseAdmin
            .from('end_users')
            .select('id')
            .eq('project_id', projectId)
            .eq('external_id', external_id.trim())
            .maybeSingle();

        let endUser;
        let isUpdate = false;

        if (existing) {
            // Update existing
            isUpdate = true;
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (display_name !== undefined) updates.display_name = display_name;
            if (email !== undefined) updates.email = email;
            if (rate_plan_id !== undefined) updates.rate_plan_id = rate_plan_id;
            if (is_blocked !== undefined) updates.is_blocked = is_blocked;
            if (metadata !== undefined) updates.metadata = metadata;

            const { data, error: updateError } = await supabaseAdmin
                .from('end_users')
                .update(updates)
                .eq('id', existing.id)
                .select('*, rate_plans(id, name, display_name)')
                .single();

            if (updateError) {
                console.error('Error updating end-user:', updateError);
                return NextResponse.json({ error: 'Failed to update end-user' }, { status: 500 });
            }

            endUser = data;
        } else {
            // Create new
            const { data, error: createError } = await supabaseAdmin
                .from('end_users')
                .insert({
                    project_id: projectId,
                    external_id: external_id.trim(),
                    display_name: display_name?.trim() || null,
                    email: email?.trim() || null,
                    rate_plan_id: rate_plan_id || null,
                    is_blocked,
                    metadata: metadata || null,
                })
                .select('*, rate_plans(id, name, display_name)')
                .single();

            if (createError) {
                console.error('Error creating end-user:', createError);
                return NextResponse.json({ error: 'Failed to create end-user' }, { status: 500 });
            }

            endUser = data;
        }

        writeAuditLog({
            organizationId: project.organization_id,
            projectId,
            category: 'end_user',
            action: isUpdate ? 'updated' : 'created',
            resourceType: 'end_user',
            resourceId: endUser.id,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: isUpdate
                ? `Updated end-user "${external_id.trim()}"`
                : `Created end-user "${external_id.trim()}"`,
            metadata: {
                external_id: external_id.trim(),
                rate_plan_id: rate_plan_id || null,
                is_blocked,
            },
        });

        return NextResponse.json({ endUser }, { status: isUpdate ? 200 : 201 });
    } catch (error) {
        console.error('Error in POST /api/projects/[projectId]/end-users:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
