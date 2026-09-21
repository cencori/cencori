import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serializeRun(row: Record<string, unknown>) {
    return {
        id: withPrefix('run', row.id as string),
        agent_id: row.agent_id, agent_version_id: row.agent_version_id ?? null,
        installation_id: row.installation_id ? withPrefix('ins', row.installation_id as string) : null,
        tenant_id: row.tenant_id ? withPrefix('ten', row.tenant_id as string) : null,
        external_user_id: row.external_user_id ?? null, session_id: row.session_id ?? null,
        status: row.status, input: row.input_ref ?? {}, output: row.output_ref ?? null,
        error: row.error ?? null, started_at: row.started_at ?? null, completed_at: row.completed_at ?? null,
        created_at: row.created_at, updated_at: row.updated_at,
    };
}

async function loadRun(supabase: ReturnType<typeof createAdminClient>, projectId: string, runId: string) {
    const raw = runId.replace(/^run_/, '');
    const { data } = await supabase.from('embedded_runs').select('*').eq('project_id', projectId).eq('id', raw).maybeSingle();
    return (data ?? null) as Record<string, unknown> | null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { runId } = await ctx.params;
    const row = await loadRun(createAdminClient(), validation.context.projectId, runId);
    if (!row) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Run not found', { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json(serializeRun(row)), { requestId });
}
