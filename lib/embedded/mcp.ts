import { safeOutboundFetch } from '@/lib/security/outbound-url';
import type { createAdminClient } from '@/lib/supabaseAdmin';
import { decryptApiKey } from '@/lib/encryption';

type Admin = ReturnType<typeof createAdminClient>;

export interface DiscoveredTool {
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

async function rpc(url: string, headers: Record<string, string>, method: string, params: Record<string, unknown>): Promise<unknown> {
    const res = await safeOutboundFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e9), method, params }),
        signal: AbortSignal.timeout(20000),
    }, { maxRedirects: 0 });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`MCP ${method} failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (contentType.includes('text/event-stream')) {
        // Minimal SSE parse: first data: line carrying the JSON-RPC response.
        const match = text.split('\n').find((line) => line.startsWith('data:'));
        if (!match) throw new Error('MCP SSE stream carried no data frame');
        const payload = JSON.parse(match.slice('data:'.length).trim()) as { result?: unknown; error?: { message?: string } };
        if (payload.error) throw new Error(`MCP ${method} error: ${payload.error.message ?? 'unknown'}`);
        return payload.result;
    }
    const payload = JSON.parse(text) as { result?: unknown; error?: { message?: string } };
    if (payload.error) throw new Error(`MCP ${method} error: ${payload.error.message ?? 'unknown'}`);
    return payload.result;
}

/** Discover tools on a remote MCP server (Streamable HTTP; SSE fallback via same POST). */
export async function discoverMcpTools(opts: { url: string; headers?: Record<string, string> }): Promise<{ tools: DiscoveredTool[] }> {
    const sessionHeaders = await initializeMcpSession(opts.url, opts.headers ?? {});
    const tools = (await rpc(opts.url.replace(/\/$/, ''), sessionHeaders, 'tools/list', {})) as { tools?: DiscoveredTool[] };
    return { tools: Array.isArray(tools?.tools) ? (tools.tools as DiscoveredTool[]) : [] };
}

/** Shared handshake: initialize → session headers → initialized notification. */
export async function initializeMcpSession(url: string, headers: Record<string, string>): Promise<Record<string, string>> {
    const normalized = url.replace(/\/$/, '');
    const init = (await rpc(normalized, headers, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cencori-embedded', version: '1.0' },
    })) as { sessionId?: string } | null;
    const sessionHeaders = init && typeof init.sessionId === 'string' ? { ...headers, 'mcp-session-id': init.sessionId } : headers;
    try {
        await rpc(normalized, sessionHeaders, 'notifications/initialized', {});
    } catch {
        // Some servers skip the initialized notification; continue regardless.
    }
    return sessionHeaders;
}

/**
 * Project-scoped credential headers for an MCP server's bound auth
 * connection. Secrets are decrypted here and injected as a Bearer header —
 * never into prompts, logs, or stored snapshots.
 */
export async function mcpAuthHeaders(
    supabase: Admin,
    projectId: string,
    organizationId: string,
    authConnectionId: string | null | undefined,
): Promise<Record<string, string>> {
    if (!authConnectionId) return {};
    const { data: conn } = await supabase
        .from('tool_connections')
        .select('encrypted_access_ref')
        .eq('project_id', projectId)
        .eq('id', authConnectionId)
        .maybeSingle();
    const ref = (conn?.encrypted_access_ref as string | null) ?? null;
    if (!ref) return {};
    try {
        return { Authorization: `Bearer ${decryptApiKey(ref, organizationId)}` };
    } catch {
        return {};
    }
}

/** Authenticated tool call sharing the discovery handshake (initialize + session). */
export async function callMcpTool(opts: { url: string; headers?: Record<string, string>; tool: string; args?: Record<string, unknown> }): Promise<unknown> {
    const normalized = opts.url.replace(/\/$/, '');
    const sessionHeaders = await initializeMcpSession(opts.url, opts.headers ?? {});
    const result = (await rpc(normalized, sessionHeaders, 'tools/call', {
        name: opts.tool,
        arguments: opts.args ?? {},
    })) as { content?: unknown; isError?: boolean };
    if (result && typeof result === 'object' && (result as { isError?: boolean }).isError) {
        throw new Error(`MCP tool error: ${JSON.stringify((result as { content?: unknown }).content ?? 'unknown').slice(0, 300)}`);
    }
    return result;
}

export function diffToolSnapshot(previous: DiscoveredTool[], next: DiscoveredTool[]): { added: string[]; removed: string[]; unchanged: string[] } {
    const prev = new Set(previous.map((t) => t.name));
    const curr = new Set(next.map((t) => t.name));
    return {
        added: [...curr].filter((n) => !prev.has(n)),
        removed: [...prev].filter((n) => !curr.has(n)),
        unchanged: [...curr].filter((n) => prev.has(n)),
    };
}

/** Intersect discovered tools with an installation allowlist. Empty allowlist = allow all (M2 default). */
export function applyAllowlist(discovered: string[], allowedTools: string[] | null | undefined): string[] {
    if (!allowedTools || allowedTools.length === 0) return discovered;
    const allowed = new Set(allowedTools);
    return discovered.filter((t) => allowed.has(t));
}
