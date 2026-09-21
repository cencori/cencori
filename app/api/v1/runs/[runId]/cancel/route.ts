import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { appendRunEvent, RUN_TERMINAL, emitEmbeddedEvent } from '@/lib/embedded/runs';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/runs/:runId/cancel — queued/running/requires_action → cancelled (idempotent on terminal).
export async function POST(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { runId } = await ctx.params;
    const raw = runId.replace(/^run_/, '');
    const supabase = createAdminClient();
    const { data } = await supabase.from('embedded_runs').select('*').eq('project_id', validation.context.projectId).eq('id', raw).maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Run not found', { requestId }), { requestId });
    const run = data as { id: string; status: string; project_id: string };

    if ((RUN_TERMINAL as readonly string[]).includes(run.status)) {
        return addGatewayHeaders(NextResponse.json({ id: withPrefix('run', run.id), status: run.status, deduped: true }), { requestId });
    }
    if (!['queued', 'running', 'requires_action'].includes(run.status)) {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot cancel run in status ${run.status}`, { requestId }), { requestId });
    }
    await supabase.from('embedded_runs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', run.id);
    await appendRunEvent(supabase as never, run.id, 'run.cancelled', { run_id: run.id });
    await emitEmbeddedEvent(run.project_id, 'run.cancelled', { run_id: run.id });
    // Delegation propagates cancellation to active descendants.
    try {
        const { cancelChildRuns } = await import('@/lib/embedded/subagents');
        await cancelChildRuns(supabase as never, run.id, run.project_id);
    } catch {
        // best-effort; parent cancellation already recorded
    }
    return addGatewayHeaders(NextResponse.json({ id: withPrefix('run', run.id), status: 'cancelled' }), { requestId });
}
