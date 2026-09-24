/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/providers/custom-provider-routing', () => ({
    resolveCustomProviderForProject: vi.fn().mockResolvedValue(null),
}));

import { isMeteredGatewayRequest, isProvenByokRequest } from '@/lib/gateway/credit-policy';

function providerKeyClient(active: boolean) {
    return {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        eq: () => ({
                            maybeSingle: async () => ({
                                data: active ? { encrypted_key: 'encrypted', is_active: true } : null,
                                error: null,
                            }),
                        }),
                    }),
                }),
            }),
        }),
    };
}

describe('gateway credit policy', () => {
    it('gates inference without blocking control-plane reads or cancellation', () => {
        expect(isMeteredGatewayRequest('POST', '/api/v1/chat/completions')).toBe(true);
        expect(isMeteredGatewayRequest('POST', '/api/v1/agents/a/runs')).toBe(true);
        expect(isMeteredGatewayRequest('POST', '/api/memory/search')).toBe(true);
        expect(isMeteredGatewayRequest('GET', '/api/v1/runs/r')).toBe(false);
        expect(isMeteredGatewayRequest('POST', '/api/v1/runs/r/cancel')).toBe(false);
        expect(isMeteredGatewayRequest('POST', '/api/v1/agents')).toBe(false);
    });

    it('allows zero-balance chat only for the selected active BYOK provider', async () => {
        const req = new NextRequest('http://localhost/api/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
        });
        const base = {
            req, projectId: 'project-1', organizationId: 'org-1', defaultModel: null,
        };
        expect(await isProvenByokRequest({ ...base, supabase: providerKeyClient(true) as never }))
            .toBe(true);
        expect(await isProvenByokRequest({ ...base, supabase: providerKeyClient(false) as never }))
            .toBe(false);
    });

    it('fails closed for an agent-scoped call whose stored model may override the body', async () => {
        const req = new NextRequest('http://localhost/api/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
        });
        expect(await isProvenByokRequest({
            req,
            supabase: providerKeyClient(true) as never,
            projectId: 'project-1', organizationId: 'org-1', defaultModel: null,
            agentId: 'agent-1',
        })).toBe(false);
    });

    it('recognizes the actual default vision provider and image model aliases', async () => {
        const base = {
            projectId: 'project-1', organizationId: 'org-1', defaultModel: null,
            supabase: providerKeyClient(true) as never,
        };
        const vision = new NextRequest('http://localhost/api/ai/vision', {
            method: 'POST', body: JSON.stringify({ image: { url: 'https://example.com/image.png' } }),
        });
        expect(await isProvenByokRequest({ ...base, req: vision })).toBe(true);
        const image = new NextRequest('http://localhost/api/ai/images/generate', {
            method: 'POST', body: JSON.stringify({ model: 'nano-banana-pro', prompt: 'A cat' }),
        });
        expect(await isProvenByokRequest({ ...base, req: image })).toBe(true);
    });
});
