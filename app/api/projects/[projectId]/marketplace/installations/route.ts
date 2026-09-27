import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { withPrefix } from '@/lib/embedded/http';
import { installMarketplaceVersion } from '@/lib/embedded/marketplace';
import type { SubscriptionTier } from '@/lib/entitlements';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { projectId } = await params;
        const supabaseAdmin = createAdminClient();
        const { data: project, error: projectError } = await supabaseAdmin
            .from('projects')
            .select('id, organization_id, organizations!inner(owner_id, subscription_tier)')
            .eq('id', projectId)
            .single();
        if (projectError || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const org = project.organizations as { owner_id?: string; subscription_tier?: string } | null;
        let canManage = org?.owner_id === user.id;
        if (!canManage) {
            const { data: membership } = await supabaseAdmin
                .from('organization_members')
                .select('role')
                .eq('organization_id', project.organization_id)
                .eq('user_id', user.id)
                .maybeSingle();
            canManage = (membership?.role as string) === 'admin' || (membership?.role as string) === 'owner';
        }
        if (!canManage) return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });

        let body: {
            version_id?: string; tenant_id?: string;
            knowledge_base_ids?: string[]; connection_ids?: string[];
            approval_policy?: Record<string, unknown>; budget?: Record<string, unknown>; overlay_config?: Record<string, unknown>;
        };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }
        if (!body.version_id?.trim() || !body.tenant_id?.trim()) {
            return NextResponse.json({ error: 'version_id and tenant_id are required' }, { status: 400 });
        }

        const result = await installMarketplaceVersion(supabaseAdmin as never, {
            projectId,
            tier: ((org?.subscription_tier as string) || 'free') as SubscriptionTier,
            versionId: body.version_id,
            tenantRef: body.tenant_id,
            knowledgeBaseIds: body.knowledge_base_ids,
            connectionIds: body.connection_ids,
            overlayConfig: body.overlay_config,
            approvalPolicy: body.approval_policy,
            budget: body.budget,
        });
        if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
        const row = result.installation;
        return NextResponse.json({
            id: withPrefix('ins', row.id as string),
            tenant_id: withPrefix('ten', row.tenant_id as string),
            agent_id: row.agent_id,
            agent_version_id: row.agent_version_id ?? null,
            source_version_id: result.sourceVersionId,
            status: row.status,
            update_channel: row.update_channel,
            created_at: row.created_at,
        }, { status: 201 });
    } catch (error) {
        console.error('[Marketplace] Install failed:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
