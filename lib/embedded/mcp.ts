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

export type McpTransport = 'streamable-http' | 'sse';
// NOTE: 'sse' survives only for rows stored before the HTTP+SSE transport was
// retired from registration. Those rows use the legacy POST fallback path;
// new servers must register as streamable-http (dual modern/legacy).

/** Spec 2026-07-28: stateless core, header-routed requests, no handshake. */
export const MCP_MODERN_PROTOCOL_VERSION = '2026-07-28';
/** Latest handshake-era revision (legacy era spans 2024-10-07 … 2025-11-25). */
export const MCP_LEGACY_PROTOCOL_VERSION = '2025-11-25';
const CLIENT_IDENTITY = { name: 'cencori-embedded', version: '1.0' };

interface RpcResult {
    result: unknown;
    responseHeaders: Headers;
}

async function postJson(url: string, headers: Record<string, string>, body: Record<string, unknown>): Promise<Response> {
    return safeOutboundFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
    }, { maxRedirects: 0 });
}

function parseRpcBody(text: string, contentType: string, method: string): unknown {
    if (contentType.includes('text/event-stream')) {
        // Minimal SSE parse: first data: line carrying the JSON-RPC response.
        const match = text.split('\n').find((line) => line.startsWith('data:'));
        if (!match) throw new Error('MCP SSE stream carried no data frame');
        const payload = JSON.parse(match.slice('data:'.length).trim()) as { result?: unknown; error?: { code?: number; message?: string } };
        if (payload.error) throw Object.assign(new Error(`MCP ${method} error: ${payload.error.message ?? 'unknown'}`), { code: payload.error.code });
        return payload.result;
    }
    const payload = JSON.parse(text) as { result?: unknown; error?: { code?: number; message?: string } };
    if (payload.error) throw Object.assign(new Error(`MCP ${method} error: ${payload.error.message ?? 'unknown'}`), { code: payload.error.code });
    return payload.result;
}

async function rpc(url: string, headers: Record<string, string>, method: string, params: Record<string, unknown>): Promise<RpcResult> {
    const res = await postJson(url, headers, { jsonrpc: '2.0', id: Math.floor(Math.random() * 1e9), method, params });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw Object.assign(new Error(`MCP ${method} failed (${res.status}): ${text.slice(0, 300)}`), { httpStatus: res.status });
    }
    const text = await res.text();
    return { result: parseRpcBody(text, res.headers.get('content-type') ?? '', method), responseHeaders: res.headers };
}

function withClientMeta(params: Record<string, unknown>): Record<string, unknown> {
    return { ...params, _meta: { 'io.modelcontextprotocol/clientInfo': CLIENT_IDENTITY } };
}

function modernHeaders(base: Record<string, string>, method: string, name?: string): Record<string, string> {
    return {
        ...base,
        'MCP-Protocol-Version': MCP_MODERN_PROTOCOL_VERSION,
        'Mcp-Method': method,
        ...(name ? { 'Mcp-Name': name } : {}),
    };
}

/** True when a failure means "this server does not speak modern stateless". */
function isModernNotSupported(error: unknown): boolean {
    const status = (error as { httpStatus?: number })?.httpStatus;
    if (status === 400 || status === 404 || status === 405 || status === 501) return true;
    // 401/403 are auth walls and 5xx is server failure — neither is era evidence.
    const code = (error as { code?: number })?.code;
    // method-not-found / invalid-request: server predates header routing.
    // -32022 UnsupportedProtocolVersion: explicit modern-to-legacy downgrade signal.
    if (code === -32601 || code === -32600 || code === -32022) return true;
    return false;
}

/**
 * Legacy handshake: initialize → session ID → initialized notification.
 * The session ID is captured from the Mcp-Session-Id RESPONSE HEADER first
 * (stateful Streamable HTTP servers), falling back to a sessionId in the
 * initialize result for older implementations. The server-negotiated
 * protocol version is propagated on all subsequent legacy requests via
 * MCP-Protocol-Version — only the session ID is not enough.
 */
