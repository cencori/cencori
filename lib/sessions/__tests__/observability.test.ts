import { describe, expect, it } from 'vitest';
import { buildTimeline, sessionAgentLabel, sessionSource, type SessionEventRow } from '@/lib/sessions/observability';

describe('sessionSource', () => {
    it.each([
        [{ metadata: { sdk: 'cencori/agents', agent: 'Support' } }, 'sdk'],
        [{ metadata: { source: 'widget' } }, 'widget'],
        [{ metadata: { source: 'link' } }, 'link'],
        [{ metadata: { source: 'whatsapp' } }, 'whatsapp'],
        [{ metadata: {}, installation_id: 'ins_1' }, 'embedded'],
        [{ metadata: { name: 'researcher', model: 'm', instructions: '...' } }, 'arcie'],
        [{ metadata: { parent: 'researcher', subagent: 'search' } }, 'arcie'],
        [{ metadata: {} }, 'api'],
        [{ metadata: null }, 'api'],
    ] as const)('%j → %s', (row, source) => {
        expect(sessionSource(row)).toBe(source);
    });

    it('labels the agent from what the session recorded', () => {
        expect(sessionAgentLabel({ metadata: { agent: 'Support' } })).toBe('Support');
        expect(sessionAgentLabel({ metadata: { parent: 'researcher', subagent: 'search' } })).toBe('researcher › search');
        expect(sessionAgentLabel({ metadata: {} }, new Map([['agt_1', 'Concierge']]), 'agt_1')).toBe('Concierge');
        expect(sessionAgentLabel({ metadata: {} })).toBeNull();
    });
});

const at = (s: number) => new Date(Date.UTC(2026, 10, 8, 12, 0, s)).toISOString();
const ev = (turn_number: number, sequence: number, event_type: string, payload: Record<string, unknown>, second: number): SessionEventRow =>
    ({ turn_number, sequence, event_type, payload, created_at: at(second) });

