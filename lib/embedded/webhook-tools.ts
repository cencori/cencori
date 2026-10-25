/**
 * Webhook tools: HTTPS endpoints an agent can call mid-conversation. The
 * owner describes the endpoint and its inputs in the console; the model sees
 * a function tool, Cencori makes the request server-side and hands the
 * response back to the model, which then answers.
 *
 * Stored on the agent version as `webhook_tools`, separate from manifest
 * `tools` (whose function tools are executed by the caller). Header values
 * are encrypted with the organization's key, because versions can be
 * published to the marketplace and forked: a forked copy can't read them.
 */

import { decryptApiKey, encryptApiKey } from '@/lib/encryption';
import { safeOutboundFetch } from '@/lib/security/outbound-url';

export const WEBHOOK_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type WebhookMethod = (typeof WEBHOOK_METHODS)[number];
export const WEBHOOK_PARAM_TYPES = ['string', 'number', 'boolean'] as const;
export type WebhookParamType = (typeof WEBHOOK_PARAM_TYPES)[number];

export const WEBHOOK_TOOLS_MAX = 20;
const PARAMS_MAX = 20;
const HEADERS_MAX = 10;
const TIMEOUT_MS = 10_000;
/** Response bytes read, and characters handed to the model. */
const RESPONSE_MAX_BYTES = 64_000;
const RESULT_MAX_CHARS = 8_000;
/** Model ↔ tool round trips in one reply before the agent must answer. */
export const WEBHOOK_TOOL_MAX_ITERATIONS = 5;

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,47}$/;
/** System tools' names (see ./agent-tools); a webhook can't shadow one. */
const RESERVED_TOOL_NAMES = new Set(['end_conversation', 'transfer_to_human']);
const HEADER_NAME_RE = /^[A-Za-z0-9-]{1,64}$/;
/** Headers the request sets itself, or that would let a tool spoof its origin. */
const RESERVED_HEADERS = new Set(['host', 'content-length', 'content-type', 'connection', 'transfer-encoding', 'cookie']);

export interface WebhookParam {
    name: string;
    type: WebhookParamType;
    description: string;
    required: boolean;
}

/** As stored: header values encrypted. */
export interface WebhookTool {
    name: string;
    description: string;
    method: WebhookMethod;
    url: string;
    headers: Array<{ name: string; value_encrypted: string }>;
    parameters: WebhookParam[];
}

/**
 * As the console sends it: a header either carries a new `value`, or `keep`
 * to reuse the stored value of the same name (the console never sees it).
 */
export interface WebhookToolInput {
    name?: unknown;
    /** The tool's name before this edit, so a rename keeps its saved headers. */
    previous_name?: unknown;
    description?: unknown;
    method?: unknown;
    url?: unknown;
    headers?: Array<{ name?: unknown; value?: unknown; keep?: unknown }>;
    parameters?: Array<{ name?: unknown; type?: unknown; description?: unknown; required?: unknown }>;
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** The stored list, defensively read (configs come from the API too). */
export function readWebhookTools(config: Record<string, unknown> | null | undefined): WebhookTool[] {
    const raw = config?.webhook_tools;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): WebhookTool[] => {
        const t = entry as Partial<WebhookTool> | null;
        if (!t || typeof t.name !== 'string' || !NAME_RE.test(t.name) || typeof t.url !== 'string') return [];
        return [{
            name: t.name,
            description: typeof t.description === 'string' ? t.description : '',
            method: WEBHOOK_METHODS.includes(t.method as WebhookMethod) ? t.method as WebhookMethod : 'POST',
            url: t.url,
            headers: Array.isArray(t.headers) ? t.headers.filter((h) => h && typeof h.name === 'string' && typeof h.value_encrypted === 'string') : [],
            parameters: Array.isArray(t.parameters)
                ? t.parameters.filter((p) => p && typeof p.name === 'string' && NAME_RE.test(p.name)).map((p) => ({
                    name: p.name,
                    type: WEBHOOK_PARAM_TYPES.includes(p.type) ? p.type : 'string',
                    description: typeof p.description === 'string' ? p.description : '',
                    required: p.required === true,
                }))
                : [],
        }];
    });
}

/** What the console may see: everything but header values. */
export function publicWebhookTools(tools: WebhookTool[]) {
    return tools.map(({ headers, ...rest }) => ({ ...rest, headers: headers.map((h) => ({ name: h.name })) }));
}

/**
 * For anyone outside the project (public marketplace): what each tool is
 * for, not where it points. Endpoints can be private and aren't theirs.
 */