export async function initializeMcpSession(url: string, headers: Record<string, string>): Promise<Record<string, string>> {
    const normalized = url.replace(/\/$/, '');
    const { result, responseHeaders } = await rpc(normalized, headers, 'initialize', {
        protocolVersion: MCP_LEGACY_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: CLIENT_IDENTITY,
    });
    const headerSession = responseHeaders.get('mcp-session-id');
    const body = (result ?? {}) as { sessionId?: unknown; protocolVersion?: unknown };
    const sessionId = headerSession || (typeof body.sessionId === 'string' ? body.sessionId : null);
    const negotiatedVersion = typeof body.protocolVersion === 'string' ? body.protocolVersion : MCP_LEGACY_PROTOCOL_VERSION;
    const sessionHeaders: Record<string, string> = { ...headers, 'MCP-Protocol-Version': negotiatedVersion };
    if (sessionId) sessionHeaders['mcp-session-id'] = sessionId;
    try {
        await rpc(normalized, sessionHeaders, 'notifications/initialized', {});
    } catch {
        // Some servers skip the initialized notification; continue regardless.
    }
    return sessionHeaders;
}

/** Discover tools, modern-first with legacy fallback (SSE servers are legacy-only). */
export async function discoverMcpTools(opts: { url: string; headers?: Record<string, string>; transport?: McpTransport }): Promise<{ tools: DiscoveredTool[]; transport: 'modern' | 'legacy' }> {
    const headers = opts.headers ?? {};
    const normalized = opts.url.replace(/\/$/, '');
    const modernFirst = (opts.transport ?? 'streamable-http') === 'streamable-http';

    if (modernFirst) {
        try {
            const { result } = await rpc(
                normalized,
                modernHeaders(headers, 'tools/list'),
                'tools/list',
                withClientMeta({}),
            );
            const tools = (result ?? {}) as { tools?: DiscoveredTool[] };
            return { tools: Array.isArray(tools.tools) ? tools.tools : [], transport: 'modern' };
        } catch (e) {
            if (!isModernNotSupported(e)) throw e;
            // Fall through to the legacy handshake below.
        }
    }

    const sessionHeaders = await initializeMcpSession(opts.url, headers);
    const { result: listed } = await rpc(normalized, sessionHeaders, 'tools/list', {});
    const tools = (listed ?? {}) as { tools?: DiscoveredTool[] };
    return { tools: Array.isArray(tools?.tools) ? (tools.tools as DiscoveredTool[]) : [], transport: 'legacy' };
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

/** Authenticated tool call sharing the discovery transport (modern-first, legacy fallback). */
export async function callMcpTool(opts: { url: string; headers?: Record<string, string>; transport?: McpTransport; tool: string; args?: Record<string, unknown> }): Promise<unknown> {
    const headers = opts.headers ?? {};
    const normalized = opts.url.replace(/\/$/, '');
    const modernFirst = (opts.transport ?? 'streamable-http') === 'streamable-http';

    if (modernFirst) {
        try {
            const { result } = await rpc(
                normalized,
                modernHeaders(headers, 'tools/call', opts.tool),
                'tools/call',
                withClientMeta({ name: opts.tool, arguments: opts.args ?? {} }),
            );
            return assertToolResult(result);
        } catch (e) {
            if (!isModernNotSupported(e)) throw e;
        }
    }

    const sessionHeaders = await initializeMcpSession(opts.url, headers);
    const { result } = await rpc(normalized, sessionHeaders, 'tools/call', {
        name: opts.tool,
        arguments: opts.args ?? {},
    });
    return assertToolResult(result);
}

function assertToolResult(result: unknown): unknown {
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

/**
 * Shape of POST /v1/mcp/servers per the Embedded Agents OpenAPI contract
 * (`McpDiscoveryResult`): the server nested under `server` with its freshly
 * discovered tools. Registration has no previous snapshot, so everything
 * discovered counts as added.
 */
export function toMcpDiscoveryResult(
    server: Record<string, unknown>,
    tools: DiscoveredTool[],
): { server: Record<string, unknown>; tools: DiscoveredTool[]; added: string[]; removed: string[]; changed: string[] } {
    return {
        server,
        tools,
        added: tools.map((t) => t.name),
        removed: [],
        changed: [],
    };
}

/** Intersect discovered tools with an installation allowlist. Empty allowlist = allow all (M2 default). */
export function applyAllowlist(discovered: string[], allowedTools: string[] | null | undefined): string[] {
    if (!allowedTools || allowedTools.length === 0) return discovered;
    const allowed = new Set(allowedTools);
    return discovered.filter((t) => allowed.has(t));
}
