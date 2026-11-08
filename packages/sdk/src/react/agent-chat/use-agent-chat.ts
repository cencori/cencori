'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readEventStream, type AgentChatApprovalItem, type AgentChatDecision, type AgentChatRequest } from '../../agent-chat/protocol';
import type { WidgetAction, WidgetNode } from '../../widgets/spec';

/**
 * useAgentChat: the state of a chat with an agent, without any UI. <AgentChat>
 * is built on it; use it directly to draw your own.
 *
 * ```tsx
 * const chat = useAgentChat({ api: '/api/chat' });
 * chat.send('Show me revenue by month');
 * chat.messages // [{ role: 'user', parts: [...] }, { role: 'assistant', parts: [text, widget, ...] }]
 * ```
 *
 * `api` is your route serving the agent (cencori/agents' createAgentChatHandler),
 * so your tools run on your server.
 */

export type AgentChatPart =
    | { type: 'text'; text: string }
    | { type: 'tool'; callId: string; name: string; arguments: string; output?: string; status: 'running' | 'done' }
    | { type: 'widget'; id: string; widget: WidgetNode }
    | { type: 'handoff'; from: string; to: string }
    | { type: 'approval'; items: AgentChatApprovalItem[]; decisions: Record<string, AgentChatDecision>; state: string; status: 'pending' | 'submitted' };

export interface AgentChatMessage {
    id: string;
    role: 'user' | 'assistant';
    parts: AgentChatPart[];
    /** The agent that answered (after any handoffs). */
    agent?: string;
    /** A user message that was a widget action rather than typed text. */
    action?: WidgetAction & { label?: string };
    status?: 'streaming' | 'done' | 'error';
}

export type AgentChatStatus = 'idle' | 'streaming' | 'awaiting_approval' | 'error';

/** Where the action came from, for onAction. */
export interface WidgetActionContext {
    widgetId: string;
    label?: string;
}

export interface UseAgentChatOptions {
    /** Your route serving the agent, e.g. "/api/chat". */
    api: string;
    /** Extra headers on every request (auth, CSRF...). */
    headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
    /** Extra fields merged into every request body. */
    body?: Record<string, unknown>;
    /** Continue an existing conversation. */
    sessionId?: string;
    initialMessages?: AgentChatMessage[];
    fetch?: typeof fetch;
    /**
     * Called for every widget action. For `handler: "client"` actions it's the
     * only thing that happens; for agent actions return false to stop the
     * action going to the agent.
     */
    onAction?: (action: WidgetAction, context: WidgetActionContext) => void | boolean | Promise<void | boolean>;
    onError?: (error: Error) => void;
    /** Called with the session id once the server assigns one. */
    onSessionId?: (sessionId: string) => void;
}

export interface UseAgentChatResult {
    messages: AgentChatMessage[];
    status: AgentChatStatus;
    error: Error | null;
    sessionId: string | undefined;
    /** Send a message. Ignored while a reply is streaming. */
    send: (text: string) => Promise<void>;
    /** Run a widget action (what a widget's buttons and forms call). */
    sendAction: (action: WidgetAction, context: WidgetActionContext) => Promise<void>;
    /** Decide a pending tool call. Once every pending call is decided, the run continues. */
    approve: (callId: string) => void;
    reject: (callId: string, message?: string) => void;
    /** Stop the reply that's streaming. */
    stop: () => void;
    /** Start a new conversation. */
    reset: () => void;
    /** The last request failed: try it again. */
    retry: () => Promise<void>;
}

