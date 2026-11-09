'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatWidgetAction, readEventStream, type AgentChatApprovalItem, type AgentChatAttachment, type AgentChatDecision, type AgentChatHumanMessage, type AgentChatRequest } from '../../agent-chat/protocol';
import { downscaleImage, canDownscale } from '../vision/downscale';
import { partialRenderUiWidget } from '../../widgets/partial';
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
    /** `partial` while the agent is still writing it: drawn, but not usable yet. */
    | { type: 'widget'; id: string; widget: WidgetNode; callId?: string; partial?: boolean }
    | { type: 'handoff'; from: string; to: string }
    | { type: 'approval'; items: AgentChatApprovalItem[]; decisions: Record<string, AgentChatDecision>; state: string; status: 'pending' | 'submitted' }
    /** An image or file the user attached (`url` is a preview for images). */
    | { type: 'attachment'; kind: 'image' | 'file'; name: string; url?: string }
    /** A line about the conversation itself, e.g. it was handed to a person. */
    | { type: 'notice'; text: string };

export interface AgentChatMessage {
    id: string;
    role: 'user' | 'assistant';
    parts: AgentChatPart[];
    /** The agent that answered (after any handoffs). */
    agent?: string;
    /** A user message that was a widget action rather than typed text. */
    action?: WidgetAction & { label?: string };
    /** Who wrote an assistant message: the agent, or a person on the team (human handoff). */
    author?: 'agent' | 'human';
    status?: 'streaming' | 'done' | 'error';
}

export type AgentChatStatus = 'idle' | 'streaming' | 'awaiting_approval' | 'error';

/** Where the action came from, for onAction. */
export interface WidgetActionContext {
    widgetId: string;
    label?: string;
}

export interface UseAgentChatOptions {
    /**
     * Your route serving the agent, e.g. "/api/chat" (createAgentChatHandler).
     * Your tools run on your server. Or leave it out and pass `agent` and
     * `publishableKey` to talk to a stored agent with no backend.
     */
    api?: string;
    /** A stored agent's id (POST /v1/agents): chat with it straight from the browser. */
    agent?: string;
    /** A publishable key (cpk_) whose allowed domains include this site. Used with `agent`. */
    publishableKey?: string;
    /**
     * An agent built in the Cencori console: its website key (cwk_...), from the
     * agent's Website page. Works on the sites allowed there; conversations show
     * in the agent's inbox like website chats.
     */
    widgetKey?: string;
    /** Cencori's base URL for `agent` and `widgetKey` modes. Default https://cencori.com. */
    baseUrl?: string;
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
    /** Send a message, optionally with images and files (PDF, text). Ignored while a reply is streaming. */
    send: (text: string, files?: File[]) => Promise<void>;
    /** A person on the team is handling the conversation (the agent handed it over). */
    withHuman: boolean;
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
    const [withHuman, setWithHuman] = useState(false);
    const humanSince = useRef<string | null>(null);

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
        let keptForHuman = false;

        const pushPart = (part: AgentChatPart) => patch(assistantId, (m) => ({ ...m, parts: [...m.parts, part] }));

