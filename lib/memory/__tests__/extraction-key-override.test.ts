/**
 * @vitest-environment node
 *
 * Memory key isolation: the generative fan-out must run on DEDICATED memory keys
 * (MEMORY_GEMINI/CEREBRAS/AI_GATEWAY) so memory never competes with chat traffic
 * for the shared managed quota. Extraction routes through callMemoryLlm →
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
        extractionModel: 'gpt-oss-120b',
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
            actualModel: 'gpt-oss-120b',
            actualProvider: 'cerebras',
            cost: { cencoriChargeUsd: 0 },
        });
    });

    it('passes the dedicated per-provider memory keys through to the executor', async () => {
        mocks.getMemoryProviderKey.mockImplementation((p: string) =>
            ({ google: 'mem-google', cerebras: 'mem-cerebras', vercel: 'mem-vercel' }) as Record<string, string>)[p]
        );

        const res = await extractFacts(baseParams);

        expect(res.facts).toEqual([{ content: 'The user uses Rust', importance: 0.7 }]);
        const arg = mocks.executeGatewayChat.mock.calls[0][0] as {
            memoryProviderKeys?: Record<string, string>;
            request?: { model?: string };
        };
        expect(arg.request?.model).toBe('gpt-oss-120b');
        expect(arg.memoryProviderKeys).toEqual({ google: 'mem-google', cerebras: 'mem-cerebras', vercel: 'mem-vercel' });
    });

    it('leaves keys undefined when no dedicated memory key is set (uses shared managed key)', async () => {
        mocks.getMemoryProviderKey.mockReturnValue(undefined);

        await extractFacts(baseParams);

        const arg = mocks.executeGatewayChat.mock.calls[0][0] as { memoryProviderKeys?: Record<string, string | undefined> };
        expect(arg.memoryProviderKeys).toEqual({ google: undefined, cerebras: undefined, vercel: undefined });
    });

    it('falls back from Cerebras 120B to the Vercel leg when the primary fails', async () => {
        mocks.executeGatewayChat
            .mockRejectedValueOnce(new Error('cerebras unavailable'))
            .mockResolvedValueOnce({
                content: '[{"fact":"The user uses Rust","importance":0.7}]',
                actualModel: 'vercel/openai/gpt-oss-20b',
                actualProvider: 'vercel',
                cost: { cencoriChargeUsd: 0.0002 },
            });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const res = await extractFacts(baseParams);

        expect(res.model).toBe('vercel/openai/gpt-oss-20b');
        expect(mocks.executeGatewayChat).toHaveBeenCalledTimes(2);
        expect(mocks.executeGatewayChat.mock.calls.map(call => call[0].request.model)).toEqual([
            'gpt-oss-120b',
            'vercel/openai/gpt-oss-20b',
        ]);
    });

    it('honors an allowed fallback override before the default primary', async () => {
        mocks.executeGatewayChat.mockResolvedValueOnce({
            content: '[{"fact":"The user uses Rust","importance":0.7}]',
            actualModel: 'vercel/openai/gpt-oss-20b',
            actualProvider: 'vercel',
            cost: { cencoriChargeUsd: 0.0002 },
        });

        await extractFacts({
            ...baseParams,
            extractOverride: { model: 'vercel/openai/gpt-oss-20b' },
        });

        expect(mocks.executeGatewayChat.mock.calls[0][0].request.model).toBe('vercel/openai/gpt-oss-20b');
    });
});
