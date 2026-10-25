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
