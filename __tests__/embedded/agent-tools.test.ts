import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/security/outbound-url', () => ({ safeOutboundFetch: fetchMock }));

import { agentToolset, buildSystemTools, readSystemTools } from '@/lib/embedded/agent-tools';
import { buildWebhookTools, withoutWebhookEndpoints, withoutWebhookTools } from '@/lib/embedded/webhook-tools';

const context = { organizationId: 'org_1', agentId: 'agent_1', surface: 'conversation' as const };

describe('system tools', () => {
    it('validates the hand-off URL and keeps only switched-on tools', () => {
        expect(buildSystemTools({ end_conversation: true, transfer_to_human: { url: 'https://x.example.com/h' } })).toEqual({
            ok: true, tools: { end_conversation: {}, transfer_to_human: { url: 'https://x.example.com/h' } },
        });
        expect(buildSystemTools({ transfer_to_human: { url: 'http://x.example.com' } }).ok).toBe(false);
        expect(buildSystemTools({ transfer_to_human: { url: 'not a url' } }).ok).toBe(false);
        expect(buildSystemTools({ end_conversation: false })).toEqual({ ok: true, tools: {} });
        expect(readSystemTools({ system_tools: { end_conversation: 'yes' } })).toEqual({});
    });

    it('uses the owner\'s description and transfer rules when set, the defaults otherwise', () => {
        const built = buildSystemTools({
            end_conversation: { description: '  Close politely when they say bye.  ' },
            transfer_to_human: { url: 'https://x.example.com/h', rules: ['They ask about pricing over $10k', '  ', 'They are angry'] },
        });
        if (!built.ok) throw new Error(built.message);
        expect(built.tools.transfer_to_human?.rules).toEqual(['They ask about pricing over $10k', 'They are angry']);
        const [end, transfer] = agentToolset({ system_tools: built.tools }).definitions;
        expect(end.function.description).toBe('Close politely when they say bye.');
        expect(transfer.function.description).toContain('Hand the person to a human');
        expect(transfer.function.description).toContain('- They ask about pricing over $10k\n- They are angry');
        // The earlier on-switch still reads as on.
        expect(readSystemTools({ system_tools: { end_conversation: true } })).toEqual({ end_conversation: {} });
    });

    it('offers only what is on, and ends the conversation on request', async () => {
        expect(agentToolset({}).definitions).toHaveLength(0);
        const toolset = agentToolset({ system_tools: { end_conversation: true } });
        expect(toolset.definitions.map((d) => d.function.name)).toEqual(['end_conversation']);
        expect(toolset.has('transfer_to_human')).toBe(false);
        const outcome = await toolset.run({ id: 'c1', name: 'end_conversation', args: '{}' }, context);
        expect(outcome).toMatchObject({ ok: true, endsConversation: true });
    });

    it('asks for contact details before handing off, then posts the hand-off', async () => {
        const toolset = agentToolset({ system_tools: { transfer_to_human: { url: 'https://hooks.example.com/h' } } });
        const missing = await toolset.run({ id: 'c1', name: 'transfer_to_human', args: '{"summary":"needs help"}' }, context);
        expect(missing.ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();

        fetchMock.mockResolvedValueOnce(new Response('', { status: 202 }));
        const sent = await toolset.run(
            { id: 'c2', name: 'transfer_to_human', args: '{"name":"Ada","contact":"ada@example.com","summary":"Custom plan"}' },
            { ...context, conversationId: 'sess_1', transcript: [{ role: 'system', content: 'secret prompt' }, { role: 'user', content: 'talk to a human' }] },
        );
        expect(sent.ok).toBe(true);
        expect(sent.output).toContain('ada@example.com');
        const body = JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body));
        expect(body).toMatchObject({ conversation_id: 'sess_1', person: { name: 'Ada', contact: 'ada@example.com' }, summary: 'Custom plan' });
        // The system prompt never leaves with the transcript.
        expect(body.transcript).toEqual([{ role: 'user', content: 'talk to a human' }]);
    });

    it('keeps webhook names off system tool names, and the hand-off URL out of public copies', () => {
        process.env.ENCRYPTION_SECRET ??= 'test-encryption-secret-at-least-32-chars-long';
        expect(buildWebhookTools([{ name: 'end_conversation', description: 'x', method: 'POST', url: 'https://a.example.com' }], [], 'org_1').ok).toBe(false);
        const config = { system_tools: { end_conversation: true, transfer_to_human: { url: 'https://hooks.example.com/h' } } };
        expect(withoutWebhookEndpoints(config).system_tools).toEqual({ end_conversation: true, transfer_to_human: { enabled: true } });
        expect(withoutWebhookTools(config).system_tools).toEqual({ end_conversation: true });
    });
});
