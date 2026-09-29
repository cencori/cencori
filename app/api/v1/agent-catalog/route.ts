import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/agent-catalog — published versions discoverable for installation.
// Default: public + unlisted. ?visibility= narrows (private/tenant require explicit opt-in).
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const visibilityFilter = url.searchParams.get('visibility');
    const agentFilter = url.searchParams.get('agent_id');
    let query = supabase
        .from('agent_versions')
        .select('id, agent_id, version, visibility, config_json, requirements_json, published_at')
        .eq('project_id', validation.context.projectId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(100);
    if (visibilityFilter) {
        if (!['private', 'tenant', 'unlisted', 'public'].includes(visibilityFilter)) {
            return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid visibility', { requestId }), { requestId });
        }
        query = query.eq('visibility', visibilityFilter);
    } else {
        query = query.in('visibility', ['public', 'unlisted']);
    }
    if (agentFilter) query = query.eq('agent_id', agentFilter);
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    // Two queries, never an embedded join: agent_versions links agents both
    // ways, which PostgREST rejects as ambiguous.
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const agentIds = [...new Set(rows.map((v) => v.agent_id as string).filter(Boolean))];
    let agentsById = new Map<string, Record<string, unknown>>();
    if (agentIds.length > 0) {
        const { data: agentRows, error: agentError } = await supabase.from('agents').select('id, project_id, name, description').in('id', agentIds);
        if (agentError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', agentError.message, { requestId }), { requestId });
        agentsById = new Map(((agentRows ?? []) as Array<Record<string, unknown>>).filter((a) => a.project_id === validation.context.projectId).map((a) => [a.id as string, a]));
    }
    return addGatewayHeaders(
        NextResponse.json({
            data: rows.filter((v) => agentsById.has(v.agent_id as string)).map((v) => {
                const agent = agentsById.get(v.agent_id as string) ?? {};
                return {
                    agent_id: v.agent_id,
                    version_id: v.id,
                    version: v.version,
                    visibility: (v.visibility as string) ?? 'private',
                    tenant_only: (v.visibility as string) === 'tenant',
                    name: (agent.name as string | null) ?? null,
                    description: (agent.description as string | null) ?? null,
                    requirements: v.requirements_json ?? {},
                    published_at: v.published_at ?? null,
                };
            }),
            next_cursor: null,
        }),
        { requestId },
    );
}
