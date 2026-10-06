/** @vitest-environment node */
import { describe, expect, it } from 'vitest';

import {
    ByokRequiredError,
    BYOK_REQUIRED_CODE,
    BYOK_REQUIRED_STATUS,
    candidatesForTask,
    classifyAutoTask,
    formatByokSetupHint,
    getActiveByokInventory,
    isAutoRouterModel,
} from '@/lib/gateway/auto-router';

describe('isAutoRouterModel', () => {
    it('accepts auto, cencori-auto, and cencori/auto (case-insensitive)', () => {
        expect(isAutoRouterModel('auto')).toBe(true);
        expect(isAutoRouterModel('AUTO')).toBe(true);
        expect(isAutoRouterModel('cencori-auto')).toBe(true);
        expect(isAutoRouterModel('Cencori-Auto')).toBe(true);
        expect(isAutoRouterModel('cencori/auto')).toBe(true);
        expect(isAutoRouterModel('  auto  ')).toBe(true);
    });

    it('rejects concrete models and empty input', () => {
        expect(isAutoRouterModel('gpt-4o')).toBe(false);
        expect(isAutoRouterModel('claude-sonnet-4-6')).toBe(false);
        expect(isAutoRouterModel('tensor-auto')).toBe(false);
        expect(isAutoRouterModel('')).toBe(false);
        expect(isAutoRouterModel(null)).toBe(false);
        expect(isAutoRouterModel(undefined)).toBe(false);
    });
});

describe('classifyAutoTask', () => {
    it('routes image input to vision', () => {
        expect(classifyAutoTask({ text: 'hello', hasImage: true })).toBe('vision');
    });

    it('routes code signals to code', () => {
        expect(classifyAutoTask({ text: '```python\ndef foo(): pass' })).toBe('code');
        expect(classifyAutoTask({ text: 'please refactor this function' })).toBe('code');
        expect(classifyAutoTask({ text: 'fix bug in console.log statement' })).toBe('code');
    });

    it('routes long/analytical prompts to reasoning', () => {
        expect(classifyAutoTask({ text: 'prove the theorem step by step' })).toBe('reasoning');
        expect(classifyAutoTask({ text: 'x'.repeat(2500) })).toBe('reasoning');
    });

    it('routes tool calls to code by default, reasoning when analytical', () => {
        expect(classifyAutoTask({ text: 'hello', tools: [{ type: 'function' }] })).toBe('code');
        expect(
            classifyAutoTask({ text: 'analyze deeply step by step', tools: [{ type: 'function' }] }),
        ).toBe('reasoning');
    });

    it('defaults short chat to fast', () => {
        expect(classifyAutoTask({ text: 'hi there' })).toBe('fast');
        expect(classifyAutoTask({})).toBe('fast');
    });
});

describe('candidatesForTask', () => {
    it('returns BYOK-capable candidates for every task', () => {
        for (const task of ['vision', 'code', 'reasoning', 'fast', 'embed', 'image', 'speech'] as const) {
            const candidates = candidatesForTask(task);
            expect(candidates.length).toBeGreaterThan(0);
            for (const c of candidates) {
                expect(c.provider).toBeTruthy();
                expect(c.model).toBeTruthy();
            }
        }
    });

    it('prefers cheap models for fast and frontier for code/reasoning', () => {
        expect(candidatesForTask('fast')[0].model).toBe('gemini-2.5-flash-lite');
        expect(candidatesForTask('vision')[0]).toEqual({
            provider: 'openai',
            model: 'gpt-4o-mini',
        });
    });

    it('prefers cheap embedding, quality image, and low-latency speech models', () => {
        expect(candidatesForTask('embed')[0]).toEqual({
            provider: 'openai',
            model: 'text-embedding-3-small',
        });
        expect(candidatesForTask('image')[0]).toEqual({
            provider: 'openai',
            model: 'gpt-image-1',
        });
        expect(candidatesForTask('speech')[0]).toEqual({
            provider: 'openai',
            model: 'tts-1',
        });
    });
});

describe('resolveAutoModelForTask', () => {
    it('resolves the first verifiable BYOK candidate for embed', async () => {
        const { resolveAutoModelForTask } = await import('@/lib/gateway/auto-router');
        const resolved = await resolveAutoModelForTask({
            supabase: inventoryClient({
                providerKeys: [{ provider: 'OpenAI' }],
                connections: [],
            }) as never,
            projectId: 'project-1',
            task: 'embed',
            verify: async () => undefined,
        });
        expect(resolved.provider).toBe('openai');
        expect(resolved.model).toBe('text-embedding-3-small');
        expect(resolved.task).toBe('embed');
    });

    it('skips candidates whose pricing check fails', async () => {
        const { resolveAutoModelForTask } = await import('@/lib/gateway/auto-router');
        const seen: string[] = [];
        const resolved = await resolveAutoModelForTask({
            supabase: inventoryClient({
                providerKeys: [{ provider: 'openai' }, { provider: 'google' }],
                connections: [],
            }) as never,
            projectId: 'project-1',
            task: 'embed',
            verify: async (_provider, model) => {
                seen.push(model);
                if (model === 'text-embedding-3-small') throw new Error('pricing_unavailable');
            },
        });
        expect(resolved.model).toBe('text-embedding-3-large');
        expect(seen).toContain('text-embedding-3-small');
    });

    it('fails closed with 402 when no BYOK keys exist', async () => {
        const { resolveAutoModelForTask } = await import('@/lib/gateway/auto-router');
        await expect(
            resolveAutoModelForTask({
                supabase: inventoryClient({ providerKeys: [], connections: [] }) as never,
                projectId: 'project-1',
                task: 'image',
            }),
        ).rejects.toMatchObject({ code: 'byok_required' });
    });

    it('fails closed with 402 when no candidate verifies', async () => {
        const { resolveAutoModelForTask } = await import('@/lib/gateway/auto-router');
        await expect(
            resolveAutoModelForTask({
                supabase: inventoryClient({
                    providerKeys: [{ provider: 'openai' }],
                    connections: [],
                }) as never,
                projectId: 'project-1',
                task: 'speech',
                verify: async () => {
                    throw new Error('pricing_unavailable');
                },
            }),
        ).rejects.toMatchObject({ code: 'byok_required' });
    });
});

