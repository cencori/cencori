/**
 * Conversation turns as agent runs. A turn through the Sessions API (the
 * website widget, a share link, or a customer's own app) is one run of the
 * agent; the gateway logs each one to ai_requests under this endpoint, with
 * the agent, customer (tenant) and latency.
 */

export const CONVERSATION_TURN_ENDPOINT = '/v1/sessions/:id/turns';

export type ConversationTurnRow = {
    id: string;
    agent_id: string | null;
    tenant_id: string | null;
    status: string | null;
    error_message: string | null;
    latency_ms: number | null;
    created_at: string;
};

/** A logged turn in the shape of an embedded_runs row. */
export function turnAsRun(row: ConversationTurnRow, agentId: string) {
    const completed = row.status === 'success';
    const startedAt = typeof row.latency_ms === 'number' ? new Date(new Date(row.created_at).getTime() - row.latency_ms).toISOString() : null;
    return {
        id: row.id,
        agent_id: row.agent_id ?? agentId,
        tenant_id: row.tenant_id,
        status: completed ? 'completed' : 'failed',
        error: completed ? null : (row.error_message ?? 'The turn failed.'),
        started_at: startedAt,
        completed_at: row.created_at,
        created_at: row.created_at,
        kind: 'conversation' as const,
    };
}

/** How much of a prompt or reply the runs list carries per row. */
export const RUN_TEXT_LIMIT = 4_000;

function clip(text: string): string {
    return text.length > RUN_TEXT_LIMIT ? `${text.slice(0, RUN_TEXT_LIMIT)}…` : text;
}

function asText(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value.trim() ? clip(value) : null;
    try {
        const json = JSON.stringify(value);
        return json && json !== '{}' && json !== '[]' ? clip(json) : null;
    } catch {
        return null;
    }
}

/**
 * What the customer asked and what the agent answered, from a logged turn
 * (ai_requests payloads, already masked by the project's data rules). The
 * prompt is the last user message; earlier messages are the conversation so far.
 */
export function turnText(row: { request_payload?: unknown; response_payload?: unknown }): { prompt: string | null; reply: string | null } {
    const messages = (row.request_payload as { messages?: unknown } | null)?.messages;
    let prompt: string | null = null;
    if (Array.isArray(messages)) {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            const message = messages[i] as { role?: unknown; content?: unknown } | null;
            if (message?.role === 'user') {
                prompt = asText(message.content);
                break;
            }
        }
    }
    return { prompt, reply: asText((row.response_payload as { content?: unknown } | null)?.content) };
}

/** The same for an API run: its stored input and output. */
export function runText(row: { input_ref?: unknown; output_ref?: unknown }): { prompt: string | null; reply: string | null } {
    const stored = row.input_ref as Record<string, unknown> | null;
    // Newer runs wrap the input in an envelope ({ input, response_format, mode }).
    const input = stored && typeof stored === 'object' && !Array.isArray(stored) && 'input' in stored ? stored.input : stored;
    const text = input && typeof input === 'object' && !Array.isArray(input)
        ? ((input as Record<string, unknown>).text ?? (input as Record<string, unknown>).prompt ?? (input as Record<string, unknown>).message ?? input)
        : input;
    return { prompt: asText(text), reply: asText((row.output_ref as { output?: unknown } | null)?.output) };
}
