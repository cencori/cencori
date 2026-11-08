import { describe, expect, it } from 'vitest';
import { sessionEventsToChat } from './use-agent-chat';

describe('sessionEventsToChat (agent mode)', () => {
    it('turns a Cencori session stream into chat events', () => {
        const map = sessionEventsToChat();
        const widget = { type: 'Card', title: 'Q4', children: [] };
        const args = JSON.stringify({ widget });
        const out = [
            { event: 'turn.started', data: { turn_number: 1 } },
            { event: 'tool_call.started', data: { tool: 'web_search', arguments: { q: 'x' }, action_id: 't1' } },
            { event: 'tool_call.completed', data: { tool: 'web_search', output: { results: [] }, action_id: 't1' } },
            { event: 'tool_call.delta', data: { tool: 'render_ui', action_id: 'w1', delta: args.slice(0, args.indexOf('"children"')) } },
            { event: 'tool_call.started', data: { tool: 'render_ui', arguments: {}, action_id: 'w1' } },
            { event: 'tool_call.completed', data: { tool: 'render_ui', action_id: 'w1', output: { ok: true, widget_id: 'wgt_1', widget } } },
            { event: 'output_text.delta', data: { delta: 'Up 12%.' } },
            { event: 'turn.completed', data: { turn_number: 1 } },
        ].flatMap(map);
        expect(out.map((e) => e.event)).toEqual(['tool_call', 'tool_output', 'widget_partial', 'widget', 'text', 'done']);
        expect(out[2].data).toMatchObject({ callId: 'w1', widget: { type: 'Card', title: 'Q4' } });
        expect(out[3].data).toEqual({ id: 'wgt_1', callId: 'w1', widget });
    });

    it('reports failures and approvals it cannot handle', () => {
        const map = sessionEventsToChat();
        expect(map({ event: 'turn.failed', data: { output: { error: 'Credit balance exhausted' } } })).toEqual([{ event: 'error', data: { message: 'Credit balance exhausted' } }]);
        expect(map({ event: 'turn.paused', data: {} })[0].event).toBe('error');
    });
});
