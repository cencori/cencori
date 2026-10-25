/**
 * MCP servers attached to an agent: paste a server URL, pick its tools, and
 * the agent can call them in Preview, conversations and API runs.
 *
 * Stored on the agent version as `mcp_servers`, next to its webhook tools,
 * with a snapshot of each server's tools (what the model is offered) and the
 * ones switched on. Header values (API keys) are encrypted with the
 * organization's key, like webhook headers. Separate from the project's
 * API-registered `mcp_servers` table, which API agents use through manifest
 * `mcp_tools` grants.
 */

import { randomBytes } from 'crypto';
import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { assertSafeOutboundUrl } from '@/lib/security/outbound-url';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { callMcpTool, discoverMcpTools, type DiscoveredTool } from './mcp';
import { mcpAccessToken } from './mcp-oauth';
import { agentToolSession } from '@/lib/integrations/nango';
import { fetchMcpServerIcon, readStoredIcon } from './mcp-icon';

export const AGENT_MCP_SERVERS_MAX = 5;
/** Tools kept per server from discovery, and switched on across all servers. */
const SERVER_TOOLS_MAX = 100;
export const AGENT_MCP_ENABLED_MAX = 64;
const HEADERS_MAX = 5;
/** Tool output the model reads; longer output is cut with a note saying so. */
const RESULT_MAX_CHARS = 24_000;
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,64}$/;
const TOOL_NAME_RE = /^[A-Za-z0-9_.\-/]{1,128}$/;
const RESERVED_HEADERS = new Set(['host', 'content-length', 'content-type', 'connection', 'transfer-encoding', 'cookie', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'mcp-method', 'mcp-name']);

export interface AgentMcpTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    /** The server's own hints; destructive tools start switched off. */
    readOnly: boolean;
    destructive: boolean;
}

/** As stored: header values encrypted. */
export interface AgentMcpServer {
    id: string;
    name: string;
    url: string;
    headers: Array<{ name: string; value_encrypted: string }>;
    tools: AgentMcpTool[];
    /** Tool names the agent may call. */
    enabled: string[];
    discovered_at: string;
    /** The server's logo as a small data URL, found when it was connected. */
    icon?: string;
    /** Signed in with OAuth instead of a key: tokens live in this project connection. */
    oauth?: { connection_id: string; issuer: string };
    /**
     * A connected app (integration) rather than a pasted server: its tools run
     * through an integration session for the project, opened at call time.
     */
    nango?: { integration: string };
}

/** A header from the console: a new value, or `keep` to reuse the stored one. */
type HeaderInput = { name?: unknown; value?: unknown; keep?: unknown };

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

function sanitizeTool(raw: unknown): AgentMcpTool | null {
    const t = raw as Partial<DiscoveredTool & AgentMcpTool> | null;
    if (!t || typeof t.name !== 'string' || !TOOL_NAME_RE.test(t.name)) return null;
    const schema = (t.inputSchema && typeof t.inputSchema === 'object' && !Array.isArray(t.inputSchema)) ? t.inputSchema : { type: 'object', properties: {} };
    const annotations = (t as DiscoveredTool).annotations ?? {};
    return {
        name: t.name,
        description: typeof t.description === 'string' ? t.description.slice(0, 1000) : '',
        inputSchema: schema as Record<string, unknown>,
        readOnly: typeof t.readOnly === 'boolean' ? t.readOnly : annotations.readOnlyHint === true,
        destructive: typeof t.destructive === 'boolean' ? t.destructive : annotations.destructiveHint === true,
    };
}

/** The stored list, defensively read. */
export function readAgentMcpServers(config: Record<string, unknown> | null | undefined): AgentMcpServer[] {
    return readServerList(config?.mcp_servers).filter((server) => !server.nango);
}

/** The agent's connected apps (stored as `integrations`), read the same way. */
export function readAgentIntegrations(config: Record<string, unknown> | null | undefined): AgentMcpServer[] {
    return readServerList(config?.integrations).filter((server) => !!server.nango);
}

