/**
 * @vitest-environment node
 *
 * Memory key isolation: the generative fan-out must run on DEDICATED memory keys
 * (MEMORY_GEMINI/GROQ/CEREBRAS) so memory never competes with chat traffic for
 * the shared managed quota. Extraction routes through callMemoryLlm →
 * executeGatewayChat, which receives the per-provider memory keys.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    executeGatewayChat: vi.fn(),
    getMemoryProviderKey: vi.fn(),
}));

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...a: unknown[]) => mocks.executeGatewayChat(...a),
}));

vi.mock('@/lib/providers/google-env', () => ({
    getMemoryProviderKey: (...a: unknown[]) => mocks.getMemoryProviderKey(...a),
}));

import { extractFacts } from '../extraction';

const baseParams = {
    supabase: {} as never,
    projectId: 'proj_1',
    organizationId: 'org_1',
    tier: 'free' as never,
    settings: {
        extractionModel: 'openai/gpt-oss-20b',
        extractionPrompt: 'extract facts',
        minImportance: 0.3,
        maxMemoriesPerExchange: 10,
    } as never,
    extractOverride: null,
    userText: 'I use Rust',
    assistantText: 'Nice',
};

describe('extractFacts memory-key isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.executeGatewayChat.mockResolvedValue({
            content: '[{"fact":"The user uses Rust","importance":0.7}]',
            actualModel: 'openai/gpt-oss-20b',
            actualProvider: 'groq',
            cost: { cencoriChargeUsd: 0 },
        });
    });

    it('passes the dedicated per-provider memory keys through to the executor', async () => {
        mocks.getMemoryProviderKey.mockImplementation((p: string) =>
            ({ google: 'mem-google', groq: 'mem-groq', cerebras: 'mem-cerebras' } as Record<string, string>)[p]
        );

        const res = await extractFacts(baseParams);

        expect(res.facts).toEqual([{ content: 'The user uses Rust', importance: 0.7 }]);
        const arg = mocks.executeGatewayChat.mock.calls[0][0] as {
            memoryProviderKeys?: Record<string, string>;
            request?: { model?: string };
        };
        expect(arg.request?.model).toBe('openai/gpt-oss-20b');
        expect(arg.memoryProviderKeys).toEqual({ google: 'mem-google', groq: 'mem-groq', cerebras: 'mem-cerebras' });
    });

    it('leaves keys undefined when no dedicated memory key is set (uses shared managed key)', async () => {
        mocks.getMemoryProviderKey.mockReturnValue(undefined);

        await extractFacts(baseParams);

        const arg = mocks.executeGatewayChat.mock.calls[0][0] as { memoryProviderKeys?: Record<string, string | undefined> };
        expect(arg.memoryProviderKeys).toEqual({ google: undefined, groq: undefined, cerebras: undefined });
    });

    it('falls back from Groq 20B to Cerebras 120B when the primary fails', async () => {
        mocks.executeGatewayChat
            .mockRejectedValueOnce(new Error('groq unavailable'))
            .mockResolvedValueOnce({
                content: '[{"fact":"The user uses Rust","importance":0.7}]',
                actualModel: 'gpt-oss-120b',
                actualProvider: 'cerebras',
                cost: { cencoriChargeUsd: 0.0002 },
            });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const res = await extractFacts(baseParams);

        expect(res.model).toBe('gpt-oss-120b');
        expect(mocks.executeGatewayChat).toHaveBeenCalledTimes(2);
        expect(mocks.executeGatewayChat.mock.calls.map(call => call[0].request.model)).toEqual([
            'openai/gpt-oss-20b',
            'gpt-oss-120b',
        ]);
    });

    it('honors an allowed fallback override before the default primary', async () => {
        mocks.executeGatewayChat.mockResolvedValueOnce({
            content: '[{"fact":"The user uses Rust","importance":0.7}]',
            actualModel: 'gpt-oss-120b',
            actualProvider: 'cerebras',
            cost: { cencoriChargeUsd: 0.0002 },
        });

        await extractFacts({
            ...baseParams,
            extractOverride: { model: 'gpt-oss-120b' },
        });

        expect(mocks.executeGatewayChat.mock.calls[0][0].request.model).toBe('gpt-oss-120b');
    });
});
