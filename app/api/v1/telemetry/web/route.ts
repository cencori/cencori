import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import crypto from 'crypto';
import { extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';

interface WebTelemetryPayload {
    host: string;
    method: string;
    path: string;
    statusCode: number;
    requestId?: string;
    queryString?: string;
    message?: string;
    userAgent?: string;
    referer?: string;
    ipAddress?: string;
    countryCode?: string;
    latencyMs?: number;
}

// ── CORS Preflight ──
export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, CENCORI_API_KEY');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
}

export async function POST(req: NextRequest) {
    const supabase = createAdminClient();

    // ── Extract API Key ──
    const apiKey = extractCencoriApiKeyFromHeaders(req.headers);

    if (!apiKey) {
        return NextResponse.json(
            { error: 'Missing API key. Provide CENCORI_API_KEY header or Authorization: Bearer <key>' },
            { status: 401 }
        );
    }

    // ── Look up key → project ──
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data: keyData, error: keyError } = await supabase
        .from('api_keys')
        .select(`
            id,
            project_id,
            projects!inner(
                id,
                organization_id
            )
        `)
        .eq('key_hash', keyHash)
        .is('revoked_at', null)
        .single();

    if (keyError || !keyData) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const project = keyData.projects as unknown as {
        id: string;
        organization_id: string;
    };

    // ── Parse body ──
    let payload: WebTelemetryPayload;
    try {
        payload = (await req.json()) as WebTelemetryPayload;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const host = payload.host?.trim();
    const path = payload.path?.trim();

    if (!host || !path) {
        return NextResponse.json({ error: 'Missing required fields: host, path' }, { status: 400 });
    }

    const method = (payload.method || 'GET').toUpperCase();
    const statusCode = Number.isFinite(payload.statusCode) ? Number(payload.statusCode) : 200;

    // ── Insert into web_request_logs ──
    const { error: insertError } = await supabase.from('web_request_logs').insert({
        project_id: project.id,
        organization_id: project.organization_id,
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
    });

    if (insertError) {
        console.error('[Web Telemetry] Failed to persist web request log:', insertError);
        return NextResponse.json({ error: 'Failed to persist web request log' }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
}