function readServerList(raw: unknown): AgentMcpServer[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): AgentMcpServer[] => {
        const s = entry as Partial<AgentMcpServer> | null;
        if (!s || typeof s.id !== 'string' || typeof s.url !== 'string') return [];
        const tools = (Array.isArray(s.tools) ? s.tools : []).map(sanitizeTool).filter((t): t is AgentMcpTool => !!t);
        const names = new Set(tools.map((t) => t.name));
        return [{
            id: s.id,
            name: typeof s.name === 'string' && s.name ? s.name : hostOf(s.url),
            url: s.url,
            headers: Array.isArray(s.headers) ? s.headers.filter((h) => h && typeof h.name === 'string' && typeof h.value_encrypted === 'string') : [],
            tools,
            enabled: Array.isArray(s.enabled) ? s.enabled.filter((n): n is string => typeof n === 'string' && names.has(n)) : [],
            discovered_at: typeof s.discovered_at === 'string' ? s.discovered_at : '',
            ...(readStoredIcon(s.icon) ? { icon: readStoredIcon(s.icon)! } : {}),
            ...(s.oauth && typeof s.oauth.connection_id === 'string' ? { oauth: { connection_id: s.oauth.connection_id, issuer: typeof s.oauth.issuer === 'string' ? s.oauth.issuer : '' } } : {}),
            ...(s.nango && typeof s.nango.integration === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(s.nango.integration) ? { nango: { integration: s.nango.integration } } : {}),
        }];
    });
}

/** What the console may see: everything but header values and the connection behind a sign-in. */
export function publicAgentMcpServers(servers: AgentMcpServer[]) {
    return servers.map(({ headers, oauth, ...rest }) => ({
        ...rest,
        headers: headers.map((h) => ({ name: h.name })),
        ...(oauth ? { signed_in: { issuer: oauth.issuer } } : {}),
    }));
}

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/** A short readable label from the URL: mcp.linear.app → linear. */
export function defaultServerName(url: string): string {
    const host = hostOf(url).replace(/:\d+$/, '');
    const parts = host.split('.').filter((p) => !['www', 'mcp', 'api', 'app', 'com', 'io', 'dev', 'ai', 'co', 'net', 'org', 'cloud', 'sh'].includes(p));
    return (parts[0] ?? host).slice(0, 40) || host;
}

/** Decrypt stored headers, and encrypt new ones, into the stored form. */
function buildHeaders(
    input: unknown,
    previous: AgentMcpServer['headers'],
    organizationId: string,
): { ok: true; headers: AgentMcpServer['headers'] } | { ok: false; message: string } {
    const headers: AgentMcpServer['headers'] = [];
    for (const h of (Array.isArray(input) ? input : []) as HeaderInput[]) {
        const name = text(h?.name, 64);
        if (!name) continue;
        if (!HEADER_NAME_RE.test(name) || RESERVED_HEADERS.has(name.toLowerCase())) return { ok: false, message: `"${name}" can't be used as a header.` };
        if (h.keep === true) {
            const kept = previous.find((p) => p.name.toLowerCase() === name.toLowerCase());
            if (kept) headers.push({ name, value_encrypted: kept.value_encrypted });
            continue;
        }
        const value = typeof h.value === 'string' ? h.value.trim().slice(0, 4000) : '';
        if (!value) continue;
        if (/[\r\n]/.test(value)) return { ok: false, message: `The ${name} header can't contain line breaks.` };
        headers.push({ name, value_encrypted: encryptApiKey(value, organizationId) });
    }
    if (headers.length > HEADERS_MAX) return { ok: false, message: `Add up to ${HEADERS_MAX} headers.` };
    return { ok: true, headers };
}

function plainHeaders(headers: AgentMcpServer['headers'], organizationId: string): Record<string, string> {
    return Object.fromEntries(headers.map((h) => [h.name, decryptApiKey(h.value_encrypted, organizationId)]));
}

