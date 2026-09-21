import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix, getIdempotencyKey } from '@/lib/embedded/http';
import { delegateSubagent } from '@/lib/embedded/subagents';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/runs/:runId/delegate — one bounded task to an explicitly allowed
// subagent version. Isolated child run; scope narrows, never escalates.
export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { runId } = await ctx.params;

    let body: { agent_version_id?: string; input?: unknown };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.agent_version_id?.trim()) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'agent_version_id is required', { requestId }), { requestId });
    }

    const supabase = createAdminClient();
    try {
        const result = await delegateSubagent(supabase as never, {
            projectId: validation.context.projectId,
            organizationId: validation.context.organizationId,
            tier: (validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free',
            parentRunId: dePrefixId(runId),
            childVersionId: body.agent_version_id,
            input: body.input ?? {},
            idempotencyKey: getIdempotencyKey(req.headers),
        });
        return addGatewayHeaders(
            NextResponse.json({ child_run_id: withPrefix('run', result.childRunId), status: result.status, output: result.output }, { status: 201 }),
            { requestId },
        );
    } catch (e) {
        const err = e as { status?: number; code?: string; message?: string };
        return addGatewayHeaders(embeddedError(err.status ?? 500, err.code ?? 'invalid_request_error', err.message ?? 'Delegation failed', { requestId }), { requestId });
    }
}