let counter = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export function useAgentChat(options: UseAgentChatOptions): UseAgentChatResult {
    const [messages, setMessages] = useState<AgentChatMessage[]>(options.initialMessages ?? []);
    const [status, setStatus] = useState<AgentChatStatus>('idle');
    const [error, setError] = useState<Error | null>(null);
    const [sessionId, setSessionId] = useState<string | undefined>(options.sessionId);

    // Latest values for callbacks that outlive a render.
    const opts = useRef(options);
    opts.current = options;
    const sessionRef = useRef(sessionId);
    sessionRef.current = sessionId;
    const busy = useRef(false);
    const abort = useRef<AbortController | null>(null);
    const lastRequest = useRef<AgentChatRequest | null>(null);

    useEffect(() => () => abort.current?.abort(), []);

    /** Update the assistant message being streamed. */
    const patch = useCallback((id: string, fn: (m: AgentChatMessage) => AgentChatMessage) => {
        setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    }, []);

    const request = useCallback(async (payload: AgentChatRequest, assistantId: string) => {
        busy.current = true;
        lastRequest.current = payload;
        setStatus('streaming');
        setError(null);
        const controller = new AbortController();
        abort.current = controller;
        let ended: 'done' | 'approval' | 'error' | null = null;

        const pushPart = (part: AgentChatPart) => patch(assistantId, (m) => ({ ...m, parts: [...m.parts, part] }));

        try {
            const o = opts.current;
            const extra = typeof o.headers === 'function' ? await o.headers() : o.headers ?? {};
            const res = await (o.fetch ?? fetch)(o.api, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...extra },
                body: JSON.stringify({ ...o.body, ...payload, ...(sessionRef.current ? { sessionId: sessionRef.current } : {}) }),
                signal: controller.signal,
            });
            if (!res.ok || !res.body) {
                const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
                const message = typeof data.error === 'string' ? data.error : data.error?.message;
                throw new Error(message || `The chat request failed (${res.status}).`);
            }

            for await (const { event, data } of readEventStream(res.body)) {
                switch (event) {
                    case 'agent':
                        patch(assistantId, (m) => ({ ...m, agent: String(data.name ?? '') }));
                        break;
                    case 'text': {
                        const delta = String(data.delta ?? '');
                        if (!delta) break;
                        patch(assistantId, (m) => {
                            const parts = [...m.parts];
                            const last = parts[parts.length - 1];
                            if (last?.type === 'text') parts[parts.length - 1] = { ...last, text: last.text + delta };
                            else parts.push({ type: 'text', text: delta });
                            return { ...m, parts };
                        });
                        break;
                    }
                    case 'tool_call':
                        pushPart({ type: 'tool', callId: String(data.callId), name: String(data.name), arguments: String(data.arguments ?? ''), status: 'running' });
                        break;
                    case 'tool_output':
                        // After an approval the call was made in an earlier reply: update it there.
                        setMessages((prev) => prev.map((m) => (m.parts.some((p) => p.type === 'tool' && p.callId === data.callId)
                            ? { ...m, parts: m.parts.map((p) => (p.type === 'tool' && p.callId === data.callId ? { ...p, output: String(data.output ?? ''), status: 'done' } : p)) }
                            : m)));
                        break;
                    case 'widget':
                        if (data.widget && typeof data.widget === 'object') {
                            pushPart({ type: 'widget', id: String(data.id), widget: data.widget as WidgetNode });
                        }
                        break;
                    case 'handoff':
                        pushPart({ type: 'handoff', from: String(data.from), to: String(data.to) });
                        patch(assistantId, (m) => ({ ...m, agent: String(data.to) }));
                        break;
                    case 'approval':
                        ended = 'approval';
                        if (typeof data.sessionId === 'string') setSessionId(data.sessionId);
                        pushPart({ type: 'approval', items: (data.items as AgentChatApprovalItem[]) ?? [], decisions: {}, state: String(data.state), status: 'pending' });
                        break;
                    case 'done':
                        ended = 'done';
                        if (typeof data.sessionId === 'string') setSessionId(data.sessionId);
                        break;
                    case 'error':
                        throw new Error(String(data.message ?? 'The agent failed.'));
                }
            }
            if (!ended) throw new Error('The reply ended early.');
            patch(assistantId, (m) => ({ ...m, status: 'done' }));
            setStatus(ended === 'approval' ? 'awaiting_approval' : 'idle');
        } catch (err) {
            if (controller.signal.aborted) {
                patch(assistantId, (m) => ({ ...m, status: 'done' }));
                setStatus('idle');
            } else {
                const e = err instanceof Error ? err : new Error(String(err));
                ended = 'error';
                patch(assistantId, (m) => ({ ...m, status: 'error' }));
                setError(e);
                setStatus('error');
                opts.current.onError?.(e);
            }
        } finally {
            busy.current = false;
            if (abort.current === controller) abort.current = null;
        }
    }, [patch]);

    // Tell the page the session id when it changes.
    useEffect(() => {
        if (sessionId) opts.current.onSessionId?.(sessionId);
    }, [sessionId]);

    const startTurn = useCallback(async (user: AgentChatMessage | null, payload: AgentChatRequest) => {
        if (busy.current) return;
        const assistant: AgentChatMessage = { id: uid('msg'), role: 'assistant', parts: [], status: 'streaming' };
        setMessages((prev) => [
            // Unanswered approvals are dropped once the user moves on.
            ...prev.map((m) => ({ ...m, parts: m.parts.filter((p) => !(p.type === 'approval' && p.status === 'pending')) })),
            ...(user ? [user] : []),
            assistant,
        ]);
        await request(payload, assistant.id);
    }, [request]);

    const send = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        await startTurn({ id: uid('msg'), role: 'user', parts: [{ type: 'text', text: trimmed }] }, { message: trimmed });
    }, [startTurn]);

    const sendAction = useCallback(async (action: WidgetAction, context: WidgetActionContext) => {
        const verdict = await opts.current.onAction?.(action, context);
        if (action.handler === 'client' || verdict === false) return;
        await startTurn(
            { id: uid('msg'), role: 'user', parts: [], action: { ...action, label: context.label } },
            { action: { ...action, widgetId: context.widgetId, label: context.label } },
        );
    }, [startTurn]);

    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const decide = useCallback((callId: string, decision: AgentChatDecision) => {
        const holder = messagesRef.current.find((m) => m.parts.some((p) => p.type === 'approval' && p.status === 'pending' && p.items.some((i) => i.callId === callId)));
        const part = holder?.parts.find((p): p is Extract<AgentChatPart, { type: 'approval' }> => p.type === 'approval' && p.status === 'pending' && p.items.some((i) => i.callId === callId));
        if (!holder || !part) return;
        const decisions = { ...part.decisions, [callId]: decision };
        const complete = part.items.every((i) => decisions[i.callId]);
        const updated: AgentChatPart = { ...part, decisions, status: complete ? 'submitted' : 'pending' };
        setMessages((prev) => prev.map((m) => (m.id === holder.id ? { ...m, parts: m.parts.map((p) => (p === part ? updated : p)) } : m)));
        // Once every call is decided, the run continues.
        if (complete) void startTurn(null, { approval: { state: part.state, decisions } });
    }, [startTurn]);

    const approve = useCallback((callId: string) => decide(callId, { approved: true }), [decide]);
    const reject = useCallback((callId: string, message?: string) => decide(callId, { approved: false, message }), [decide]);

    const stop = useCallback(() => abort.current?.abort(), []);

    const reset = useCallback(() => {
        abort.current?.abort();
        setMessages([]);
        setSessionId(undefined);
        setError(null);
        setStatus('idle');
    }, []);

    const retry = useCallback(async () => {
        const last = lastRequest.current;
        if (!last || busy.current) return;
        // Drop the failed reply and ask again.
        setMessages((prev) => (prev[prev.length - 1]?.status === 'error' ? prev.slice(0, -1) : prev));
        const assistant: AgentChatMessage = { id: uid('msg'), role: 'assistant', parts: [], status: 'streaming' };
        setMessages((prev) => [...prev, assistant]);
        await request(last, assistant.id);
    }, [request]);

    return { messages, status, error, sessionId, send, sendAction, approve, reject, stop, reset, retry };
}
