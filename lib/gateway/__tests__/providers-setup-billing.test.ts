import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/config-cache', () => ({
    getCachedProviderConfig: vi.fn().mockResolvedValue(null),
    setCachedProviderConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/encryption', () => ({ decryptApiKey: () => 'sk-test-byok' }));
vi.mock('@/lib/providers', () => ({
    OpenAIProvider: class {},
    GeminiProvider: class {},
    AnthropicProvider: class {},
    OpenAICompatibleProvider: class {},
    CohereProvider: class {},
    isOpenAICompatible: () => false,
}));

import { initializeBYOKProviders } from '@/lib/gateway/providers-setup';

function providerKeyClient(row: Record<string, unknown> | null) {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({ single: async () => ({ data: row, error: null }) }),
                }),
            }),
        }),
    };
}

describe('provider-key billing source', () => {
    it('marks an active project key as BYOK even when a managed provider is registered', async () => {
        const router = { registerProvider: vi.fn(), hasProvider: () => true };
        const result = await initializeBYOKProviders(
            router as never,
            providerKeyClient({ encrypted_key: 'encrypted', is_active: true, default_model: null }) as never,
            'project-1',
            'org-1',
            'openai',
        );
        expect(result).toEqual({ success: true, usesByok: true, defaultModel: undefined });
        expect(router.registerProvider).toHaveBeenCalledOnce();
    });

    it('keeps managed billing when no active project key exists', async () => {
        const router = { registerProvider: vi.fn(), hasProvider: () => true };
        const result = await initializeBYOKProviders(
            router as never,
            providerKeyClient(null) as never,
            'project-1',
            'org-1',
            'openai',
        );
        expect(result).toEqual({ success: true, usesByok: false });
        expect(router.registerProvider).not.toHaveBeenCalled();
    });
});
