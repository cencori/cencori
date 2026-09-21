import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { classifyTool } from '@/lib/embedded/tool-risk';
import { emitEmbeddedEvent } from '@/lib/embedded/runs';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function serialize(row: Record<string, unknown>) {
    return {
        id: withPrefix('act', row.id as string),
        tool: row.tool_name,
        risk_level: row.risk_level,
        status: row.status,
        arguments: row.sanitized_arguments ?? {},
        approval_policy: row.approval_policy ?? {},
        expires_at: row.expires_at ?? null,
        approved_by: row.approved_by ?? null,
        resolved_at: row.resolved_at ?? null,
        result: row.result ?? null,
        error: row.error ?? null,
        run_id: row.run_id ?? null,
        session_id: row.session_id ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

// POST /v1/actions — create an approval-gated action (idempotent via Idempotency-Key → execution_key).
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: {
        tool?: string; tool_name?: string; arguments?: Record<string, unknown>;
        risk_level?: string; run_id?: string; session_id?: string; turn_number?: number;
        tenant_id?: string; approval_policy?: Record<string, unknown>; expires_in?: number;
    };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    const toolName = (body.tool ?? body.tool_name ?? '').trim();
    if (!toolName) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'tool is required', { requestId }), { requestId });

    // Sanitize: drop credential-looking keys; never persist secrets.
    const rawArgs = (body.arguments ?? {}) as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rawArgs)) {
        if (/token|secret|password|api[_-]?key|credential|authorization/i.test(k)) continue;
        sanitized[k] = v;
    }

    const classified = classifyTool(toolName);
    const idempotencyKey = getIdempotencyKey(req.headers);
    const executionKey = idempotencyKey ?? `exe_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

    if (idempotencyKey) {
        // Project-scoped: the same key in another project is a different action.
        const { data: existing } = await supabase.from('actions').select('*').eq('project_id', validation.context.projectId).eq('execution_key', executionKey).maybeSingle();
        if (existing) {
            const sameTool = (existing as { tool_name: string }).tool_name === toolName;
            if (!sameTool) {
                return addGatewayHeaders(embeddedError(409, 'idempotency_conflict', 'Idempotency key already used for a different tool', { requestId }), { requestId });
            }
            return addGatewayHeaders(NextResponse.json(serialize(existing as Record<string, unknown>)), { requestId });
        }
    }

    let tenantId: string | null = null;
    if (body.tenant_id) {
        const raw = dePrefixId(body.tenant_id);
        const { data: tenant } = await supabase.from('platform_tenants').select('id').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
        tenantId = ((tenant?.id as string) ?? (await supabase.from('platform_tenants').select('id').eq('project_id', validation.context.projectId).eq('external_id', body.tenant_id).maybeSingle()).data?.id as string) ?? null;
        if (!tenantId) return addGatewayHeaders(embeddedError(404, 'tenant_not_found', 'Tenant not found', { requestId }), { requestId });
    }

    // Referenced runs/sessions must belong to this project — otherwise an
    // action could borrow another project's scope (and network allowlist).
    let runId: string | null = null;
    if (body.run_id) {
        const { data: run } = await supabase.from('embedded_runs').select('id, tenant_id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(body.run_id)).maybeSingle();
        if (!run) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Run not found in this project', { requestId }), { requestId });
        runId = (run as { id: string }).id;
        const runTenant = (run as { tenant_id: string | null }).tenant_id;
        if (tenantId && runTenant && runTenant !== tenantId) {
            return addGatewayHeaders(embeddedError(403, 'tenant_scope_mismatch', 'Run does not belong to this tenant', { requestId }), { requestId });
        }
        if (!tenantId) tenantId = runTenant;
    }
    let sessionId: string | null = null;
    if (body.session_id) {
        const { data: sess } = await supabase.from('sessions').select('id, tenant_id').eq('project_id', validation.context.projectId).eq('id', dePrefixId(body.session_id)).maybeSingle();
        if (!sess) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Session not found in this project', { requestId }), { requestId });
        sessionId = (sess as { id: string }).id;
        const sessTenant = (sess as { tenant_id: string | null }).tenant_id;
        if (tenantId && sessTenant && sessTenant !== tenantId) {
            return addGatewayHeaders(embeddedError(403, 'tenant_scope_mismatch', 'Session does not belong to this tenant', { requestId }), { requestId });
        }
        if (!tenantId) tenantId = sessTenant;
    }

    const { data, error } = await supabase.from('actions').insert({
        project_id: validation.context.projectId,
        tenant_id: tenantId,
        run_id: runId,
        session_id: sessionId,
        turn_number: body.turn_number ?? null,
        tool_name: toolName,
        risk_level: body.risk_level ?? classified.risk,
        status: 'pending',
        sanitized_arguments: sanitized,
        approval_policy: body.approval_policy ?? {},
        expires_at: new Date(Date.now() + (body.expires_in ?? 24 * 3600) * 1000).toISOString(),
        execution_key: executionKey,
    }).select('*').single();
    if (error || !data) {
        return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error?.message ?? 'Failed to create action', { requestId }), { requestId });
    }
    const row = data as Record<string, unknown>;
    await emitEmbeddedEvent(validation.context.projectId, 'action.required', { action_id: row.id, tool: toolName, tenant_id: tenantId });
    return addGatewayHeaders(NextResponse.json(serialize(row), { status: 201 }), { requestId });
}
