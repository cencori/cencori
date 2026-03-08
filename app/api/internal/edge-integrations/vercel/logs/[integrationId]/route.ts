import { randomUUID, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getEdgeIntegrationRecordById } from '@/lib/edge-integrations/repository';
import { createVercelLogIngestSecret } from '@/lib/edge-integrations/vercel';

interface VercelDrainLogRecord {
    id?: string;
    timestamp?: number | string;
    requestId?: string;
    host?: string;
    path?: string;
    queryString?: string;
    method?: string;
    statusCode?: number;
    userAgent?: string;
    referer?: string;
    ipAddress?: string;
    countryCode?: string;
    deploymentId?: string;
    deploymentUrl?: string;
    source?: string;
    proxy?: Record<string, unknown>;
    request?: Record<string, unknown>;
    response?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

function secretsMatch(receivedSecret: string | null, expectedSecret: string): boolean {
    if (!receivedSecret) {
        return false;
    }

    const received = Buffer.from(receivedSecret);
    const expected = Buffer.from(expectedSecret);

    if (received.length !== expected.length) {
        return false;
    }

    return timingSafeEqual(received, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNestedString(record: Record<string, unknown> | undefined, key: string): string | null {
    const value = record?.[key];
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getNestedNumber(record: Record<string, unknown> | undefined, key: string): number | null {
    const value = record?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseRequestUrl(input: {
    host: string | null;
    path: string | null;
    queryString: string | null;
}): { host: string | null; path: string | null; queryString: string | null } {
    if (input.host && input.path) {
        return input;
    }

    const raw = input.path;
    if (!raw) {
        return input;
    }

    try {
        const url = raw.startsWith('http://') || raw.startsWith('https://')
            ? new URL(raw)
            : new URL(raw, `https://${input.host || 'placeholder.local'}`);

        return {
            host: input.host || url.host,
            path: url.pathname,
            queryString: input.queryString || url.searchParams.toString() || null,
        };
    } catch {
        return input;
    }
}

function normalizeTimestamp(value: number | string | undefined): string {
    try {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return new Date(value).toISOString();
        }

        if (typeof value === 'string' && value.trim().length > 0) {
            return new Date(value).toISOString();
        }
    } catch {
        // Fall through to now.
    }

    return new Date().toISOString();
}

function normalizeLogEntry(log: VercelDrainLogRecord) {
    const proxy = isRecord(log.proxy) ? log.proxy : undefined;
    const request = isRecord(log.request) ? log.request : undefined;
    const response = isRecord(log.response) ? log.response : undefined;
    const metadata = isRecord(log.metadata) ? log.metadata : {};

    const base = parseRequestUrl({
        host: log.host || getNestedString(proxy, 'host') || getNestedString(request, 'host'),
        path:
            log.path
            || getNestedString(proxy, 'path')
            || getNestedString(request, 'path')
            || getNestedString(proxy, 'requestPath')
            || getNestedString(request, 'url'),
        queryString:
            log.queryString
            || getNestedString(proxy, 'queryString')
            || getNestedString(request, 'queryString'),
    });

    const requestId =
        log.requestId
        || getNestedString(proxy, 'requestId')
        || getNestedString(request, 'requestId')
        || log.id
        || randomUUID();

    const method =
        log.method
        || getNestedString(proxy, 'method')
        || getNestedString(request, 'method')
        || 'GET';

    const statusCode =
        log.statusCode
        || getNestedNumber(proxy, 'statusCode')
        || getNestedNumber(response, 'statusCode')
        || 200;

    if (!base.host || !base.path) {
        return null;
    }

    return {
        request_id: requestId,
        host: base.host,
        method: method.toUpperCase(),
        path: base.path,
        query_string: base.queryString || null,
        status_code: statusCode,
        message: null,
        user_agent:
            log.userAgent
            || getNestedString(proxy, 'userAgent')
            || getNestedString(request, 'userAgent')
            || null,
        referer:
            log.referer
            || getNestedString(proxy, 'referer')
            || getNestedString(request, 'referer')
            || null,
        ip_address:
            log.ipAddress
            || getNestedString(proxy, 'ipAddress')
            || getNestedString(proxy, 'clientIp')
            || null,
        country_code:
            log.countryCode
            || getNestedString(proxy, 'countryCode')
            || getNestedString(proxy, 'country')
            || null,
        created_at: normalizeTimestamp(log.timestamp),
        metadata: {
            runtime: {
                source: 'vercel_log_drain',
            },
            vercel: {
                source: log.source || getNestedString(proxy, 'source'),
                request_id: requestId,
                deployment_id: log.deploymentId || getNestedString(proxy, 'deploymentId'),
                deployment_url: log.deploymentUrl || getNestedString(proxy, 'deploymentUrl'),
                host: base.host,
                path: base.path,
                query_string: base.queryString || null,
            },
            raw: metadata,
        },
    };
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ integrationId: string }> }
) {
    const { integrationId } = await params;
    const integration = await getEdgeIntegrationRecordById(integrationId);

    if (!integration || integration.provider !== 'vercel') {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const expectedSecret = createVercelLogIngestSecret({
        integrationId,
        organizationId: integration.organization_id,
    });

    if (!secretsMatch(req.headers.get('x-cencori-edge-secret'), expectedSecret)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const entries = Array.isArray(body)
        ? body
        : isRecord(body) && Array.isArray(body.logs)
            ? body.logs
            : [];

    if (entries.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0 });
    }

    const rows = entries
        .filter((entry): entry is VercelDrainLogRecord => isRecord(entry))
        .map(normalizeLogEntry)
        .filter((entry): entry is NonNullable<ReturnType<typeof normalizeLogEntry>> => !!entry)
        .map((entry) => ({
            project_id: integration.project_id,
            organization_id: integration.organization_id,
            ...entry,
        }));

    if (rows.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0, skipped: entries.length });
    }

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
        .from('web_request_logs')
        .insert(rows);

    if (error) {
        console.error('[Vercel Log Drain] Failed to persist logs:', error);
        return NextResponse.json({ error: 'Failed to persist Vercel logs' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, inserted: rows.length });
}