        try {
            const o = opts.current;
            const extra = typeof o.headers === 'function' ? await o.headers() : o.headers ?? {};
            const direct = !o.api;
            let res: Response;
            if (direct && o.widgetKey) {
                // A console agent, through its website widget: a short-lived token per conversation.
                if (payload.approval) throw new Error('This agent needs approvals: serve it from your backend with `api`.');
                const input = turnInput(payload);
                const base = (o.baseUrl ?? 'https://cencori.com').replace(/\/$/, '');
                const grant = await widgetGrant(o.fetch ?? fetch, base, o.widgetKey, sessionRef.current, controller.signal);
                if (grant.sessionId !== sessionRef.current) setSessionId(grant.sessionId);
                res = await (o.fetch ?? fetch)(`${base}/v1/sessions/${encodeURIComponent(grant.sessionId)}/turns`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${grant.token}` },
                    body: JSON.stringify({ input, stream: true, widgets: true }),
                    signal: controller.signal,
                });
            } else if (direct) {
                // No backend: the browser talks to the stored agent with a publishable key.
                if (!o.agent || !o.publishableKey) throw new Error('Pass `api`, or `agent` with a `publishableKey`.');
                if (payload.approval) throw new Error('This agent needs approvals: serve it from your backend with `api`.');
                const input = turnInput(payload);
                const base = (o.baseUrl ?? 'https://cencori.com').replace(/\/$/, '');
                const sid = sessionRef.current;
                res = await (o.fetch ?? fetch)(sid ? `${base}/v1/sessions/${encodeURIComponent(sid)}/turns` : `${base}/v1/sessions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${o.publishableKey}`, ...extra },
                    body: JSON.stringify(sid
                        ? { input, stream: true }
                        : { agent_id: o.agent, metadata: { sdk: 'cencori/react' }, turn: { input, stream: true } }),
                    signal: controller.signal,
                });
                const created = res.headers.get('X-Cencori-Session-Id');
                if (created) setSessionId(created);
            } else {
                res = await (o.fetch ?? fetch)(o.api!, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', ...extra },
                    body: JSON.stringify({ ...o.body, ...payload, ...(sessionRef.current ? { sessionId: sessionRef.current } : {}) }),
                    signal: controller.signal,
                });
            }
            if (!res.ok || !res.body) {
                const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } | string };
                const message = typeof data.error === 'string' ? data.error : data.error?.message;
                throw new Error(message || `The chat request failed (${res.status}).`);
            }

            const fromSession = direct ? sessionEventsToChat() : null;
            for await (const raw of readEventStream(res.body)) {
              for (const { event, data } of fromSession ? fromSession(raw) : [raw]) {
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
                    case 'widget_partial':
                    case 'widget': {
                        if (!data.widget || typeof data.widget !== 'object') break;
                        const callId = typeof data.callId === 'string' && data.callId ? data.callId : undefined;
                        const partial = event === 'widget_partial';
                        const part: AgentChatPart = { type: 'widget', id: partial ? `partial_${callId}` : String(data.id), widget: data.widget as WidgetNode, callId, partial };
                        // The widget being written is replaced in place as it grows, then by the finished one.
                        patch(assistantId, (m) => {
                            const at = callId ? m.parts.findIndex((p) => p.type === 'widget' && p.callId === callId) : -1;
                            if (at === -1) return { ...m, parts: [...m.parts, part] };
                            const parts = [...m.parts];
                            parts[at] = part;
                            return { ...m, parts };
                        });
                        break;
                    }
                    case 'handoff':
                        pushPart({ type: 'handoff', from: String(data.from), to: String(data.to) });
                        patch(assistantId, (m) => ({ ...m, agent: String(data.to) }));
                        break;
                    case 'approval':
                        ended = 'approval';
                        if (typeof data.sessionId === 'string') setSessionId(data.sessionId);
                        pushPart({ type: 'approval', items: (data.items as AgentChatApprovalItem[]) ?? [], decisions: {}, state: String(data.state), status: 'pending' });
                        break;
                    case 'human_handoff':
                        pushPart({ type: 'notice', text: 'Handed to a person on the team. They\u2019ll reply here.' });
                        setWithHuman(true);
                        break;
                    case 'with_human':
                        // Kept for the person handling it: no answer from the agent.
                        keptForHuman = true;
                        setWithHuman(true);
                        break;
                    case 'done':
                        ended = 'done';
                        if (typeof data.sessionId === 'string' && data.sessionId) setSessionId(data.sessionId);
                        break;
                    case 'error':
                        throw new Error(String(data.message ?? 'The agent failed.'));
                }
              }
            }
            if (!ended) throw new Error('The reply ended early.');
            if (keptForHuman) {
                // Nothing from the agent to show: drop its empty reply.
                setMessages((prev) => prev.filter((m) => !(m.id === assistantId && m.parts.length === 0)));
            }
            // A widget that never finished (it failed its check) isn't left half-drawn.
            patch(assistantId, (m) => ({ ...m, status: 'done', parts: m.parts.filter((p) => !(p.type === 'widget' && p.partial)) }));
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

    const send = useCallback(async (text: string, files: File[] = []) => {
        const trimmed = text.trim();
        if (!trimmed && files.length === 0) return;
        let attachments: AgentChatAttachment[] = [];
        try {
            attachments = await Promise.all(files.slice(0, 5).map(readAttachment));
        } catch (cause) {
            const e = cause instanceof Error ? cause : new Error(String(cause));
            setError(e);
            opts.current.onError?.(e);
            return;
        }
        const parts: AgentChatPart[] = [
            ...attachments.map((a): AgentChatPart => ({ type: 'attachment', kind: a.kind, name: a.name, ...(a.kind === 'image' ? { url: a.data_url } : {}) })),
            ...(trimmed ? [{ type: 'text' as const, text: trimmed }] : []),
        ];
        await startTurn({ id: uid('msg'), role: 'user', parts }, { message: trimmed, ...(attachments.length ? { attachments } : {}) });
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
        setWithHuman(false);
        humanSince.current = null;
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

    // While a person handles the chat, check for their replies every few seconds.
    useEffect(() => {
        if (!withHuman || !sessionId) return;
        let stopped = false;
        let after = humanSince.current ?? new Date().toISOString();
        humanSince.current = after;
        const tick = async () => {
            try {
                const o = opts.current;
                const status = await pollHuman(o, sessionId, after);
                if (stopped || !status) return;
                const replies = status.messages.filter((m) => m.from === 'human');
                if (replies.length > 0) {
                    after = status.messages[status.messages.length - 1].at;
                    humanSince.current = after;
                    setMessages((prev) => [...prev, ...replies
                        .filter((m) => !prev.some((p) => p.id === `human_${m.id}`))
                        .map((m): AgentChatMessage => ({ id: `human_${m.id}`, role: 'assistant', author: 'human', status: 'done', parts: [{ type: 'text', text: m.text }] }))]);
                } else if (status.messages.length > 0) {
                    after = status.messages[status.messages.length - 1].at;
                    humanSince.current = after;
                }
                if (status.handled_by === 'agent') {
                    humanSince.current = null;
                    setWithHuman(false);
                }
            } catch {
                // Try again on the next tick.
            }
        };
        const timer = setInterval(() => { void tick(); }, 4000);
        void tick();
        return () => { stopped = true; clearInterval(timer); };
    }, [withHuman, sessionId]);

    return { messages, status, error, sessionId, send, sendAction, approve, reject, stop, reset, retry, withHuman };
}

/**
 * Cencori session events, as the agent chat events the hook draws: for
 * `agent` mode, where the browser reads the session stream itself.
 */
export function sessionEventsToChat() {
    const writing = new Map<string, string>();
    let sessionId = '';
    return ({ event, data }: { event: string; data: Record<string, unknown> }): Array<{ event: string; data: Record<string, unknown> }> => {
        switch (event) {
            case 'turn.started':
                return [];
            case 'output_text.delta':
                return typeof data.delta === 'string' && data.delta ? [{ event: 'text', data: { delta: data.delta } }] : [];
            case 'tool_call.delta': {
                if (data.tool !== 'render_ui') return [];
                const callId = String(data.action_id ?? '');
                const args = (writing.get(callId) ?? '') + String(data.delta ?? '');
                writing.set(callId, args);
                const widget = partialRenderUiWidget(args);
                return widget ? [{ event: 'widget_partial', data: { callId, widget } }] : [];
            }
            case 'tool_call.started':
                // render_ui shows as the widget itself, not as a step.
                return data.tool === 'render_ui' ? [] : [{ event: 'tool_call', data: { callId: String(data.action_id ?? ''), name: String(data.tool ?? ''), arguments: JSON.stringify(data.arguments ?? {}) } }];
            case 'tool_call.completed': {
                const out = data.output as { ok?: boolean; widget_id?: string; widget?: unknown } | undefined;
                if (data.tool === 'render_ui') {
                    return out?.ok && out.widget ? [{ event: 'widget', data: { id: String(out.widget_id ?? ''), callId: String(data.action_id ?? ''), widget: out.widget } }] : [];
                }
                return [{ event: 'tool_output', data: { callId: String(data.action_id ?? ''), name: String(data.tool ?? ''), output: typeof data.output === 'string' ? data.output : JSON.stringify(data.output ?? '') } }];
            }
            case 'turn.completed':
                return [{ event: 'done', data: { sessionId } }];
            case 'owner.handling':
                // A person is handling this conversation: the message was kept for them.
                return [{ event: 'with_human', data: {} }, { event: 'done', data: { sessionId } }];
            case 'turn.paused':
                return [{ event: 'error', data: { message: 'This agent needs approvals: serve it from your backend with `api`.' } }];
            case 'turn.failed': {
                const output = data.output as { error?: string } | undefined;
                return [{ event: 'error', data: { message: output?.error ?? 'The agent failed.' } }];
            }
            case 'error': {
                const err = (data.error ?? data) as { message?: string };
                return [{ event: 'error', data: { message: err.message ?? 'The agent failed.' } }];
            }
            default:
                return [];
        }
    };
}

// ── Console agents (widgetKey) ──────────────────────────────────

const grants = new Map<string, { token: string; sessionId: string; expiresAt: number }>();

function visitorId(widgetKey: string): string {
    const storageKey = `cencori-visitor:${widgetKey}`;
    try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved && /^v_[A-Za-z0-9-]{8,64}$/.test(saved)) return saved;
    } catch { /* storage blocked: a new visitor each time */ }
    const id = `v_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)}`;
    try { window.localStorage.setItem(storageKey, id); } catch { /* fine */ }
    return id;
}

/** A token for this conversation from the widget route: opens it, or resumes it with a fresh token. */
async function widgetGrant(fetchImpl: typeof fetch, base: string, widgetKey: string, sessionId: string | undefined, signal: AbortSignal) {
    const cached = sessionId ? grants.get(sessionId) : undefined;
    if (cached && cached.expiresAt - Date.now() > 60_000) return cached;
    const res = await fetchImpl(`${base}/api/widget/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: widgetKey, visitor_id: visitorId(widgetKey), ...(sessionId ? { session_id: sessionId } : {}) }),
        signal,
    });
    const data = (await res.json().catch(() => ({}))) as { token?: string; session_id?: string; expires_at?: string; error?: { message?: string } };
    if (!res.ok || !data.token || !data.session_id) throw new Error(data.error?.message || `Couldn't start the chat (${res.status}).`);
    const grant = { token: data.token, sessionId: data.session_id, expiresAt: data.expires_at ? Date.parse(data.expires_at) : Date.now() + 14 * 60_000 };
    grants.set(grant.sessionId, grant);
    return grant;
}

