import type { Agent } from './agent';
import { AgentsError, GuardrailTripwireTriggered } from './errors';
import { run, RunState, type RunOptions, type StreamedRunResult } from './run';
import {
    encodeAgentChatEvent,
    formatWidgetAction,
    type AgentChatEvent,
    type AgentChatRequest,
} from '../agent-chat/protocol';

/**
 * Agent UI on your backend: serve an agent to <AgentChat> from your own route. Your tools run here,
 * with your database and secrets; the browser only sees the conversation.
 *
 * ```ts
 * // app/api/chat/route.ts
 * import { Agent, createAgentChatHandler } from 'cencori/agents';
 *
 * const support = new Agent({ name: 'Support', instructions: '...', tools: [lookupOrder], widgets: true });
 * export const POST = createAgentChatHandler(support, {
 *     context: async (req) => ({ userId: await userIdFrom(req) }),
 * });
 *
 * // In the page: <AgentChat api="/api/chat" />
 * ```
 *
 * Approvals: when a tool needs one, the chat gets the paused run's state,
 * signed, and sends it back with the user's decisions. The signature (HMAC
 * with your secret key, or `secret`) means a browser can't alter what runs.
 */
export interface AgentChatHandlerOptions<Ctx> extends Omit<RunOptions<Ctx>, 'context' | 'sessionId' | 'stream' | 'signal' | 'user'> {
    /** Your context for this request (who the user is, their permissions...). */
    context?: (req: Request) => Ctx | Promise<Ctx>;
    /** A stable id for the end user, for Cencori's per-user analytics and limits. */
    user?: (req: Request) => string | undefined | Promise<string | undefined>;
    /**
     * May this request continue this session? Check it belongs to the user.
     * Without it, any session id the browser sends is continued.
     */
    authorizeSession?: (sessionId: string, req: Request) => boolean | Promise<boolean>;
    /** Signs paused-run state. Default: CENCORI_AGENT_CHAT_SECRET, then your API key. */
    secret?: string;
}

const MAX_MESSAGE = 32_000;

export function createAgentChatHandler<Ctx>(agent: Agent<Ctx, any>, options: AgentChatHandlerOptions<Ctx> = {}): (req: Request) => Promise<Response> {
    const { context, user, authorizeSession, secret, ...runOptions } = options;
    return async (req: Request) => {
        let body: AgentChatRequest;
        try {
            body = (await req.json()) as AgentChatRequest;
        } catch {
            return json(400, 'The request body must be JSON.');
        }
        const signingKey = secret ?? env('CENCORI_AGENT_CHAT_SECRET') ?? runOptions.apiKey ?? env('CENCORI_API_KEY');
        if (!signingKey) return json(500, 'Set CENCORI_API_KEY (or pass secret) to serve an agent chat.');

        let input: string | RunState;
        let sessionId: string | undefined;
        if (body.approval) {
            const verified = await verifyState(body.approval.state, signingKey);
            if (!verified) return json(400, 'The approval state is not valid.');
            const state = RunState.fromJSON(verified);
            for (const [callId, decision] of Object.entries(body.approval.decisions ?? {})) {
                if (decision?.approved) state.approve(callId);
                else state.reject(callId, { message: typeof decision?.message === 'string' ? decision.message.slice(0, 500) : undefined });
            }
            input = state;
            sessionId = state.sessionId;
        } else {
            const text = typeof body.message === 'string' && body.message.trim()
                ? body.message
                : body.action && typeof body.action.type === 'string' ? formatWidgetAction(body.action) : '';
            if (!text) return json(400, 'Send a message, an action or an approval.');
            if (text.length > MAX_MESSAGE) return json(413, 'The message is too long.');
            input = text;
            sessionId = typeof body.sessionId === 'string' && body.sessionId ? body.sessionId : undefined;
        }
        if (sessionId && authorizeSession && !(await authorizeSession(sessionId, req))) {
            return json(403, 'This conversation belongs to someone else.');
        }

        const streamed = run(agent, input, {
            ...runOptions,
            stream: true,
            ...(sessionId && typeof input === 'string' ? { sessionId } : {}),
            context: context ? await context(req) : undefined,
            user: user ? await user(req) : undefined,
            signal: req.signal,
        } as RunOptions<Ctx> & { stream: true });

        return new Response(toAgentChatStream(streamed, { secret: signingKey }), {
            headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
        });
    };
}

