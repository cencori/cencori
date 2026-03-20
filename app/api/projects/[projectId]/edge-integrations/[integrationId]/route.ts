import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { canManageProjectIntegrations, getProjectAccessContext } from '@/lib/edge-integrations/access';
import { disconnectProjectEdgeIntegration } from '@/lib/edge-integrations/repository';
import { writeAuditLog } from '@/lib/audit-log';

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ projectId: string; integrationId: string }> }
) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { projectId, integrationId } = await params;
        const access = await getProjectAccessContext(projectId, user.id);

        if (!access) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        if (!canManageProjectIntegrations(access)) {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        await disconnectProjectEdgeIntegration(projectId, integrationId);

        writeAuditLog({
            organizationId: access.organizationId,
            projectId,
            category: 'integration',
            action: 'deleted',
            resourceType: 'edge_integration',
            resourceId: integrationId,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: _req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Disconnected edge integration ${integrationId}`,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Edge Integrations API] Failed to disconnect integration:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