// ── Attachments and human replies ───────────────────────────────

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A file as an attachment: images shrunk to fit, everything as a data URL. */
async function readAttachment(file: File): Promise<AgentChatAttachment> {
    const isImage = file.type.startsWith('image/');
    let blob: File = file;
    if (isImage && file.size > MAX_IMAGE_BYTES) {
        if (!canDownscale(file.type)) throw new Error(`${file.name} is too large (images up to 4 MB).`);
        blob = (await downscaleImage(file, MAX_IMAGE_BYTES)).file;
    }
    if (!isImage && file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is too large (files up to 10 MB).`);
    const data_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
        reader.readAsDataURL(blob);
    });
    return { kind: isImage ? 'image' : 'file', name: file.name, data_url };
}

/** A turn's input for the no-backend modes: text, or a message with attachments. */
function turnInput(payload: AgentChatRequest): unknown {
    const text = payload.message ?? (payload.action ? formatWidgetAction(payload.action) : '');
    const attachments = payload.attachments ?? [];
    if (attachments.length === 0) return text;
    return [{
        type: 'message', role: 'user',
        content: [
            ...(text ? [{ type: 'input_text', text }] : []),
            ...attachments.map((a) => a.kind === 'image'
                ? { type: 'input_image', image_url: a.data_url }
                : { type: 'input_file', filename: a.name, file_data: a.data_url }),
        ],
    }];
}

/** The person's replies since `after`: from your route (api) or Cencori (widgetKey). */
async function pollHuman(o: UseAgentChatOptions, sessionId: string, after: string): Promise<{ handled_by: 'human' | 'agent'; messages: AgentChatHumanMessage[] } | null> {
    const f = o.fetch ?? fetch;
    if (o.api) {
        const extra = typeof o.headers === 'function' ? await o.headers() : o.headers ?? {};
        const res = await f(o.api, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ ...o.body, sessionId, poll: { after } }) });
        return res.ok ? res.json() : null;
    }
    if (o.widgetKey) {
        const base = (o.baseUrl ?? 'https://cencori.com').replace(/\/$/, '');
        const grant = await widgetGrant(f, base, o.widgetKey, sessionId, new AbortController().signal);
        const res = await f(`${base}/v1/sessions/${encodeURIComponent(sessionId)}/human?after=${encodeURIComponent(after)}`, { headers: { Authorization: `Bearer ${grant.token}` } });
        return res.ok ? res.json() : null;
    }
    return null;
}