/** A streamed run as the agent chat event stream (for your own route handler). */
export function toAgentChatStream(streamed: StreamedRunResult<unknown>, options: { secret: string }): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        async start(controller) {
            const send = (e: AgentChatEvent) => controller.enqueue(encoder.encode(encodeAgentChatEvent(e)));
            try {
                for await (const e of streamed) {
                    switch (e.type) {
                        case 'agent_updated': send({ event: 'agent', data: { name: e.agent.name } }); break;
                        case 'text_delta': send({ event: 'text', data: { delta: e.delta, agent: e.agentName } }); break;
                        case 'tool_call': send({ event: 'tool_call', data: { callId: e.callId, name: e.toolName, arguments: e.arguments, agent: e.agentName } }); break;
                        case 'tool_output': send({ event: 'tool_output', data: { callId: e.callId, name: e.toolName, output: e.output, agent: e.agentName } }); break;
                        case 'widget': send({ event: 'widget', data: { id: e.widgetId, callId: e.callId, widget: e.widget, agent: e.agentName } }); break;
                        case 'widget_partial': send({ event: 'widget_partial', data: { callId: e.callId, widget: e.widget, agent: e.agentName } }); break;
                        case 'handoff': send({ event: 'handoff', data: { from: e.from, to: e.to } }); break;
                        case 'interruption': break; // sent below, with the state
                    }
                }
                const result = await streamed.completed;
                if (result.state) {
                    send({
                        event: 'approval',
                        data: {
                            sessionId: result.sessionId,
                            state: await signState(JSON.stringify(result.state), options.secret),
                            items: result.interruptions.map((i) => ({ callId: i.callId, toolName: i.toolName, arguments: i.arguments, agentName: i.agentName })),
                        },
                    });
                } else {
                    send({ event: 'done', data: { sessionId: result.sessionId } });
                }
            } catch (error) {
                const message = error instanceof GuardrailTripwireTriggered
                    ? 'That request was blocked.'
                    : error instanceof Error ? error.message : 'The agent failed.';
                const code = (error as { code?: string })?.code ?? (error instanceof AgentsError ? error.name : undefined);
                send({ event: 'error', data: { message, ...(code ? { code } : {}) } });
            } finally {
                controller.close();
            }
        },
    });
}

// ── Signed state ────────────────────────────────────────────────

const b64url = (bytes: Uint8Array) => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function hmac(data: string, secret: string): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`cencori-agent-chat:${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data)));
}

export async function signState(json: string, secret: string): Promise<string> {
    const payload = b64url(new TextEncoder().encode(json));
    return `${payload}.${b64url(await hmac(payload, secret))}`;
}

export async function verifyState(token: unknown, secret: string): Promise<string | null> {
    if (typeof token !== 'string' || token.length > 512_000) return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = await hmac(payload, secret);
    let given: Uint8Array;
    try { given = fromB64url(signature); } catch { return null; }
    if (given.length !== expected.length) return null;
    let diff = 0;
    for (let i = 0; i < given.length; i++) diff |= given[i] ^ expected[i];
    if (diff !== 0) return null;
    try { return new TextDecoder().decode(fromB64url(payload)); } catch { return null; }
}

function json(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: { message } }), { status, headers: { 'Content-Type': 'application/json' } });
}

function env(name: string): string | undefined {
    try {
        return typeof process !== 'undefined' ? process.env?.[name] : undefined;
    } catch {
        return undefined;
    }
}
