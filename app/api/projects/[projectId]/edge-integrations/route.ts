import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { canManageProjectIntegrations, getProjectAccessContext } from '@/lib/edge-integrations/access';
import { listProjectEdgeIntegrations, upsertProjectEdgeIntegration } from '@/lib/edge-integrations/repository';
import type { EdgeEnvironment, EdgeProvider } from '@/lib/edge-integrations/types';
import { writeAuditLog } from '@/lib/audit-log';

function isEdgeProvider(value: unknown): value is EdgeProvider {
    return value === 'vercel'
        || value === 'supabase'
        || value === 'cloudflare'
        || value === 'aws'
        || value === 'azure'
        || value === 'gcp';
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { projectId } = await params;
        const access = await getProjectAccessContext(projectId, user.id);

        if (!access) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        const integrations = await listProjectEdgeIntegrations(projectId);

        return NextResponse.json({
            integrations,
            permissions: {
                canManage: canManageProjectIntegrations(access),
            },
        });
    } catch (error) {
        console.error('[Edge Integrations API] Failed to fetch project integrations:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { projectId } = await params;
        const access = await getProjectAccessContext(projectId, user.id);

        if (!access) {
            return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        if (!canManageProjectIntegrations(access)) {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        const body = await req.json() as Record<string, unknown>;
        const provider = body.provider;
        const externalProjectId = typeof body.externalProjectId === 'string' ? body.externalProjectId.trim() : '';
        const externalProjectName = typeof body.externalProjectName === 'string' ? body.externalProjectName.trim() : '';
        const externalProjectSlug = typeof body.externalProjectSlug === 'string' ? body.externalProjectSlug.trim() : '';
        const externalAccountName = typeof body.externalAccountName === 'string' ? body.externalAccountName.trim() : '';

        if (!isEdgeProvider(provider)) {
            return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
        }

        if (!externalProjectId || !externalProjectName) {
            return NextResponse.json({ error: 'externalProjectId and externalProjectName are required' }, { status: 400 });
        }

        const rawDomains: unknown[] = Array.isArray(body.domains) ? body.domains : [];
        const domains = rawDomains
            .filter((item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null)
            .map((domain: Record<string, unknown>) => ({
                domain: typeof domain.domain === 'string' ? domain.domain.trim() : '',
                environment: (
                    domain.environment === 'preview' || domain.environment === 'development'
                        ? domain.environment
                        : 'production'
                ) as EdgeEnvironment,
                isPrimary: domain.isPrimary === true,
                metadata: typeof domain.metadata === 'object' && domain.metadata !== null ? domain.metadata as Record<string, unknown> : {},
            }))
            .filter((domain: { domain: string }) => domain.domain.length > 0);

        const integration = await upsertProjectEdgeIntegration({
            projectId,
            organizationId: access.organizationId,
            provider,
            installedVia: 'manual',
            status: 'connected',
            externalAccountName: externalAccountName || null,
            externalProjectId,
            externalProjectName,
            externalProjectSlug: externalProjectSlug || null,
            connectedBy: user.id,
            domains,
            metadata: {
                source: 'manual_link',
            },
        });

        writeAuditLog({
            organizationId: access.organizationId,
            projectId,
            category: 'integration',
            action: 'created',
            resourceType: 'edge_integration',
            resourceId: integration.id,
            actorId: user.id,
            actorEmail: user.email || null,
            actorIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            actorType: 'user',
            description: `Created ${provider} edge integration`,
            metadata: { provider, externalProjectId, externalProjectName },
        });

        return NextResponse.json({ integration }, { status: 201 });
    } catch (error) {
        console.error('[Edge Integrations API] Failed to save project integration:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