function inventoryClient(opts: {
    providerKeys: Array<{ provider: string; is_active?: boolean; default_model?: string | null }>;
    connections: Array<{ provider: string; status?: string; base_url?: string | null }>;
}) {
    return {
        from: (table: string) => {
            if (table === 'provider_keys') {
                return {
                    select: () => ({
                        eq: () => ({
                            eq: async () => ({ data: opts.providerKeys, error: null }),
                        }),
                    }),
                };
            }
            return {
                select: () => ({
                    eq: () => ({
                        eq: async () => ({ data: opts.connections, error: null }),
                    }),
                }),
            };
        },
    };
}

describe('getActiveByokInventory', () => {
    it('unions dashboard keys and embedded connections, skipping proxies', async () => {
        const inv = await getActiveByokInventory(
            inventoryClient({
                providerKeys: [
                    { provider: 'OpenAI', default_model: 'gpt-4o' },
                    { provider: 'google' },
                ],
                connections: [
                    { provider: 'anthropic', status: 'active', base_url: null },
                    { provider: 'openai', status: 'active', base_url: 'https://proxy.example.com' },
                ],
            }) as never,
            'project-1',
        );
        expect([...inv.providers].sort()).toEqual(['anthropic', 'google', 'openai']);
        expect(inv.defaultModels.get('openai')).toBe('gpt-4o');
    });

    it('returns empty inventory when no keys exist', async () => {
        const inv = await getActiveByokInventory(
            inventoryClient({ providerKeys: [], connections: [] }) as never,
            'project-1',
        );
        expect(inv.providers.size).toBe(0);
        expect(formatByokSetupHint(inv.providers)).toMatch(/Add your own/);
    });
});

describe('ByokRequiredError', () => {
    it('carries the 402 byok_required contract', () => {
        const err = new ByokRequiredError();
        expect(err.code).toBe(BYOK_REQUIRED_CODE);
        expect(err.status).toBe(BYOK_REQUIRED_STATUS);
        expect(err.message).toMatch(/BYOK key/);
    });
});

describe('error mapping', () => {
    it('maps ByokRequiredError to HTTP 402', async () => {
        const { mapProviderErrorToHttpResponse } = await import('@/lib/gateway-reliability');
        const failure = mapProviderErrorToHttpResponse(new ByokRequiredError('need key'), undefined, 'auto');
        expect(failure.status).toBe(402);
        expect(failure.error).toBe('byok_required');
        expect(failure.message).toBe('need key');
    });
});

describe('credit preflight bypass for auto', () => {
    it('defers auto to the BYOK gate instead of the generic credit block', async () => {
        const { NextRequest } = await import('next/server');
        const { isProvenByokRequest } = await import('@/lib/gateway/credit-policy');
        const req = new NextRequest('http://localhost/api/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ model: 'auto', messages: [] }),
        });
        // No supabase calls should be needed: auto always bypasses so the
        // 402 `byok_required` gate (not 403 credit-exhausted) decides.
        const supabase = { from: () => { throw new Error('should not query'); } };
        expect(
            await isProvenByokRequest({
                req,
                supabase: supabase as never,
                projectId: 'project-1',
                organizationId: 'org-1',
                defaultModel: null,
            }),
        ).toBe(true);
    });

    it('defers auto to the BYOK gate on embeddings/images/audio paths', async () => {
        const { NextRequest } = await import('next/server');
        const { isProvenByokRequest } = await import('@/lib/gateway/credit-policy');
        const supabase = { from: () => { throw new Error('should not query'); } };
        for (const pathname of ['/api/ai/embeddings', '/api/ai/images/generate', '/api/ai/audio/speech']) {
            const req = new NextRequest(`http://localhost${pathname}`, {
                method: 'POST',
                body: JSON.stringify({ model: 'cencori-auto', input: 'hi', prompt: 'hi' }),
            });
            expect(
                await isProvenByokRequest({
                    req,
                    supabase: supabase as never,
                    projectId: 'project-1',
                    organizationId: 'org-1',
                    defaultModel: null,
                }),
            ).toBe(true);
        }
    });
});
