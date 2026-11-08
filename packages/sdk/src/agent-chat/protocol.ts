/**
 * Agent UI's wire format: what a chat UI (cencori/react's useAgentChat)
 * and the server it talks to send each other. The server is either your own
 * route (cencori/agents' createAgentChatHandler) or anything that speaks this
 * format. Server-sent events, one JSON object per event.
 */

import type { WidgetAction, WidgetNode } from '../widgets/spec';
import { readSessionEvents } from '../agents-sdk/transport';

export type AgentChatEvent =
    | { event: 'agent'; data: { name: string } }
    | { event: 'text'; data: { delta: string; agent?: string } }
    | { event: 'tool_call'; data: { callId: string; name: string; arguments: string; agent?: string } }
    | { event: 'tool_output'; data: { callId: string; name: string; output: string; agent?: string } }
    | { event: 'widget'; data: { id: string; callId?: string; widget: WidgetNode; agent?: string } }
    /** A widget still being written: draw it, then replace it with the 'widget' for the same callId. */
    | { event: 'widget_partial'; data: { callId: string; widget: WidgetNode; agent?: string } }
    | { event: 'handoff'; data: { from: string; to: string } }
    /** Tool calls waiting for the user. Send `state` back with the decisions to continue. */
    | { event: 'approval'; data: { sessionId: string; state: string; items: AgentChatApprovalItem[] } }
    | { event: 'done'; data: { sessionId: string } }
    | { event: 'error'; data: { message: string; code?: string } };

export interface AgentChatApprovalItem {
    callId: string;
    toolName: string;
    /** The model's arguments, as JSON text. */
    arguments: string;
    agentName?: string;
}

export interface AgentChatDecision {
    approved: boolean;
    message?: string;
}

/** What the chat sends: a message, a widget action, or decisions on pending approvals. */
export interface AgentChatRequest {
    sessionId?: string;
    message?: string;
    action?: WidgetAction & { widgetId?: string; label?: string };
    approval?: { state: string; decisions: Record<string, AgentChatDecision> };
}

/** How a widget action reads to the agent as the user's next message. */
export function formatWidgetAction(action: NonNullable<AgentChatRequest['action']>): string {
    const payload = action.payload && Object.keys(action.payload).length > 0 ? ` ${JSON.stringify(action.payload)}` : '';
    const label = action.label ? ` ("${action.label}")` : '';
    return `[The user used the widget${label}: action "${action.type}"${payload}]`;
}

export function encodeAgentChatEvent(e: AgentChatEvent): string {
    return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
}

/** Read an agent chat (or Cencori session) event stream. */
export async function* readEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
    yield* readSessionEvents(new Response(body));
}
