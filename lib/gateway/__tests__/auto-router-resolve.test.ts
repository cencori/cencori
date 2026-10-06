/** @vitest-environment node */
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/config-cache', () => ({
    getCachedProviderConfig: vi.fn().mockResolvedValue(null),
    setCachedProviderConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/encryption', () => ({ decryptApiKey: () => 'sk-test-byok' }));
vi.mock('@/lib/providers/custom-provider-routing', () => ({
    resolveCustomProviderForProject: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/providers/google-env', () => ({
    getGoogleApiKey: () => null,
}));

// Provider impls with pricing that succeeds for all realistic candidates.
// Only the sentinel `unpriced-model` fails, letting tests exercise the
// pricing-skip branch without enumerating every catalog id.
function pricedProvider() {
    return class {
        async getPricing(model: string) {
            if (model === 'unpriced-model') {
                throw Object.assign(new Error(`pricing_unavailable for ${model}`), {
                    name: 'PricingUnavailableError',
                });
            }
            return { input: 1, output: 2 };
        }
    };
}

// Mirror production: everything outside the four native providers rides the
// OpenAI-compatible wire format (see OPENAI_COMPATIBLE_ENDPOINTS). Mocking
// this as `false` would make BYOK registration fail for xai/deepseek/groq/
// mistral/cerebras/maximo/bai even with a valid key. (Defined inline: mock
// factories are hoisted and cannot reference top-level consts.)
vi.mock('@/lib/providers', () => ({
    OpenAIProvider: pricedProvider(),
    GeminiProvider: pricedProvider(),
    AnthropicProvider: pricedProvider(),
    OpenAICompatibleProvider: pricedProvider(),
    CohereProvider: pricedProvider(),
    isOpenAICompatible: (p: string) => !['openai', 'anthropic', 'google', 'cohere'].includes(p),
}));
vi.mock('@/lib/providers/openai', () => ({ OpenAIProvider: pricedProvider() }));
vi.mock('@/lib/providers/gemini', () => ({ GeminiProvider: pricedProvider() }));
vi.mock('@/lib/providers/anthropic', () => ({ AnthropicProvider: pricedProvider() }));
vi.mock('@/lib/providers/cohere', () => ({ CohereProvider: pricedProvider() }));
vi.mock('@/lib/providers/openai-compatible', () => ({
    OpenAICompatibleProvider: pricedProvider(),
    isOpenAICompatible: (p: string) => !['openai', 'anthropic', 'google', 'cohere'].includes(p),
}));

import { resolveGatewayProvider } from '@/lib/gateway/providers-setup';
import { ByokRequiredError } from '@/lib/gateway/auto-router';