export function withoutWebhookEndpoints(config: Record<string, unknown>): Record<string, unknown> {
    const out = { ...config };
    if (Array.isArray(config.webhook_tools)) out.webhook_tools = readWebhookTools(config).map((t) => ({ name: t.name, description: t.description }));
    const system = config.system_tools as { transfer_to_human?: unknown } | undefined;
    if (system && typeof system === 'object' && system.transfer_to_human) out.system_tools = { ...system, transfer_to_human: { enabled: true } };
    // MCP servers and connected apps: which tools the agent has, not where they live or their keys.
    for (const key of ['mcp_servers', 'integrations'] as const) {
        if (!Array.isArray(config[key])) continue;
        out[key] = (config[key] as Array<{ name?: unknown; enabled?: unknown }>).map((server) => ({
            name: typeof server?.name === 'string' ? server.name : 'MCP server',
            tools: Array.isArray(server?.enabled) ? server.enabled.filter((n) => typeof n === 'string') : [],
        }));
    }
    return out;
}

/** A fork is someone else's copy: tools that call the original owner's endpoints (webhooks, MCP servers, the hand-off) don't come with it. */
export function withoutWebhookTools(config: Record<string, unknown>): Record<string, unknown> {
    // MCP servers are the owner's too: their URL and key don't travel either.
    // Connected apps use the original project's accounts, so they stay behind too.
    const { webhook_tools: _dropped, mcp_servers: _servers, integrations: _apps, ...rest } = config;
    void _dropped;
    void _servers;
    void _apps;
    // The hand-off goes to the original owner's endpoint too; End conversation is harmless and stays.
    const system = rest.system_tools as Record<string, unknown> | undefined;
    if (system && typeof system === 'object' && 'transfer_to_human' in system) {
        const { transfer_to_human: _handoff, ...keep } = system;
        void _handoff;
        rest.system_tools = keep;
    }
    return rest;
}

/**
 * Validate the console's list and produce the stored form, encrypting new
 * header values and carrying kept ones over from `existing`.
 */
export function buildWebhookTools(
    input: unknown,
    existing: WebhookTool[],
    organizationId: string,
): { ok: true; tools: WebhookTool[] } | { ok: false; message: string } {
    if (!Array.isArray(input)) return { ok: false, message: 'Send tools as a list.' };
    if (input.length > WEBHOOK_TOOLS_MAX) return { ok: false, message: `Add up to ${WEBHOOK_TOOLS_MAX} tools.` };
    const names = new Set<string>();
    const tools: WebhookTool[] = [];
    for (const raw of input as WebhookToolInput[]) {
        const name = text(raw?.name, 48);
        if (!NAME_RE.test(name)) return { ok: false, message: `"${name || 'Unnamed'}" isn't a valid tool name. Use letters, numbers and underscores, starting with a letter.` };
        if (names.has(name.toLowerCase())) return { ok: false, message: `Two tools are named "${name}".` };
        if (RESERVED_TOOL_NAMES.has(name.toLowerCase())) return { ok: false, message: `"${name}" is a system tool's name. Pick another.` };
        names.add(name.toLowerCase());
        const description = text(raw.description, 1000);
        if (!description) return { ok: false, message: `Describe what "${name}" does, so the agent knows when to use it.` };
        const method = text(raw.method, 10).toUpperCase() as WebhookMethod;
        if (!WEBHOOK_METHODS.includes(method)) return { ok: false, message: `"${name}" needs a method: ${WEBHOOK_METHODS.join(', ')}.` };
        const url = text(raw.url, 2000);
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            return { ok: false, message: `"${name}" needs a full URL, like https://api.example.com/book.` };
        }
        if (parsed.protocol !== 'https:') return { ok: false, message: `"${name}" must use an https:// URL.` };

        const previous = existing.find((t) => t.name === (text(raw.previous_name, 48) || name));
        const headers: WebhookTool['headers'] = [];
        for (const h of (Array.isArray(raw.headers) ? raw.headers : []).slice(0, HEADERS_MAX + 1)) {
            const headerName = text(h?.name, 64);
            if (!headerName) continue;
            if (!HEADER_NAME_RE.test(headerName) || RESERVED_HEADERS.has(headerName.toLowerCase())) {
                return { ok: false, message: `"${headerName}" can't be used as a header on "${name}".` };
            }
            if (h.keep === true) {
                const kept = previous?.headers.find((p) => p.name.toLowerCase() === headerName.toLowerCase());
                if (kept) headers.push({ name: headerName, value_encrypted: kept.value_encrypted });
                continue;
            }
            const value = typeof h.value === 'string' ? h.value.slice(0, 4000) : '';
            if (/[\r\n]/.test(value)) return { ok: false, message: `The ${headerName} header on "${name}" can't contain line breaks.` };
            headers.push({ name: headerName, value_encrypted: encryptApiKey(value, organizationId) });
        }
        if (headers.length > HEADERS_MAX) return { ok: false, message: `"${name}" can send up to ${HEADERS_MAX} headers.` };

        const params = Array.isArray(raw.parameters) ? raw.parameters : [];
        if (params.length > PARAMS_MAX) return { ok: false, message: `"${name}" can take up to ${PARAMS_MAX} inputs.` };
        const paramNames = new Set<string>();
        const parameters: WebhookParam[] = [];
        for (const p of params) {
            const paramName = text(p?.name, 48);
            if (!NAME_RE.test(paramName)) return { ok: false, message: `"${paramName || 'Unnamed'}" isn't a valid input name on "${name}".` };
            if (paramNames.has(paramName)) return { ok: false, message: `"${name}" has two inputs named "${paramName}".` };
            paramNames.add(paramName);
            const type = text(p.type, 10) as WebhookParamType;
            parameters.push({
                name: paramName,
                type: WEBHOOK_PARAM_TYPES.includes(type) ? type : 'string',
                description: text(p.description, 500),
                required: p.required === true,
            });
        }
        tools.push({ name, description, method, url: parsed.toString(), headers, parameters });
    }
    return { ok: true, tools };
}

