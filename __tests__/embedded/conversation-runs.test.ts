import { describe, expect, it } from 'vitest';
import { RUN_TEXT_LIMIT, runText, turnText } from '@/lib/embedded/conversation-runs';

describe('turnText', () => {
    it('takes the last user message as the prompt, not the history or the system prompt', () => {
        const row = {
            request_payload: { messages: [
                { role: 'system', content: 'You are a receptionist.' },
                { role: 'user', content: 'Hi' },
                { role: 'assistant', content: 'Hello!' },
                { role: 'user', content: 'What are your opening hours?' },
            ] },
            response_payload: { content: 'We open at 9.' },
        };
        expect(turnText(row)).toEqual({ prompt: 'What are your opening hours?', reply: 'We open at 9.' });
    });

    it('returns nulls when the project kept no prompts', () => {
        expect(turnText({ request_payload: {}, response_payload: null })).toEqual({ prompt: null, reply: null });
        expect(turnText({})).toEqual({ prompt: null, reply: null });
    });

    it('clips very long text', () => {
        const long = 'a'.repeat(RUN_TEXT_LIMIT + 50);
        const { prompt } = turnText({ request_payload: { messages: [{ role: 'user', content: long }] } });
        expect(prompt).toHaveLength(RUN_TEXT_LIMIT + 1);
    });
});

describe('runText', () => {
    it('reads the enveloped input and the output', () => {
        expect(runText({ input_ref: { __cencori_run_request: true, input: { text: 'Summarise this' } }, output_ref: { output: 'Done.' } }))
            .toEqual({ prompt: 'Summarise this', reply: 'Done.' });
    });

    it('handles plain string and structured input from older runs', () => {
        expect(runText({ input_ref: 'hello', output_ref: null })).toEqual({ prompt: 'hello', reply: null });
        expect(runText({ input_ref: { order: 12 }, output_ref: { output: { ok: true } } })).toEqual({ prompt: '{"order":12}', reply: '{"ok":true}' });
        expect(runText({ input_ref: {}, output_ref: {} })).toEqual({ prompt: null, reply: null });
    });
});
