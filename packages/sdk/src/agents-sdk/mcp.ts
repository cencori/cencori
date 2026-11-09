/**
 * MCP servers as agent tools.
 *
 * ```ts
 * const linear = new MCPServerStreamableHttp({ url: 'https://mcp.linear.app/mcp', headers: { Authorization: `Bearer ${token}` } });
 * const files = new MCPServerStdio({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', './docs'] });
 * const agent = new Agent({ name: 'Ops', mcpServers: [linear, files] });
 * ```
 *
 * Servers connect from your process, like your other tools: their
 * credentials never reach Cencori. Their tools join the agent's own, with the
 * same argument checks, approvals and traces.
 */

import { AgentsError } from './errors';
import type { JsonSchema } from './schema';

/** Stateless MCP (header-routed, no handshake). */
const MODERN_PROTOCOL = '2026-07-28';
/** The handshake era, for servers that predate it. */
const LEGACY_PROTOCOL = '2025-11-25';
const CLIENT_INFO = { name: 'cencori-agents', version: '1' };

export interface MCPTool {
    name: string;
    description?: string;
    inputSchema?: JsonSchema;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export interface MCPServerOptions {
    /** A name for traces and to keep tool names apart between servers. Default from the URL or command. */
    name?: string;
    /** Only these tools (by their MCP name). Default: all. */
    allowedTools?: string[];
    /**
     * Ask a person before calling: true for every tool, a list of tool names,
     * or a function. Tools marked destructive by the server always ask unless
     * this is false.
     */
    requireApproval?: boolean | string[] | ((tool: MCPTool) => boolean);
    /** Keep the tools list after the first fetch (default true). */
    cacheToolsList?: boolean;
    /** Per request, in ms. Default 30000. */
    timeoutMs?: number;
}

/** What an agent needs from an MCP server. */
export interface MCPServer {
    readonly name: string;
    readonly options: MCPServerOptions;
    connect(): Promise<void>;
    listTools(): Promise<MCPTool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult>;
    close(): Promise<void>;
}

export interface MCPCallResult {
    content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
    structuredContent?: unknown;
    isError?: boolean;
}

type JsonRpcResponse = { id?: number | string; result?: unknown; error?: { code?: number; message?: string } };

class RpcError extends Error {
    constructor(message: string, readonly code?: number, readonly httpStatus?: number) {
        super(message);
    }
}

let nextId = 1;

// ── Streamable HTTP ─────────────────────────────────────────────

export interface MCPServerStreamableHttpOptions extends MCPServerOptions {
    url: string;
    /** Sent on every request: auth goes here. */
    headers?: Record<string, string>;
    fetch?: typeof fetch;
}

/** A remote MCP server over Streamable HTTP. Speaks stateless MCP, and falls back to the session handshake for older servers. */
export class MCPServerStreamableHttp implements MCPServer {
    readonly name: string;
    readonly options: MCPServerStreamableHttpOptions;
    private mode: 'modern' | 'legacy' | null = null;
    private sessionHeaders: Record<string, string> | null = null;
    private tools: MCPTool[] | null = null;

    constructor(options: MCPServerStreamableHttpOptions) {
        if (!options?.url) throw new TypeError('MCPServerStreamableHttp needs a url.');
        this.options = options;
        this.name = options.name ?? safeHost(options.url);
    }

    async connect(): Promise<void> {
        await this.listTools();
    }

    async listTools(): Promise<MCPTool[]> {
        if (this.tools && this.options.cacheToolsList !== false) return this.tools;
        const result = await this.request('tools/list', {}) as { tools?: MCPTool[] };
        this.tools = Array.isArray(result?.tools) ? result.tools : [];
        return this.tools;
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
        return await this.request('tools/call', { name, arguments: args }, name) as MCPCallResult;
    }

    async close(): Promise<void> {
        const session = this.sessionHeaders?.['mcp-session-id'];
        this.mode = null;
        this.sessionHeaders = null;
        if (session) {
            await (this.options.fetch ?? fetch)(this.options.url, { method: 'DELETE', headers: { ...this.options.headers, 'mcp-session-id': session } }).catch(() => {});
        }
    }

