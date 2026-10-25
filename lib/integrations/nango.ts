/**
 * Nango: sign-in to third-party apps (Google Calendar, Instagram, WhatsApp
 * Business…) and the tools agents use on them.
 *
 * Kept behind this one module on purpose: everything else talks in terms of
 * "integrations", "connections" and "an agent's tool session", so moving
 * from Nango Cloud to a self-hosted Nango (or another provider) touches only
 * this file.
 *
 * - Connections are project-level: a business connects its Google Calendar
 *   once and every agent in the project can use it. They're tagged with the
 *   project id; one connection per app per project.
 * - Agents reach an app's tools through a Nango agent session: an MCP server
 *   scoped to the project's connections and the agent's switched-on tools.
 *   Sessions are short-lived and recreated as needed.
 */

import { safeOutboundFetch } from '@/lib/security/outbound-url';

const NANGO_API = 'https://api.nango.dev';
const REQUEST_TIMEOUT_MS = 20_000;
/** Agent sessions live this long; reused until shortly before they expire. */
const SESSION_TTL = '1h';
const SESSION_REUSE_MS = 50 * 60_000;
const PROJECT_TAG = 'cencori_project';

export class NangoError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) {
        super(message);
    }
}

export function nangoConfigured(): boolean {
    return !!process.env.NANGO_SECRET_KEY;
}

