import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';

interface IngestPayload {
    requestId?: string;
    host?: string;
    method?: string;
    path?: string;
    queryString?: string;
    statusCode?: number;
    message?: string;
    orgSlug?: string;
    projectSlug?: string;
    userAgent?: string;
    referer?: string;
    ipAddress?: string;
    countryCode?: string;
    metadata?: Record<string, unknown> | null;
}

const PROJECT_CACHE_TTL_MS = 5 * 60 * 1000;
const projectCache = new Map<string, { projectId: string; organizationId: string; expiresAt: number }>();
const isProductionRuntime = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

function getInternalIngestSecret(): string | undefined {
    return process.env.WEB_LOG_INGEST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function readCachedProject(orgSlug: string, projectSlug: string) {
    const key = `${orgSlug}:${projectSlug}`;
    const cached = projectCache.get(key);

    if (!cached) return null;
    if (cached.expiresAt < Date.now()) {
        projectCache.delete(key);
        return null;
    }

    return cached;
}

function cacheProject(orgSlug: string, projectSlug: string, projectId: string, organizationId: string) {
    const key = `${orgSlug}:${projectSlug}`;
    projectCache.set(key, {
        projectId,
        organizationId,
        expiresAt: Date.now() + PROJECT_CACHE_TTL_MS,
    });
}

function isLocalhostHost(host: string): boolean {
    const normalized = host.toLowerCase();

    return (
        normalized === 'localhost'
        || normalized.startsWith('localhost:')
        || normalized === '127.0.0.1'
        || normalized.startsWith('127.0.0.1:')
        || normalized === '[::1]'
        || normalized.startsWith('[::1]:')
    );
}

export async function POST(req: NextRequest) {
    const secret = getInternalIngestSecret();
    const receivedSecret = req.headers.get('x-cencori-internal-key');

    if (!secret || !receivedSecret || receivedSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload: IngestPayload;
    try {
        payload = (await req.json()) as IngestPayload;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const orgSlug = payload.orgSlug?.trim();
    const projectSlug = payload.projectSlug?.trim();
    const path = payload.path?.trim();
    const host = payload.host?.trim() || 'unknown';

    if (!orgSlug || !projectSlug || !path) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Safety guard: do not persist localhost hosts in production mode.
    if (isProductionRuntime && isLocalhostHost(host)) {
        return NextResponse.json({ ok: true, skipped: 'localhost_in_production' }, { status: 200 });
    }

    const supabase = createAdminClient();

    let projectMeta = readCachedProject(orgSlug, projectSlug);

    if (!projectMeta) {
        const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single();

        if (!orgData) {
            return NextResponse.json({ ok: true, skipped: 'organization_not_found' }, { status: 200 });
        }

        const { data: projectData } = await supabase
            .from('projects')
            .select('id, organization_id')
            .eq('slug', projectSlug)
            .eq('organization_id', orgData.id)
            .single();

        if (!projectData) {
            return NextResponse.json({ ok: true, skipped: 'project_not_found' }, { status: 200 });
        }

        projectMeta = {
            projectId: projectData.id,
            organizationId: projectData.organization_id,
            expiresAt: Date.now() + PROJECT_CACHE_TTL_MS,
        };
        cacheProject(orgSlug, projectSlug, projectData.id, projectData.organization_id);
    }

    const method = (payload.method || 'GET').toUpperCase();
    const statusCode = Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : 200;
    const metadata =
        payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
            ? payload.metadata
            : null;

    const baseInsert = {
        project_id: projectMeta.projectId,
        organization_id: projectMeta.organizationId,
        request_id: payload.requestId || crypto.randomUUID(),
        host,
        method,
        path,
        query_string: payload.queryString || null,
        status_code: statusCode,
        message: payload.message || null,
        user_agent: payload.userAgent || null,
        referer: payload.referer || null,
        ip_address: payload.ipAddress || null,
        country_code: payload.countryCode || null,
    };

    try {
        let { error } = await supabase.from('web_request_logs').insert({
            ...baseInsert,
            metadata,
        });

        if (error) {
            const errorText = `${error.message || ''} ${error.details || ''}`.toLowerCase();
            const missingMetadataColumn =
                errorText.includes('metadata')
                && (errorText.includes('column') || errorText.includes('schema cache'));

            if (missingMetadataColumn) {
                const fallbackInsert = await supabase.from('web_request_logs').insert(baseInsert);
                error = fallbackInsert.error;
            }
        }

        if (error) {
            console.error('[Web Logs Ingest] Failed to persist web request log:', error);
            return NextResponse.json({ error: 'Failed to persist web request log' }, { status: 500 });
        }
    } catch (error) {
        console.error('[Web Logs Ingest] Failed to persist web request log:', error);
        return NextResponse.json({ error: 'Failed to persist web request log' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