describe('buildTimeline', () => {
    it('reads a two-round tool run, with results from the resumed turns', () => {
        const turns = buildTimeline([
            ev(1, 1, 'turn.started', { model: 'gpt-oss-120b', input_text: 'Where is order 1042?', input_messages: [{ role: 'user', content: 'Where is order 1042?' }], metadata: { agent: 'Support' } }, 0),
            ev(1, 2, 'tool_call.started', { tool: 'get_order', arguments: { id: '1042' }, action_id: 'c1' }, 1),
            ev(1, 3, 'turn.paused', { reason: 'tool_results_required', action_id: 'c1', actions: [{ action_id: 'c1', tool: 'get_order', needs_approval: false }],
                trace: { request_id: 'req_a', provider: 'cerebras', model: 'gpt-oss-120b', used_fallback: false, cost_usd: 0.0002, ttft_ms: 310, model_ms: 640, rounds: 1 } }, 1),
            ev(1, 4, 'turn.resumed', { action_id: 'c1', resolution: 'approved' }, 2),
            ev(2, 1, 'turn.started', { model: 'gpt-oss-120b', resumed_from_turn: 1, input_messages: [
                { role: 'user', content: 'Where is order 1042?' },
                { role: 'assistant', content: null, tool_calls: [{ id: 'c1' }] },
                { role: 'tool', toolCallId: 'c1', content: '{"status":"shipped","shipment_id":"SHP-77"}' },
            ] }, 2),
            ev(2, 2, 'tool_call.started', { tool: 'get_shipment', arguments: { shipment_id: 'SHP-77' }, action_id: 'c2' }, 3),
            ev(2, 3, 'turn.paused', { reason: 'tool_results_required', action_id: 'c2', actions: [{ action_id: 'c2', tool: 'get_shipment' }] }, 3),
            ev(2, 4, 'turn.resumed', { action_id: 'c2', resolution: 'approved' }, 4),
            ev(3, 1, 'turn.started', { model: 'gpt-oss-120b', resumed_from_turn: 2, input_messages: [{ role: 'tool', toolCallId: 'c2', content: '{"location":"Ikeja hub"}' }] }, 4),
            ev(3, 2, 'output_text.delta', { delta: 'It is at the Ikeja hub.' }, 5),
            ev(3, 3, 'turn.completed', { usage: { input_tokens: 120, output_tokens: 9 } }, 5),
            ev(3, 0, 'turn.checkpoint', { messages: [] }, 5),
        ]);

        expect(turns.map((t) => [t.turn, t.status, t.resumedFrom])).toEqual([[1, 'paused', null], [2, 'paused', 1], [3, 'completed', 2]]);
        expect(turns[0]).toMatchObject({ input: 'Where is order 1042?', pauseReason: 'tool_results_required', resolution: 'approved', durationMs: 1000, model: 'gpt-oss-120b' });
        expect(turns[0].toolCalls[0]).toMatchObject({ name: 'get_order', arguments: '{\n  "id": "1042"\n}', needsApproval: false, handoff: false });
        expect(turns[0].toolCalls[0].result).toContain('"shipment_id": "SHP-77"');
        expect(turns[1].input).toBeNull();
        expect(turns[1].toolCalls[0].result).toContain('Ikeja hub');
        expect(turns[2]).toMatchObject({ text: 'It is at the Ikeja hub.', usage: { inputTokens: 120, outputTokens: 9 } });
        // The trace of the model call, the agent, and the caller's tool timing (pause → resume).
        expect(turns[0].agent).toBe('Support');
        expect(turns[0].trace).toEqual({ requestId: 'req_a', provider: 'cerebras', model: 'gpt-oss-120b', usedFallback: false, costUsd: 0.0002, ttftMs: 310, modelMs: 640, rounds: 1 });
        expect(turns[0].toolCalls[0]).toMatchObject({ executedBy: 'caller', startedAt: at(1), endedAt: at(2), durationMs: 1000, resolution: null });
        expect(turns[1].trace.requestId).toBeNull();
    });

    it('marks approvals, rejections, handoffs, failures and turns still running', () => {
        const turns = buildTimeline([
            ev(1, 1, 'turn.started', { model: 'm', input_text: 'Refund 1042' }, 0),
            ev(1, 2, 'tool_call.started', { tool: 'issue_refund', arguments: '{"id":"1042"}', action_id: 'r1' }, 1),
            ev(1, 3, 'turn.paused', { reason: 'approval_required', action_id: 'r1', actions: [{ action_id: 'r1', needs_approval: true }] }, 1),
            ev(1, 4, 'turn.resumed', { action_id: 'r1', resolution: 'rejected' }, 9),
            ev(2, 1, 'turn.started', { model: 'm', resumed_from_turn: 1 }, 9),
            ev(2, 2, 'tool_call.started', { tool: 'transfer_to_billing', arguments: {}, action_id: 'h1' }, 10),
            ev(2, 3, 'turn.paused', { reason: 'tool_results_required', action_id: 'h1' }, 10),
            ev(3, 1, 'turn.started', { model: 'm', input_text: 'hello' }, 20),
            ev(3, 2, 'turn.failed', { output: { error: 'Blocked by policy' } }, 21),
            ev(4, 1, 'turn.started', { model: 'm', input_text: 'still going' }, 30),
        ]);
        expect(turns[0]).toMatchObject({ pauseReason: 'approval_required', resolution: 'rejected' });
        expect(turns[0].toolCalls[0]).toMatchObject({ needsApproval: true, arguments: '{\n  "id": "1042"\n}', resolution: 'rejected', durationMs: 8000 });
        expect(turns[1].toolCalls[0].handoff).toBe(true);
        expect(turns[1].resolution).toBeNull();
        expect(turns[2]).toMatchObject({ status: 'failed', error: 'Blocked by policy' });
        expect(turns[3]).toMatchObject({ status: 'running', endedAt: null, durationMs: null });
    });

    it('times tools Cencori ran inside the turn from call to result', () => {
        const turns = buildTimeline([
            ev(1, 1, 'turn.started', { model: 'm', input_text: 'search' }, 0),
            ev(1, 2, 'tool_call.started', { tool: 'kb_search', arguments: { q: 'x' }, action_id: 'k1' }, 1),
            ev(1, 3, 'tool_call.completed', { tool: 'kb_search', output: 'found', action_id: 'k1' }, 3),
            ev(1, 4, 'turn.completed', {}, 4),
        ]);
        expect(turns[0].toolCalls[0]).toMatchObject({ executedBy: 'cencori', startedAt: at(1), endedAt: at(3), durationMs: 2000, result: 'found' });
    });

    it('reads older resumed turns that have no turn.started, and server tool outputs', () => {
        const turns = buildTimeline([
            ev(2, 1, 'output_text.delta', { delta: 'Done.', resumed_from_turn: 1 }, 1),
            ev(2, 2, 'tool_call.completed', { tool: 'web_search_preview', output: { results: 3 }, action_id: 'ws_1' }, 1),
            ev(2, 3, 'turn.completed', { output: { text: 'Done.' }, resumed_from_turn: 1 }, 2),
        ]);
        expect(turns[0]).toMatchObject({ resumedFrom: 1, text: 'Done.', status: 'completed', model: null });
        expect(turns[0].toolCalls[0]).toMatchObject({ name: 'web_search_preview', result: '{\n  "results": 3\n}', executedBy: 'cencori' });
    });
});