function autoSupabase(opts: {
    dashboardKeys: Array<{ provider: string; default_model?: string | null }>;
    connections?: Array<{ provider: string }>;
}) {
    const dashboardRows = opts.dashboardKeys.map((k) => ({
        provider: k.provider,
        is_active: true,
        default_model: k.default_model ?? null,
    }));
    return {
        from: (table: string) => {
            if (table === 'provider_keys') {
                const chain: any = {
                    select: () => chain,
                    eq: () => chain,
                    maybeSingle: async () => {
                        // Resolve path: single dashboard row lookup. Return the
                        // first dashboard key (tests use single-provider setups).
                        if (dashboardRows.length === 0) return { data: null, error: null };
                        return {
                            data: {
                                encrypted_key: 'enc',
                                is_active: true,
                                default_model: dashboardRows[0].default_model ?? null,
                            },
                            error: null,
                        };
                    },
                    order: () => ({ limit: async () => ({ data: [], error: null }) }),
                    limit: async () => ({ data: [], error: null }),
                    // Inventory path awaits the chain directly.
                    then: (resolve: any) =>
                        resolve({ data: dashboardRows, error: null }),
                };
                return chain;
            }
            // provider_connections (inventory + embedded fallback)
            const connRows = (opts.connections ?? []).map((c) => ({
                ...c,
                status: 'active',
                base_url: null,
            }));
            const chain: any = {
                select: () => chain,
                eq: () => chain,
                is: () => chain,
                not: () => chain,
                order: () => ({ limit: async () => ({ data: connRows, error: null }) }),
                limit: async () => ({ data: connRows, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
                then: (resolve: any) => resolve({ data: connRows, error: null }),
            };
            return chain;
        },
    };
}

describe('resolveGatewayProvider auto-router (BYOK-only)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('resolves fast chat to a BYOK provider with byok billing', async () => {
        const resolved = await resolveGatewayProvider({
            supabase: autoSupabase({ dashboardKeys: [{ provider: 'openai' }] }) as never,
            projectId: 'project-1',
            organizationId: 'org-1',
            requestedModel: 'auto',
            allowedModels: null,
            sponsoredModels: null,
            autoRouterInput: { text: 'hi there', tools: null, hasImage: false },
        });
        expect(resolved.providerName).toBe('openai');
        expect(['gpt-4o-mini', 'gpt-4o']).toContain(resolved.model);
        expect(resolved.billingMode).toBe('byok');
        expect(resolved.byokOnly).toBe(true);
        expect(resolved.autoRouted?.task).toBe('fast');
    });

    it('routes code tasks to a code-capable BYOK model', async () => {
        const resolved = await resolveGatewayProvider({
            supabase: autoSupabase({ dashboardKeys: [{ provider: 'openai' }] }) as never,
            projectId: 'project-1',
            organizationId: 'org-1',
            requestedModel: 'cencori-auto',
            allowedModels: null,
            sponsoredModels: null,
            autoRouterInput: { text: '```python\ndef foo(): pass', tools: null, hasImage: false },
        });
        expect(resolved.autoRouted?.task).toBe('code');
        expect(resolved.billingMode).toBe('byok');
        expect(resolved.byokOnly).toBe(true);
    });

    it('fails closed with 402 when no BYOK keys exist', async () => {
        await expect(
            resolveGatewayProvider({
                supabase: autoSupabase({ dashboardKeys: [] }) as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                requestedModel: 'auto',
                allowedModels: null,
                sponsoredModels: null,
                autoRouterInput: { text: 'hi', tools: null, hasImage: false },
            }),
        ).rejects.toMatchObject({ code: 'byok_required' });
        try {
            await resolveGatewayProvider({
                supabase: autoSupabase({ dashboardKeys: [] }) as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                requestedModel: 'auto',
                allowedModels: null,
                sponsoredModels: null,
                autoRouterInput: { text: 'hi', tools: null, hasImage: false },
            });
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(ByokRequiredError);
            expect((error as ByokRequiredError).status).toBe(402);
        }
    });

    it('rejects pinned connections combined with auto as a 400', async () => {
        try {
            await resolveGatewayProvider({
                supabase: autoSupabase({ dashboardKeys: [{ provider: 'openai' }] }) as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                requestedModel: 'auto',
                allowedModels: null,
                sponsoredModels: null,
                pinnedConnectionId: 'prc_123',
                autoRouterInput: { text: 'hi', tools: null, hasImage: false },
            });
            expect.unreachable();
        } catch (error) {
            expect(error).toMatchObject({ name: 'InvalidRequestError' });
            const { mapProviderErrorToHttpResponse } = await import('@/lib/gateway-reliability');
            const failure = mapProviderErrorToHttpResponse(error, undefined, 'auto');
            expect(failure.status).toBe(400);
        }
    });

    it('lets Tensor policy own bare auto, but explicit cencori-auto stays BYOK', async () => {
        // Bare `auto` with a Tensor policy follows the Tensor server mapping
        // (deepseek-v4-flash), so it must NOT carry the BYOK auto marker.
        const tensorResolved = await resolveGatewayProvider({
            supabase: autoSupabase({ dashboardKeys: [{ provider: 'openai' }] }) as never,
            projectId: 'project-1',
            organizationId: 'org-1',
            requestedModel: 'auto',
            tensorModelPolicy: 'auto',
            allowedModels: null,
            sponsoredModels: null,
            autoRouterInput: { text: 'hi there', tools: null, hasImage: false },
        });
        expect(tensorResolved.autoRouted).toBeUndefined();
        expect(tensorResolved.byokOnly).toBeUndefined();

        // Explicit `cencori-auto` bypasses Tensor mapping and hits the BYOK
        // gate: no keys + Tensor policy still 402s.
        await expect(
            resolveGatewayProvider({
                supabase: autoSupabase({ dashboardKeys: [] }) as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                requestedModel: 'cencori-auto',
                tensorModelPolicy: 'auto',
                allowedModels: null,
                sponsoredModels: null,
                autoRouterInput: { text: 'hi', tools: null, hasImage: false },
            }),
        ).rejects.toMatchObject({ code: 'byok_required' });
    });

    it('serves fast chat from a single non-default BYOK provider via fallbacks', async () => {
        const resolved = await resolveGatewayProvider({
            supabase: autoSupabase({ dashboardKeys: [{ provider: 'xai' }] }) as never,
            projectId: 'project-1',
            organizationId: 'org-1',
            requestedModel: 'auto',
            allowedModels: null,
            sponsoredModels: null,
            autoRouterInput: { text: 'hi there', tools: null, hasImage: false },
        });
        expect(resolved.providerName).toBe('xai');
        expect(resolved.billingMode).toBe('byok');
        expect(resolved.byokOnly).toBe(true);
    });

    it('fails vision closed when the only BYOK key cannot see images', async () => {
        await expect(
            resolveGatewayProvider({
                supabase: autoSupabase({ dashboardKeys: [{ provider: 'cohere' }] }) as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                requestedModel: 'auto',
                allowedModels: null,
                sponsoredModels: null,
                autoRouterInput: { text: 'describe this', tools: null, hasImage: true },
            }),
        ).rejects.toMatchObject({ code: 'byok_required' });
    });
});