/** The headers a request to the server carries: its saved key, or a Bearer token from its sign-in. */
async function serverHeaders(server: Pick<AgentMcpServer, 'headers' | 'oauth'>, organizationId: string, opts: { force?: boolean } = {}): Promise<Record<string, string>> {
    if (server.oauth) {
        const token = await mcpAccessToken(createAdminClient(), server.oauth.connection_id, organizationId, opts);
        return { Authorization: `Bearer ${token}` };
    }
    return plainHeaders(server.headers, organizationId);
}

/** A pasted server URL made usable: https:// added when missing, http and private addresses refused. */
export async function normalizeMcpServerUrl(value: unknown): Promise<{ ok: true; url: URL } | { ok: false; message: string }> {
    const raw = text(value, 2000);
    let url: URL;
    try {
        url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    } catch {
        return { ok: false, message: 'Paste the full server URL, like https://mcp.example.com/mcp.' };
    }
    if (url.protocol !== 'https:') return { ok: false, message: 'The server URL must use https://.' };
    try {
        return { ok: true, url: await assertSafeOutboundUrl(url.toString()) };
    } catch {
        return { ok: false, message: 'That address can\'t be reached from Cencori.' };
    }
}

export type McpConnectResult =
    | { ok: true; server: AgentMcpServer }
    | { ok: false; needsAuth: boolean; message: string; signedOut?: boolean };

/**
 * Connect to a server and list its tools: the "paste a URL" step. Returns
 * the server ready to store (new tools on unless the server marks them
 * destructive; a refresh keeps the previous choices). `needsAuth` means the
 * server answered 401/403, so the console asks for a key.
 */
export async function connectAgentMcpServer(opts: {
    url: unknown;
    headers?: unknown;
    organizationId: string;
    /** The stored server being refreshed or re-keyed, if any. */
    previous?: AgentMcpServer | null;
    /** Just signed in: use this connection's token (replaces any key). */
    oauth?: { connection_id: string; issuer: string };
}): Promise<McpConnectResult> {
    const normalized = await normalizeMcpServerUrl(opts.url);
    if (!normalized.ok) return { ok: false, needsAuth: false, message: normalized.message };
    const url = normalized.url;
    // A new key replaces a sign-in; otherwise a refresh keeps whichever the server had.
    const oauth = opts.oauth ?? (opts.headers === undefined ? opts.previous?.oauth : undefined);
    const headers = oauth ? { ok: true as const, headers: [] } : buildHeaders(opts.headers ?? (opts.previous?.headers.map((h) => ({ name: h.name, keep: true })) ?? []), opts.previous?.headers ?? [], opts.organizationId);
    if (!headers.ok) return { ok: false, needsAuth: false, message: headers.message };

    let discovered: DiscoveredTool[];
    let icon: string | null = null;
    try {
        let requestHeaders: Record<string, string>;
        try {
            requestHeaders = await serverHeaders({ headers: headers.headers, oauth }, opts.organizationId);
        } catch {
            return { ok: false, needsAuth: true, signedOut: true, message: 'The sign-in for this server has expired. Sign in again.' };
        }
        // The logo loads alongside the tools; a missing one never fails the connect.
        const [listed, foundIcon] = await Promise.all([
            discoverMcpTools({ url: url.toString(), headers: requestHeaders }),
            fetchMcpServerIcon(url.toString(), requestHeaders).catch(() => null),
        ]);
        discovered = listed.tools;
        icon = foundIcon ?? opts.previous?.icon ?? null;
    } catch (error) {
        const status = (error as { httpStatus?: number }).httpStatus;
        if (status === 401 || status === 403) {
            return {
                ok: false,
                needsAuth: true,
                message: headers.headers.length > 0 ? 'The server didn\'t accept that key. Check it and try again.' : 'This server needs a key to connect.',
            };
        }
        if (status === 404 || status === 405) return { ok: false, needsAuth: false, message: 'No MCP server answered at that URL. Check the path (it often ends in /mcp).' };
        if (error instanceof Error && error.name === 'TimeoutError') return { ok: false, needsAuth: false, message: 'The server didn\'t respond in time.' };
        return { ok: false, needsAuth: false, message: 'Couldn\'t connect to that server. Check the URL and that it speaks MCP over HTTP.' };
    }

    const tools = discovered.map(sanitizeTool).filter((t): t is AgentMcpTool => !!t).slice(0, SERVER_TOOLS_MAX);
    if (tools.length === 0) return { ok: false, needsAuth: false, message: 'Connected, but the server has no tools to offer.' };
    const previous = opts.previous;
    const enabled = previous
        // A refresh keeps what was on, and turns on tools that are new since.
        ? tools.filter((t) => previous.enabled.includes(t.name) || (!previous.tools.some((p) => p.name === t.name) && !t.destructive)).map((t) => t.name)
        : tools.filter((t) => !t.destructive).map((t) => t.name);
    return {
        ok: true,
        server: {
            id: previous?.id ?? `mcp_${randomBytes(6).toString('hex')}`,
            name: previous?.name ?? defaultServerName(url.toString()),
            url: url.toString(),
            headers: headers.headers,
            tools,
            enabled,
            discovered_at: new Date().toISOString(),
            ...(icon ? { icon } : {}),
            ...(oauth ? { oauth } : {}),
        },
    };
}

