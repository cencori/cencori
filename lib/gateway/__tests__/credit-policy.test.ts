/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/providers/custom-provider-routing', () => ({
    resolveCustomProviderForProject: vi.fn().mockResolvedValue(null),
}));

import { isMeteredGatewayRequest, isProvenByokRequest } from '@/lib/gateway/credit-policy';

type Fake = {
    /** A key saved in the console (provider_keys). */
    consoleKey?: boolean;
    /** A key added through the API (provider_connections). */
    connection?: boolean;
    session?: { agent_id: string | null; installation_id: string | null } | null;
};

/** Answers each table the policy reads; filters are accepted and ignored. */
function fakeDb(fake: Fake) {
    const rows = (table: string): unknown => {
        if (table === 'provider_keys') return fake.consoleKey ? { encrypted_key: 'encrypted', is_active: true } : null;
        if (table === 'sessions') return fake.session ?? null;
        if (table === 'provider_connections') {
            return fake.connection
                ? [{ id: 'c1', provider: 'openai', status: 'active', base_url: null, encrypted_key_ref: 'encrypted', created_at: '2026-01-01' }]
                : [];
        }
        return null;
    };
    return {
        from: (table: string) => {
            const query: Record<string, unknown> = {};
            for (const method of ['select', 'eq', 'order', 'limit']) query[method] = () => query;
            query.maybeSingle = async () => ({ data: rows(table), error: null });
            query.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows(table), error: null });
            return query;
        },
    };
}

function providerKeyClient(active: boolean) {
    return fakeDb({ consoleKey: active });
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

    it('counts a key added through the API, not only one saved in the console', async () => {
        const req = new NextRequest('http://localhost/api/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({ model: 'gpt-4o', messages: [] }),
        });
        expect(await isProvenByokRequest({
            req, supabase: fakeDb({ connection: true }) as never,
            projectId: 'project-1', organizationId: 'org-1', defaultModel: null,
        })).toBe(true);
    });

    it('allows a zero-balance session turn on the project\'s own key', async () => {
        const turn = () => new NextRequest('http://localhost/api/v1/sessions/s1/turns', {
            method: 'POST',
            body: JSON.stringify({ model: 'gpt-4o', input: 'hi' }),
        });
        const base = { projectId: 'project-1', organizationId: 'org-1', defaultModel: null };
        const plain = { agent_id: null, installation_id: null };
        expect(await isProvenByokRequest({ ...base, req: turn(), supabase: fakeDb({ consoleKey: true, session: plain }) as never }))
            .toBe(true);
        expect(await isProvenByokRequest({ ...base, req: turn(), supabase: fakeDb({ session: plain }) as never }))
            .toBe(false);
        // A stored agent's model overrides the body, and another project's session is not ours to judge.
        expect(await isProvenByokRequest({ ...base, req: turn(), supabase: fakeDb({ consoleKey: true, session: { agent_id: 'a1', installation_id: null } }) as never }))
            .toBe(false);
        expect(await isProvenByokRequest({ ...base, req: turn(), supabase: fakeDb({ consoleKey: true, session: null }) as never }))
            .toBe(false);
    });
});
