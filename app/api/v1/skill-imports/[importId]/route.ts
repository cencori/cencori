import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: row.id,
        source_type: row.source_type,
        source_ref: row.source_ref,
        status: row.status,
        normalized_manifest: row.normalized_manifest ?? {},
        scan_findings: row.scan_findings ?? [],
        checksum: row.checksum ?? null,
        reviewed_by: row.reviewed_by ?? null,
        published_skill_version_id: row.published_skill_version_id ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ importId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { importId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase.from('skill_imports').select('*').eq('project_id', validation.context.projectId).eq('id', importId).maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Skill import not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>)), { requestId });
}
