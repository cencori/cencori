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

function gatewayClient(opts: {
    providerKeyRow: Record<string, unknown> | null;
    embeddedRows?: Record<string, unknown>[];
}) {
    return {
        from: (table: string) => {
            if (table === 'provider_keys') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: () => ({ single: async () => ({ data: opts.providerKeyRow, error: null }) }),
                        }),
                    }),
                };
            }
            const rows = opts.embeddedRows ?? [];
            return {
                select: () => ({
                    eq: () => ({
                        eq: () => ({
                            order: () => ({
                                limit: async () => ({ data: rows, error: null }),
                            }),
                        }),
                    }),
                }),
            };
        },
    };
}

describe('provider-key billing source', () => {
    it('marks an active project key as BYOK even when a managed provider is registered', async () => {
        const router = { registerProvider: vi.fn(), hasProvider: () => true };
        const result = await initializeBYOKProviders(
            router as never,
            gatewayClient({ providerKeyRow: { encrypted_key: 'encrypted', is_active: true, default_model: null } }) as never,
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
            gatewayClient({ providerKeyRow: null }) as never,
            'project-1',
            'org-1',
            'openai',
        );
        expect(result).toEqual({ success: true, usesByok: false });
        expect(router.registerProvider).not.toHaveBeenCalled();
    });

    it('falls back to an API-added embedded connection when no dashboard key exists', async () => {
        const router = { registerProvider: vi.fn(), hasProvider: () => true };
        const result = await initializeBYOKProviders(
            router as never,
            gatewayClient({
                providerKeyRow: null,
                embeddedRows: [
                    {
                        id: 'uuid-1',
                        provider: 'openai',
                        status: 'active',
                        base_url: null,
                        encrypted_key_ref: 'IV:TAG:DATA',
                        key_hint: '...1234',
                        created_at: '2026-09-25T23:00:47Z',
                    },
                ],
            }) as never,
            'project-1',
            'org-1',
            'openai',
        );
        expect(result).toEqual({ success: true, usesByok: true });
        expect(router.registerProvider).toHaveBeenCalledOnce();
    });

    it('ignores unhealthy or proxy-bound embedded connections', async () => {
        const router = { registerProvider: vi.fn(), hasProvider: () => true };
        const result = await initializeBYOKProviders(
            router as never,
            gatewayClient({
                providerKeyRow: null,
                embeddedRows: [
                    {
                        id: 'uuid-2',
                        provider: 'openai',
                        status: 'unhealthy',
                        base_url: null,
                        encrypted_key_ref: 'IV:TAG:DATA',
                        created_at: '2026-09-25T23:00:47Z',
                    },
                    {
                        id: 'uuid-3',
                        provider: 'openai',
                        status: 'active',
                        base_url: 'https://proxy.example.com/v1',
                        encrypted_key_ref: 'IV:TAG:DATA',
                        created_at: '2026-09-26T00:00:00Z',
                    },
                ],
            }) as never,
            'project-1',
            'org-1',
            'openai',
        );
        expect(result).toEqual({ success: true, usesByok: false });
        expect(router.registerProvider).not.toHaveBeenCalled();
    });
});