/** The function tools the model sees. */
export function webhookToolDefinitions(tools: WebhookTool[]) {
    return tools.map((tool) => ({
        type: 'function' as const,
        function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                type: 'object',
                properties: Object.fromEntries(tool.parameters.map((p) => [p.name, { type: p.type, ...(p.description ? { description: p.description } : {}) }])),
                required: tool.parameters.filter((p) => p.required).map((p) => p.name),
            } as Record<string, unknown>,
        },
    }));
}

/**
 * Call the endpoint with the model's arguments: a query string for GET and
 * DELETE, a JSON body otherwise. Never throws; the outcome is text for the
 * model either way, so a failed call becomes something it can explain.
 */
export async function executeWebhookTool(
    tool: WebhookTool,
    argumentsJson: string,
    opts: { organizationId: string; signal?: AbortSignal },
): Promise<{ ok: boolean; output: string; status?: number }> {
    let args: Record<string, unknown>;
    try {
        const parsed = JSON.parse(argumentsJson || '{}') as unknown;
        args = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
        return { ok: false, output: `The arguments for ${tool.name} weren't valid JSON.` };
    }
    // Only declared inputs go out: the model can't add fields the owner didn't ask for.
    const declared = new Set(tool.parameters.map((p) => p.name));
    const sent = Object.fromEntries(Object.entries(args).filter(([key]) => declared.has(key)));
    const missing = tool.parameters.filter((p) => p.required && (sent[p.name] === undefined || sent[p.name] === null || sent[p.name] === ''));
    if (missing.length) return { ok: false, output: `${tool.name} needs: ${missing.map((p) => p.name).join(', ')}. Ask the user for it.` };

    const headers: Record<string, string> = { Accept: 'application/json, text/plain;q=0.9, */*;q=0.5', 'User-Agent': 'Cencori-Agent-Tools/1.0' };
    for (const h of tool.headers) {
        try {
            headers[h.name] = decryptApiKey(h.value_encrypted, opts.organizationId);
        } catch {
            return { ok: false, output: `${tool.name} isn't set up correctly (a saved header couldn't be read). Tell the user it's unavailable right now.` };
        }
    }

    const url = new URL(tool.url);
    let body: string | undefined;
    if (tool.method === 'GET' || tool.method === 'DELETE') {
        for (const [key, value] of Object.entries(sent)) url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(sent);
    }

    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    try {
        const response = await safeOutboundFetch(url, {
            method: tool.method,
            headers,
            body,
            signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
        });
        const result = (await readCapped(response)).slice(0, RESULT_MAX_CHARS) || '(empty response)';
        if (!response.ok) return { ok: false, status: response.status, output: `${tool.name} returned HTTP ${response.status}: ${result}` };
        return { ok: true, status: response.status, output: result };
    } catch (error) {
        const reason = error instanceof Error && error.name === 'TimeoutError'
            ? `didn't respond within ${TIMEOUT_MS / 1000} seconds`
            : error instanceof Error ? error.message : 'request failed';
        return { ok: false, output: `${tool.name} ${reason}.` };
    }
}

/** The start of the body, up to the cap: a long response is cut, not dropped. */
async function readCapped(response: Response): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let out = '';
    let bytes = 0;
    try {
        while (bytes < RESPONSE_MAX_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            out += decoder.decode(value, { stream: true });
        }
    } catch {
        // Keep what arrived.
    } finally {
        await reader.cancel().catch(() => undefined);
    }
    return out;
}