/**
 * Validate the console's list for saving. Servers are only ever created by
 * `connectAgentMcpServer`, so this keeps stored servers (and their snapshot
 * and keys) and applies the console's choices: which tools are on, the
 * name, and removals. New servers arrive as the connect step returned them.
 */
export function buildAgentMcpServers(
    input: unknown,
    existing: AgentMcpServer[],
    connected: AgentMcpServer[],
): { ok: true; servers: AgentMcpServer[] } | { ok: false; message: string } {
    if (!Array.isArray(input)) return { ok: false, message: 'Send MCP servers as a list.' };
    if (input.length > AGENT_MCP_SERVERS_MAX) return { ok: false, message: `Add up to ${AGENT_MCP_SERVERS_MAX} MCP servers.` };
    const servers: AgentMcpServer[] = [];
    for (const raw of input as Array<{ id?: unknown; name?: unknown; enabled?: unknown }>) {
        const id = text(raw?.id, 64);
        const base = connected.find((s) => s.id === id) ?? existing.find((s) => s.id === id);
        if (!base) return { ok: false, message: 'Connect that server again before saving.' };
        const names = new Set(base.tools.map((t) => t.name));
        const enabled = Array.isArray(raw.enabled) ? [...new Set((raw.enabled as unknown[]).filter((n): n is string => typeof n === 'string' && names.has(n)))] : base.enabled;
        servers.push({ ...base, name: text(raw.name, 40) || base.name, enabled });
    }
    const total = servers.reduce((sum, s) => sum + s.enabled.length, 0);
    if (total > AGENT_MCP_ENABLED_MAX) return { ok: false, message: `Switch on up to ${AGENT_MCP_ENABLED_MAX} MCP tools in total; the agent chooses worse with more.` };
    return { ok: true, servers };
}