    private async request(method: string, params: Record<string, unknown>, toolName?: string): Promise<unknown> {
        if (this.mode !== 'legacy') {
            try {
                const result = await this.post(
                    { ...this.options.headers, 'MCP-Protocol-Version': MODERN_PROTOCOL, 'Mcp-Method': method, ...(toolName ? { 'Mcp-Name': toolName } : {}) },
                    method,
                    { ...params, _meta: { 'io.modelcontextprotocol/clientInfo': CLIENT_INFO } },
                );
                this.mode = 'modern';
                return result.result;
            } catch (error) {
                if (this.mode === 'modern' || !legacyOnly(error)) throw error;
            }
        }
        if (!this.sessionHeaders) await this.handshake();
        try {
            return (await this.post(this.sessionHeaders!, method, params)).result;
        } catch (error) {
            // An expired session: start a new one once.
            if (error instanceof RpcError && error.httpStatus === 404) {
                await this.handshake();
                return (await this.post(this.sessionHeaders!, method, params)).result;
            }
            throw error;
        }
    }

    private async handshake(): Promise<void> {
        const base = { ...this.options.headers };
        const { result, headers } = await this.post(base, 'initialize', { protocolVersion: LEGACY_PROTOCOL, capabilities: {}, clientInfo: CLIENT_INFO });
        const info = (result ?? {}) as { protocolVersion?: string; sessionId?: string };
        const session = headers.get('mcp-session-id') ?? info.sessionId;
        this.sessionHeaders = { ...base, 'MCP-Protocol-Version': info.protocolVersion ?? LEGACY_PROTOCOL, ...(session ? { 'mcp-session-id': session } : {}) };
        this.mode = 'legacy';
        await this.post(this.sessionHeaders, 'notifications/initialized', {}, true).catch(() => {});
    }

    private async post(headers: Record<string, string>, method: string, params: Record<string, unknown>, notification = false): Promise<{ result: unknown; headers: Headers }> {
        const id = nextId++;
        const res = await (this.options.fetch ?? fetch)(this.options.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
            body: JSON.stringify(notification ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(this.options.timeoutMs ?? 30_000),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new RpcError(`MCP ${method} failed (${res.status}): ${text.slice(0, 300)}`, undefined, res.status);
        }
        if (notification || res.status === 202) return { result: undefined, headers: res.headers };
        const text = await res.text();
        const message = (res.headers.get('content-type') ?? '').includes('text/event-stream') ? fromEventStream(text, id) : JSON.parse(text) as JsonRpcResponse;
        if (message.error) throw new RpcError(`MCP ${method}: ${message.error.message ?? 'error'}`, message.error.code);
        return { result: message.result, headers: res.headers };
    }
}

/** The JSON-RPC response for `id` in an SSE body (servers may send notifications first). */
function fromEventStream(text: string, id: number): JsonRpcResponse {
    let fallback: JsonRpcResponse | null = null;
    for (const block of text.split(/\r?\n\r?\n/)) {
        const data = block.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
        if (!data) continue;
        try {
            const message = JSON.parse(data) as JsonRpcResponse;
            if (message.id === id) return message;
            if ('result' in message || 'error' in message) fallback ??= message;
        } catch { /* not JSON */ }
    }
    if (fallback) return fallback;
    throw new RpcError('MCP response stream carried no result');
}

/** A failure that means "this server predates stateless MCP". Auth walls and server errors aren't. */
function legacyOnly(error: unknown): boolean {
    if (!(error instanceof RpcError)) return false;
    if (error.httpStatus && [400, 404, 405, 501].includes(error.httpStatus)) return true;
    return error.code === -32601 || error.code === -32600 || error.code === -32022;
}

function safeHost(url: string): string {
    try { return new URL(url).hostname.split('.').slice(-2, -1)[0] || 'mcp'; } catch { return 'mcp'; }
}

// ── stdio ───────────────────────────────────────────────────────

export interface MCPServerStdioOptions extends MCPServerOptions {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
}

/** A local MCP server started as a process (Node only). */
export class MCPServerStdio implements MCPServer {
    readonly name: string;
    readonly options: MCPServerStdioOptions;
    private child: { stdin: { write(s: string): void; end(): void }; kill(): void } | null = null;
    private starting: Promise<void> | null = null;
    private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    private tools: MCPTool[] | null = null;
    private stderr = '';