async function nango<T>(method: string, path: string, body?: unknown): Promise<T> {
    const key = process.env.NANGO_SECRET_KEY;
    if (!key) throw new NangoError('Integrations aren\'t set up on this server (NANGO_SECRET_KEY).', 503, 'not_configured');
    const response = await safeOutboundFetch(`${NANGO_API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
        const error = (json as { error?: { code?: string; message?: string } } | null)?.error;
        throw new NangoError(error?.message || `Nango request failed (${response.status})`, response.status, error?.code);
    }
    return json as T;
}

export interface NangoIntegration {
    /** The integration id (`unique_key`) apps are referred to by. */
    id: string;
    name: string;
    provider: string;
    logo: string | null;
}

/** The apps switched on in our Nango environment: what businesses can connect. */
export async function listNangoIntegrations(): Promise<NangoIntegration[]> {
    const { data } = await nango<{ data: Array<{ unique_key: string; display_name: string; provider: string; logo?: string }> }>('GET', '/integrations');
    return data.map((i) => ({ id: i.unique_key, name: i.display_name, provider: i.provider, logo: i.logo ?? null }));
}

export interface NangoConnection {
    connectionId: string;
    integration: string;
    provider: string;
    createdAt: string;
    /** Set when Nango couldn't refresh the credentials: the business needs to reconnect. */
    broken: boolean;
}

/** The project's connected apps. */
export async function listProjectConnections(projectId: string): Promise<NangoConnection[]> {
    const params = new URLSearchParams({ [`tags[${PROJECT_TAG}]`]: projectId });
    const { connections } = await nango<{ connections: Array<{ connection_id: string; provider_config_key: string; provider: string; created: string; errors?: unknown[]; tags?: Record<string, string> }> }>('GET', `/connections?${params}`);
    return connections
        // The tag filter is applied server-side; checked again so a mismatch can't leak another project's apps.
        .filter((c) => !c.tags || c.tags[PROJECT_TAG] === projectId)
        .map((c) => ({ connectionId: c.connection_id, integration: c.provider_config_key, provider: c.provider, createdAt: c.created, broken: Array.isArray(c.errors) && c.errors.length > 0 }));
}

/** A sign-in link for one app, tagging the resulting connection with the project. */
export async function createConnectLink(projectId: string, integration: string): Promise<{ url: string; expiresAt: string }> {
    const { data } = await nango<{ data: { token: string; connect_link?: string; expires_at: string } }>('POST', '/connect/sessions', {
        tags: { [PROJECT_TAG]: projectId },
        allowed_integrations: [integration],
    });
    return { url: data.connect_link ?? `https://connect.nango.dev/?session_token=${encodeURIComponent(data.token)}`, expiresAt: data.expires_at };
}

export async function deleteConnection(integration: string, connectionId: string): Promise<void> {
    await nango('DELETE', `/connections/${encodeURIComponent(connectionId)}?provider_config_key=${encodeURIComponent(integration)}`);
}

export interface NangoTool {
    /** The name the session lists and calls it by, e.g. `google-calendar__create-event`. */
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    readOnly: boolean;
    destructive: boolean;
}

type Session = { mcpUrl: string; token: string; expiresAt: number };
const sessionCache = new Map<string, Session>();
const sessionsInFlight = new Map<string, Promise<Session>>();

/**
 * An agent session for the project, limited to the given tools per app.
 * Reused while fresh; a new one is created when it's about to expire (or
 * `force`, after the session was rejected).
 */
export async function agentToolSession(projectId: string, toolset: Record<string, string[]>, opts: { force?: boolean } = {}): Promise<Session> {
    const integrations = Object.keys(toolset).sort();
    const key = `${projectId}|${integrations.map((i) => `${i}:${[...toolset[i]].sort().join(',')}`).join('|')}`;
    const cached = sessionCache.get(key);
    if (!opts.force && cached && cached.expiresAt > Date.now()) return cached;
    // A warm-up started at the top of the turn may still be creating it: share that.
    const pending = sessionsInFlight.get(key);
    if (!opts.force && pending) return pending;
    const creating = createAgentSession(key, projectId, integrations, toolset);
    sessionsInFlight.set(key, creating);
    try {
        return await creating;
    } finally {
        if (sessionsInFlight.get(key) === creating) sessionsInFlight.delete(key);
    }
}

async function createAgentSession(key: string, projectId: string, integrations: string[], toolset: Record<string, string[]>): Promise<Session> {
    // Sessions list a tool as `<app>__<action>`; the toolset names the action alone.
    const actions = (integration: string) => toolset[integration].map((name) => (name.startsWith(`${integration}__`) ? name.slice(integration.length + 2) : name));
    const { data } = await nango<{ data: { session_token: string; mcp_url: string } }>('POST', '/sessions', {
        tenant: { connections: { any: [{ tags: { [PROJECT_TAG]: projectId } }] } },
        toolset: Object.fromEntries(integrations.map((i) => [i, { allow: { tools: actions(i) } }])),
        // Pinned so they're callable directly by name; no search, and no raw API access.
        pinned_tools: Object.fromEntries(integrations.map((i) => [i, actions(i)])),
        meta_tools: { nango_tool_search: false, nango_execute: false, nango_proxy: false },
        expires_in: SESSION_TTL,
    });
    const session = { mcpUrl: data.mcp_url, token: data.session_token, expiresAt: Date.now() + SESSION_REUSE_MS };
    sessionCache.set(key, session);
    if (sessionCache.size > 2_000) {
        const oldest = sessionCache.keys().next().value;
        if (oldest !== undefined) sessionCache.delete(oldest);
    }
    return session;
}

async function mcpCall<T>(mcpUrl: string, token: string, method: string, params: Record<string, unknown>): Promise<T> {
    const response = await safeOutboundFetch(mcpUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const text = await response.text();
    if (!response.ok) throw new NangoError(`Nango session ${method} failed (${response.status})`, response.status);
    const json = text.trimStart().startsWith('{') ? text : text.split('\n').find((line) => line.startsWith('data:'))?.slice(5) ?? '{}';
    const body = JSON.parse(json) as { result?: T; error?: { message?: string } };
    if (body.error) throw new NangoError(body.error.message ?? `Nango session ${method} failed`, 502);
    return body.result as T;
}

/** Broad queries that together surface every tool of an app through search. */
const DISCOVERY_QUERIES = ['list', 'get', 'create', 'update', 'delete', 'search', 'send', 'add', 'find', 'read', 'write', 'manage', 'move', 'patch', 'watch', 'stop', 'import', 'export', 'settings', 'status', 'upload', 'reply', 'cancel', 'clear'];

/**
 * Every tool an app offers, with its input schema. Nango has no listing
 * endpoint, so names are found through the session's search (until the
 * count it reports is reached) and then listed in full by pinning them.
 */
export async function discoverIntegrationTools(projectId: string, integration: string): Promise<NangoTool[]> {
    const { data } = await nango<{ data: { session_token: string; mcp_url: string; toolset: Record<string, { tools_searchable?: number; tools_pinned?: number }> } }>('POST', '/sessions', {
        tenant: { connections: { any: [{ tags: { [PROJECT_TAG]: projectId } }] } },
        toolset: { [integration]: '*' },
        meta_tools: { nango_tool_search: true, nango_execute: false, nango_proxy: false },
        expires_in: '120s',
    });
    const expected = data.toolset[integration]?.tools_searchable ?? 0;
    if (expected === 0) return [];
    const names = new Set<string>();
    const search = async (query: string) => {
        const result = await mcpCall<{ content?: Array<{ text?: string }> }>(data.mcp_url, data.session_token, 'tools/call', { name: 'nango_tool_search', arguments: { query } }).catch(() => null);
        const text = result?.content?.find((part) => typeof part.text === 'string')?.text ?? '';
        // Matches and loosely related tools both carry `"integration"` and `"action"`.
        for (const m of text.matchAll(/"integration":\s*"([^"]+)",\s*"action":\s*"([^"]+)"/g)) {
            if (m[1] === integration) names.add(m[2]);
        }
    };
    // A few searches at a time, until the count Nango reported is reached.
    const queries = [integration.replace(/[-_]/g, ' '), ...DISCOVERY_QUERIES];
    for (let i = 0; i < queries.length && names.size < expected; i += 6) {
        await Promise.all(queries.slice(i, i + 6).map(search));
    }
    if (names.size === 0) return [];

    // Pin what was found to get every tool's full definition.
    const listing = await nango<{ data: { session_token: string; mcp_url: string } }>('POST', '/sessions', {
        tenant: { connections: { any: [{ tags: { [PROJECT_TAG]: projectId } }] } },
        toolset: { [integration]: '*' },
        pinned_tools: { [integration]: [...names] },
        meta_tools: { nango_tool_search: false, nango_execute: false, nango_proxy: false },
        expires_in: '120s',
    });
    const tools: NangoTool[] = [];
    let cursor: string | undefined;
    do {
        const page = await mcpCall<{ tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean } }>; nextCursor?: string }>(
            listing.data.mcp_url, listing.data.session_token, 'tools/list', cursor ? { cursor } : {},
        );
        for (const tool of page.tools ?? []) {
            tools.push({
                name: tool.name,
                description: tool.description ?? '',
                inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
                readOnly: tool.annotations?.readOnlyHint === true,
                destructive: tool.annotations?.destructiveHint === true || /(^|__|-)(delete|remove|cancel|archive|clear)(-|_|$)/.test(tool.name),
            });
        }
        cursor = page.nextCursor;
    } while (cursor && tools.length < 500);
    return tools;
}