/** The name the model sees: server label and tool, within provider limits. */
export function agentMcpToolName(server: AgentMcpServer, tool: string): string {
    const clean = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${clean(server.name).slice(0, 20)}__${clean(tool)}`.slice(0, 64);
}

export interface AgentMcpBinding {
    definition: { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } };
    server: AgentMcpServer;
    tool: string;
}

/** The switched-on tools, as function tools mapped back to their server. */
export function agentMcpBindings(servers: AgentMcpServer[], taken: Set<string>): AgentMcpBinding[] {
    const out: AgentMcpBinding[] = [];
    for (const server of servers) {
        for (const tool of server.tools.filter((t) => server.enabled.includes(t.name))) {
            // An app's tools already carry their app in the name (google-calendar__create-event).
            const base = server.nango ? tool.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) : agentMcpToolName(server, tool.name);
            let name = base;
            for (let n = 2; taken.has(name); n++) name = `${base.slice(0, 60)}_${n}`;
            taken.add(name);
            out.push({
                definition: {
                    type: 'function',
                    function: {
                        name,
                        description: `${tool.description || tool.name} (from ${server.name})`.slice(0, 1000),
                        parameters: tool.inputSchema,
                    },
                },
                server,
                tool: tool.name,
            });
        }
    }
    return out;
}

/** Call the tool on its server. Never throws: the outcome is text for the model. */
export async function runAgentMcpTool(
    binding: AgentMcpBinding,
    argumentsJson: string,
    organizationId: string,
    projectId?: string,
): Promise<{ ok: boolean; output: string }> {
    let args: Record<string, unknown>;
    try {
        const parsed = JSON.parse(argumentsJson || '{}') as unknown;
        args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
        return { ok: false, output: `The arguments for ${binding.tool} weren't valid JSON.` };
    }
    const unavailable = { ok: false, output: `${binding.server.name} isn't connected right now (its sign-in or key needs renewing). Tell the user it's unavailable.` };
    const call = async (force: boolean) => {
        if (binding.server.nango) {
            // A connected app: the project's integration session, limited to this agent's switched-on tools.
            if (!projectId) throw new Error('signed_out');
            const session = await agentToolSession(projectId, { [binding.server.nango.integration]: binding.server.enabled }, { force });
            return callMcpTool({ url: session.mcpUrl, headers: { Authorization: `Bearer ${session.token}` }, tool: binding.tool, args });
        }
        const headers = await serverHeaders(binding.server, organizationId, { force });
        return callMcpTool({ url: binding.server.url, headers, tool: binding.tool, args });
    };
    try {
        let result: unknown;
        try {
            result = await call(false);
        } catch (error) {
            // A rejected token (or ended session) gets one refresh and retry before giving up.
            const status = (error as { httpStatus?: number }).httpStatus;
            if ((!binding.server.oauth && !binding.server.nango) || (status !== 401 && status !== 403)) throw error;
            result = await call(true);
        }
        return { ok: true, output: mcpResultText(result) };
    } catch (error) {
        const status = (error as { httpStatus?: number }).httpStatus;
        if (status === 401 || status === 403 || (error instanceof Error && error.message === 'signed_out')) return unavailable;
        if (error instanceof Error && /decrypt/i.test(error.message)) return unavailable;
        return { ok: false, output: `${binding.tool} failed: ${(error instanceof Error ? error.message : 'unknown error').slice(0, 300)}` };
    }
}

/** MCP results are content parts; the model gets their text. */
/** Create the connected apps' sessions ahead of the first call (cached, so calls reuse them). */
export function warmAgentMcpSessions(bindings: AgentMcpBinding[], projectId: string): void {
    const seen = new Set<string>();
    for (const binding of bindings) {
        const nango = binding.server.nango;
        if (!nango || seen.has(nango.integration)) continue;
        seen.add(nango.integration);
        void agentToolSession(projectId, { [nango.integration]: binding.server.enabled }).catch(() => undefined);
    }
}

export function mcpResultText(result: unknown): string {
    const content = (result as { content?: unknown } | null)?.content;
    if (Array.isArray(content)) {
        const parts = content.map((part) => {
            const p = part as { type?: string; text?: unknown; resource?: { text?: unknown; uri?: unknown } };
            if (p.type === 'text' && typeof p.text === 'string') return compactJson(p.text);
            if (p.type === 'resource' && typeof p.resource?.text === 'string') return compactJson(p.resource.text);
            if (p.type === 'image') return '[image]';
            return '';
        }).filter(Boolean);
        if (parts.length > 0) return capResult(parts.join('\n'));
    }
    const structured = (result as { structuredContent?: unknown } | null)?.structuredContent;
    return capResult(JSON.stringify(structured ?? result ?? null));
}

/** Pretty-printed JSON costs a third more of the limit in indentation alone. */
function compactJson(text: string): string {
    const trimmed = text.trim();
    if (!/^[[{]/.test(trimmed)) return text;
    try {
        return JSON.stringify(JSON.parse(trimmed));
    } catch {
        return text;
    }
}

function capResult(text: string): string {
    if (text.length <= RESULT_MAX_CHARS) return text;
    return `${text.slice(0, RESULT_MAX_CHARS)}\n[Result cut off: ${text.length - RESULT_MAX_CHARS} more characters not shown. Narrow the request (a time range, a search term, fewer results) to see the rest.]`;
}