    constructor(options: MCPServerStdioOptions) {
        if (!options?.command) throw new TypeError('MCPServerStdio needs a command.');
        this.options = options;
        this.name = options.name ?? (options.args?.find((a) => !a.startsWith('-')) ?? options.command).split('/').pop()!.replace(/^@[^/]*\//, '');
    }

    connect(): Promise<void> {
        this.starting ??= this.start();
        return this.starting;
    }

    async listTools(): Promise<MCPTool[]> {
        if (this.tools && this.options.cacheToolsList !== false) return this.tools;
        await this.connect();
        const result = await this.request('tools/list', {}) as { tools?: MCPTool[] };
        this.tools = Array.isArray(result?.tools) ? result.tools : [];
        return this.tools;
    }

    async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
        await this.connect();
        return await this.request('tools/call', { name, arguments: args }) as MCPCallResult;
    }

    async close(): Promise<void> {
        for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new AgentsError(`MCP server ${this.name} closed.`)); }
        this.pending.clear();
        try { this.child?.stdin.end(); this.child?.kill(); } catch { /* gone */ }
        this.child = null;
        this.starting = null;
    }

    private async start(): Promise<void> {
        let spawn: typeof import('node:child_process').spawn;
        try {
            ({ spawn } = await import('node:child_process'));
        } catch {
            throw new AgentsError('MCPServerStdio needs Node.js. In other runtimes use MCPServerStreamableHttp.');
        }
        const child = spawn(this.options.command, this.options.args ?? [], {
            cwd: this.options.cwd,
            env: { ...process.env, ...this.options.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.child = child;
        let buffer = '';
        child.stdout!.setEncoding('utf8');
        child.stdout!.on('data', (chunk: string) => {
            buffer += chunk;
            let nl: number;
            while ((nl = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, nl).trim();
                buffer = buffer.slice(nl + 1);
                if (!line) continue;
                try {
                    const message = JSON.parse(line) as JsonRpcResponse;
                    const waiter = typeof message.id === 'number' ? this.pending.get(message.id) : undefined;
                    if (!waiter) continue;
                    clearTimeout(waiter.timer);
                    this.pending.delete(message.id as number);
                    if (message.error) waiter.reject(new AgentsError(`MCP ${this.name}: ${message.error.message ?? 'error'}`));
                    else waiter.resolve(message.result);
                } catch { /* a log line on stdout */ }
            }
        });
        child.stderr!.setEncoding('utf8');
        child.stderr!.on('data', (chunk: string) => { this.stderr = (this.stderr + chunk).slice(-2000); });
        const failAll = (why: string) => {
            for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new AgentsError(why)); }
            this.pending.clear();
            this.child = null;
            this.starting = null;
        };
        child.on('error', (e: Error) => failAll(`MCP server ${this.name} didn't start: ${e.message}`));
        child.on('exit', (code: number | null) => failAll(`MCP server ${this.name} exited (${code ?? 'signal'})${this.stderr ? `: ${this.stderr.trim().slice(-300)}` : ''}`));

        await this.request('initialize', { protocolVersion: LEGACY_PROTOCOL, capabilities: {}, clientInfo: CLIENT_INFO });
        this.child?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
    }

    private request(method: string, params: Record<string, unknown>): Promise<unknown> {
        const child = this.child;
        if (!child) return Promise.reject(new AgentsError(`MCP server ${this.name} isn't running.`));
        const id = nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new AgentsError(`MCP ${this.name} ${method} timed out.`));
            }, this.options.timeoutMs ?? 30_000);
            this.pending.set(id, { resolve, reject, timer });
            child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
        });
    }
}

// ── As agent tools ──────────────────────────────────────────────

/** What the model reads from an MCP tool result. */
export function mcpResultText(result: MCPCallResult): string {
    if (result?.structuredContent !== undefined && !(result.content ?? []).some((c) => c.type === 'text')) {
        return JSON.stringify(result.structuredContent);
    }
    const parts = (result?.content ?? []).map((c) => {
        if (c.type === 'text' && typeof c.text === 'string') return c.text;
        if (c.type === 'resource' && c.resource && typeof (c.resource as { text?: unknown }).text === 'string') return (c.resource as { text: string }).text;
        return `[${c.type} content]`;
    });
    const text = parts.join('\n') || (result?.structuredContent !== undefined ? JSON.stringify(result.structuredContent) : '');
    return result?.isError ? `Error: ${text || 'the tool failed.'}` : text;
}

export function mcpNeedsApproval(server: MCPServer, tool: MCPTool): boolean {
    const rule = server.options.requireApproval;
    if (rule === false) return false;
    if (rule === true) return true;
    if (Array.isArray(rule)) return rule.includes(tool.name);
    if (typeof rule === 'function') return rule(tool);
    return tool.annotations?.destructiveHint === true;
}
