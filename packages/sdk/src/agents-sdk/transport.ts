import { CencoriRunError } from './errors';

const DEFAULT_BASE_URL = 'https://cencori.com';

export interface TransportOptions {
    /** Secret project key (csk_...). Defaults to the CENCORI_API_KEY environment variable. */
    apiKey?: string;
    /** Defaults to CENCORI_BASE_URL, then https://cencori.com. */
    baseUrl?: string;
    /** Custom fetch (tests, proxies, edge runtimes). */
    fetch?: typeof fetch;
    signal?: AbortSignal;
}

/** One server-sent event from a session turn. */
export interface SessionStreamEvent {
    event: string;
    data: Record<string, unknown>;
}

/** A tool call the turn paused on. */
export interface PausedAction {
    action_id: string;
    tool: string;
    arguments: string;
    needs_approval?: boolean;
}

export interface TurnBody {
    input: string | ReadonlyArray<object>;
    model: string;
    instructions?: string;
    tools?: Array<Record<string, unknown>>;
    response_format?: Record<string, unknown>;
    temperature?: number;
    max_output_tokens?: number;
    memory?: Record<string, unknown>;
    user?: string;
    metadata?: Record<string, string>;
    reasoning_effort?: 'none' | 'low' | 'medium' | 'high';
    /** Give the model the built-in render_ui tool. */
    widgets?: boolean;
}

export interface ResumeNext {
    instructions?: string;
    model?: string;
    tools?: Array<Record<string, unknown>>;
    /** Turn metadata from here on (the agent's name, for the console trace). */
    metadata?: Record<string, string>;
}

function env(name: string): string | undefined {
    try {
        return typeof process !== 'undefined' ? process.env?.[name] : undefined;
    } catch {
        return undefined;
    }
}

export class Transport {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly fetchImpl: typeof fetch;
    private readonly signal?: AbortSignal;

    constructor(options: TransportOptions = {}) {
        const apiKey = options.apiKey ?? env('CENCORI_API_KEY');
        if (!apiKey) {
            throw new CencoriRunError('No Cencori API key. Pass apiKey or set CENCORI_API_KEY (a secret project key, csk_...).', { code: 'missing_api_key' });
        }
        this.apiKey = apiKey;
        this.baseUrl = (options.baseUrl ?? env('CENCORI_BASE_URL') ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
        this.fetchImpl = options.fetch ?? fetch;
        this.signal = options.signal;
    }

    private async post(path: string, body: unknown, sessionId?: string): Promise<Response> {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream, application/json',
            },
            body: JSON.stringify(body),
            signal: this.signal,
        });
        if (!response.ok) throw await errorFrom(response, sessionId);
        return response;
    }

    /**
     * Create a session and run its first turn in one request. Servers that
     * predate this answer with the plain session JSON; the turn then goes in a
     * second request, as before.
     */
    async createSessionWithTurn(metadata: Record<string, unknown>, body: TurnBody, agentId?: string): Promise<{ sessionId: string; response: Response }> {
        const turn = { ...body, stream: true, pause_on_tool_calls: true };
        const response = await this.fetchImpl(`${this.baseUrl}/v1/sessions`, {
            method: 'POST',
            headers: {
                'CENCORI_API_KEY': this.apiKey,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream, application/json',
            },
            body: JSON.stringify({ metadata, turn, ...(agentId ? { agent_id: agentId } : {}) }),
            signal: this.signal,
        });
        const headerId = response.headers.get('X-Cencori-Session-Id') ?? undefined;
        if (!response.ok) throw await errorFrom(response, headerId);
        if (headerId) return { sessionId: headerId, response };
        const created = await response.json() as { id?: string };
        if (!created.id) throw new CencoriRunError('Cencori did not return a session id.');
        return { sessionId: created.id, response: await this.turn(created.id, body) };
    }

    turn(sessionId: string, body: TurnBody): Promise<Response> {
        return this.post(`/v1/sessions/${encodeURIComponent(sessionId)}/turns`, {
            ...body,
            stream: true,
            pause_on_tool_calls: true,
        }, sessionId);
    }

    /** Cencori Web: search or read pages (POST /api/v1/web/search | extract). */
    async web(endpoint: 'search' | 'extract', body: Record<string, unknown>): Promise<unknown> {
        const response = await this.post(`/api/v1/web/${endpoint}`, body);
        return response.json();
    }

    /** Human handoff: hand over, reply as a person, or release (POST /v1/sessions/:id/human). */
    async human(sessionId: string, body: { action: 'handoff' | 'reply' | 'release'; reason?: string; text?: string }): Promise<unknown> {
        const response = await this.post(`/v1/sessions/${encodeURIComponent(sessionId)}/human`, body, sessionId);
        return response.json();
    }

    async humanStatus(sessionId: string, after?: string): Promise<unknown> {
        const query = after ? `?after=${encodeURIComponent(after)}` : '';
        const response = await this.fetchImpl(`${this.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/human${query}`, {
            headers: { 'CENCORI_API_KEY': this.apiKey, 'Accept': 'application/json' },
            signal: this.signal,
        });
        if (!response.ok) throw await errorFrom(response, sessionId);
        return response.json();
    }

    resume(sessionId: string, actionId: string, toolResults: Array<{ action_id: string; output: string }>, next?: ResumeNext): Promise<Response> {
        return this.post(`/v1/sessions/${encodeURIComponent(sessionId)}/approve`, {
            action_id: actionId,
            tool_results: toolResults,
            ...(next ? { next } : {}),
        }, sessionId);
    }
}

async function errorFrom(response: Response, sessionId?: string): Promise<CencoriRunError> {
    let message = `Cencori returned ${response.status}`;
    let code: string | undefined;
    try {
        const body = await response.json() as { error?: { message?: string; code?: string } | string };
        if (typeof body.error === 'string') message = body.error;
        else if (body.error?.message) {
            message = body.error.message;
            code = body.error.code;
        }
    } catch {
        /* not JSON */
    }
    return new CencoriRunError(message, { status: response.status, code, sessionId });
}

/** Parse a session turn's SSE stream into events. */
export async function* readSessionEvents(response: Response): AsyncGenerator<SessionStreamEvent> {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let event = 'message';
    let data: string[] = [];

    const flush = (): SessionStreamEvent | null => {
        if (data.length === 0) {
            event = 'message';
            return null;
        }
        const raw = data.join('\n');
        data = [];
        const name = event;
        event = 'message';
        try {
            return { event: name, data: JSON.parse(raw) as Record<string, unknown> };
        } catch {
            return { event: name, data: { raw } };
        }
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let newline: number;
            while ((newline = buffer.indexOf('\n')) >= 0) {
                const line = buffer.slice(0, newline).replace(/\r$/, '');
                buffer = buffer.slice(newline + 1);
                if (line === '') {
                    const parsed = flush();
                    if (parsed) yield parsed;
                } else if (line.startsWith('event:')) {
                    event = line.slice(6).trim();
                } else if (line.startsWith('data:')) {
                    data.push(line.slice(5).replace(/^ /, ''));
                }
            }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
            for (const line of buffer.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
            }
        }
        const last = flush();
        if (last) yield last;
    } finally {
        reader.releaseLock();
    }
}
