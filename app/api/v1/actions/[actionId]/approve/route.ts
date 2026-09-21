import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId, withPrefix } from '@/lib/embedded/http';
import { emitEmbeddedEvent } from '@/lib/embedded/runs';
import { executeGmailSend } from '@/lib/embedded/tool-executor';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

async function dispatchExecution(
    supabase: ReturnType<typeof createAdminClient>,
    action: { id: string; tool_name: string; status?: string; run_id?: string | null; sanitized_arguments: Record<string, unknown>; approval_policy: Record<string, unknown>; execution_key: string; project_id: string },
    organizationId: string,
): Promise<{ result: Record<string, unknown> }> {
    const policy = action.approval_policy ?? {};
    const connectionId = (policy.connection_id as string | undefined) ?? (action.sanitized_arguments._connection_id as string | undefined);
    const tool = action.tool_name.toLowerCase();

    if (tool === 'gmail.send' || tool === 'gmail/send' || (tool.includes('gmail') && connectionId)) {
        if (!connectionId) throw new Error('No connection bound to this Gmail action');
        const { data: conn } = await supabase.from('tool_connections').select('*').eq('project_id', action.project_id).eq('id', dePrefixId(connectionId)).maybeSingle();
        if (!conn) throw new Error('Bound connection not found in this project');
        const c = conn as { id: string; encrypted_access_ref: string | null; encrypted_refresh_ref: string | null; expires_at: string | null; connector_slug: string };
        const { data: connector } = await supabase.from('connectors').select('oauth_config').eq('slug', c.connector_slug).maybeSingle();
        const args = action.sanitized_arguments as { to?: string; subject?: string; body?: string };
        const out = await executeGmailSend(supabase as never, {
            connection: c,
            organizationId,
            connectorConfig: ((connector?.oauth_config ?? {}) as Record<string, unknown>),
            input: { to: args.to ?? '', subject: args.subject ?? '', body: (args.body as string) ?? '' },
            executionKey: action.execution_key,
        });
        return { result: { message_id: out.message_id, tool: action.tool_name } };
    }

    const mcpServerId = policy.mcp_server_id as string | undefined;
    if (mcpServerId || tool.startsWith('mcp.')) {
        const sid = mcpServerId ? dePrefixId(mcpServerId) : null;
        const { data: server } = sid
            ? await supabase.from('mcp_servers').select('*').eq('project_id', action.project_id).eq('id', sid).maybeSingle()
            : { data: null };
        if (!server) throw new Error('MCP server not found in this project');
        const s = server as { url: string; transport?: string; auth_connection_id?: string | null };
        const mcpTool = (policy.mcp_tool as string) || action.tool_name.replace(/^mcp\./, '');
        // Default-deny egress: the effective version ∩ installation network
        // policy must allowlist the server host (plus outbound safety).
        const { resolveActionNetworkPolicy, checkEgress } = await import('@/lib/embedded/net-policy');
        const netPolicy = await resolveActionNetworkPolicy(supabase as never, { project_id: action.project_id, run_id: (action as { run_id?: string | null }).run_id ?? null, approval_policy: action.approval_policy });
        const egress = await checkEgress(s.url, netPolicy);
        if (!egress.allowed) {
            throw new Error(`Network policy denied MCP egress to ${egress.host ?? 'unknown host'}: ${egress.reason}`);
        }
        // Same authenticated client as discovery: project-scoped credential,
        // modern stateless transport with legacy session fallback.
        const { mcpAuthHeaders, callMcpTool } = await import('@/lib/embedded/mcp');
        const headers = await mcpAuthHeaders(supabase as never, action.project_id, organizationId, s.auth_connection_id ?? null);
        const output = await callMcpTool({ url: s.url, headers, transport: s.transport === 'sse' ? 'sse' : 'streamable-http', tool: mcpTool, args: action.sanitized_arguments });
        return { result: { tool: action.tool_name, output: output ?? null, egress: { host: egress.host, allowed: true } } };
    }

    // Session-backed or manual actions: approval recorded; execution happens via the session resume path.
    return { result: { tool: action.tool_name, approved: true, executed: false } };
}

