import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { checksumConfig, validateVersionConfig } from '@/lib/embedded/agents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: row.id,
        agent_id: row.agent_id,
        version: row.version,
        status: row.status,
        visibility: row.visibility ?? 'private',
        config: row.config_json ?? {},
        requirements: row.requirements_json ?? {},
        checksum: row.checksum ?? null,
        created_by: row.created_by ?? null,
        reviewed_by: row.reviewed_by ?? null,
        published_at: row.published_at ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function assertAgent(supabase: ReturnType<typeof createAdminClient>, projectId: string, agentId: string) {
    const { data } = await supabase.from('agents').select('id, project_id').eq('id', agentId).maybeSingle();
    if (!data || (data.project_id as string) !== projectId) return null;
    return data as { id: string };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId } = await ctx.params;
    const supabase = createAdminClient();
    const agent = await assertAgent(supabase, validation.context.projectId, agentId);
    if (!agent) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });

    let body: { version?: string; config?: Record<string, unknown>; requirements?: Record<string, unknown>; visibility?: string };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.version?.trim()) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'version is required', { requestId }), { requestId });
    const config = (body.config ?? {}) as Record<string, unknown>;
    const checked = validateVersionConfig(config as never);
    if (!checked.ok) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', checked.message, { requestId }), { requestId });
    const visibility = body.visibility ?? 'private';
    if (!['private', 'tenant', 'unlisted', 'public'].includes(visibility)) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
    }

    const { data, error } = await supabase
        .from('agent_versions')
        .insert({
            agent_id: agentId,
            project_id: validation.context.projectId,
            version: body.version.trim(),
            status: 'draft',
            visibility,
            config_json: config,
            requirements_json: body.requirements ?? {},
            checksum: checksumConfig(config as never),
        })
        .select('*')
        .single();
    if (error || !data) {
        const conflict = error?.code === '23505';
        return addGatewayHeaders(embeddedError(conflict ? 409 : 500, 'invalid_request_error', error?.message ?? 'Failed to create version', { requestId }), { requestId });
    }
    void withPrefix;
    return addGatewayHeaders(NextResponse.json(serialize(data as Record<string, unknown>), { status: 201 }), { requestId });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ agentId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { agentId } = await ctx.params;
    const supabase = createAdminClient();
    const agent = await assertAgent(supabase, validation.context.projectId, agentId);
    if (!agent) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent not found', { requestId }), { requestId });
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    let query = supabase.from('agent_versions').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    return addGatewayHeaders(NextResponse.json({ data: ((data ?? []) as Record<string, unknown>[]).map(serialize), next_cursor: null }), { requestId });
}