// POST /v1/actions/:actionId/approve — idempotent; executes once under execution_key.
//
// Delivery semantics: single-claim, at-most-once dispatch with
// reconciliation — NOT true exactly-once external delivery. Exactly one
// approver wins the pending → approved claim; that winner dispatches once.
// But a crash after the external send and before the result write leaves an
// ambiguous state (sent upstream, recorded as approved-not-executed), and
// Gmail does not accept our execution_key as upstream idempotency. Operators:
// on ambiguous actions, check the upstream outbox (Gmail sent folder / MCP
// server logs) before creating a replacement action with a new key.
export async function POST(req: NextRequest, ctx: { params: Promise<{ actionId: string }> }) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const { actionId } = await ctx.params;
    const supabase = createAdminClient();
    const { data } = await supabase.from('actions').select('*').eq('project_id', validation.context.projectId).eq('id', dePrefixId(actionId)).maybeSingle();
    if (!data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Action not found', { requestId }), { requestId });
    const action = data as {
        id: string; tool_name: string; status: string; expires_at: string | null;
        sanitized_arguments: Record<string, unknown>; approval_policy: Record<string, unknown>;
        execution_key: string; project_id: string; result: Record<string, unknown> | null;
    };

    if (action.expires_at && Date.parse(action.expires_at) <= Date.now() && action.status === 'pending') {
        await supabase.from('actions').update({ status: 'expired' }).eq('id', action.id);
        await emitEmbeddedEvent(action.project_id, 'action.expired', { action_id: action.id });
        return addGatewayHeaders(embeddedError(410, 'action_expired', 'Action expired', { requestId }), { requestId });
    }
    // Idempotent replay: already-approved/executed returns the recorded outcome (no duplicate execution).
    if (action.status === 'approved' || action.status === 'executed') {
        return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: action.status, result: action.result ?? null, deduped: true }), { requestId });
    }
    if (action.status !== 'pending') {
        return addGatewayHeaders(embeddedError(409, 'invalid_request_error', `Cannot approve action in status ${action.status}`, { requestId }), { requestId });
    }

    let body: { approved_by?: string } = {};
    try {
        body = await req.json().catch(() => ({}));
    } catch {
        body = {};
    }

    // Atomic claim: exactly one approver moves pending → approved. The
    // conditional update MUST verify a row was actually updated — concurrent
    // approvers serialize here and losers fall into the re-read below instead
    // of dispatching a duplicate side effect.
    const { data: claimed, error: claimError } = await supabase
        .from('actions')
        .update({ status: 'approved', approved_by: body.approved_by ?? null, resolved_at: new Date().toISOString() })
        .eq('id', action.id)
        .eq('status', 'pending')
        .select('id, status')
        .maybeSingle();
    if (claimError || !claimed) {
        const { data: current } = await supabase.from('actions').select('status, result').eq('id', action.id).maybeSingle();
        const currentStatus = (current as { status?: string } | null)?.status;
        if (currentStatus === 'approved' || currentStatus === 'executed') {
            return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: currentStatus, result: (current as { result?: unknown }).result ?? null, deduped: true }), { requestId });
        }
        if (currentStatus === 'expired') {
            return addGatewayHeaders(embeddedError(410, 'action_expired', 'Action expired', { requestId }), { requestId });
        }
        return addGatewayHeaders(embeddedError(409, 'concurrent_modification', 'Action was already resolved by another approver', { requestId }), { requestId });
    }
    await emitEmbeddedEvent(action.project_id, 'action.approved', { action_id: action.id, tool: action.tool_name });

    try {
        const { result } = await dispatchExecution(supabase, { ...action, status: 'approved' }, validation.context.organizationId);
        const executed = (result as { executed?: boolean }).executed !== false && (result as { approved?: boolean }).approved !== true;
        await supabase.from('actions').update({ status: executed ? 'executed' : 'approved', result, resolved_at: new Date().toISOString() }).eq('id', action.id);
        await emitEmbeddedEvent(action.project_id, executed ? 'action.executed' : 'action.approved', { action_id: action.id, tool: action.tool_name });
        return addGatewayHeaders(NextResponse.json({ id: withPrefix('act', action.id), status: executed ? 'executed' : 'approved', result }), { requestId });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Execution failed';
        await supabase.from('actions').update({ status: 'failed', error: message.slice(0, 1000) }).eq('id', action.id);
        await emitEmbeddedEvent(action.project_id, 'action.failed', { action_id: action.id, error: message.slice(0, 300) });
        return addGatewayHeaders(embeddedError(502, 'invalid_request_error', message, { requestId }), { requestId });
    }
}
