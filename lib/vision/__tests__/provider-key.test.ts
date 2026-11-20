/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const balance = vi.hoisted(() => ({ value: 0 }));
vi.mock('@/lib/credits', () => ({ getCreditsBalance: vi.fn(async () => balance.value) }));
vi.mock('@/lib/encryption', () => ({ decryptApiKey: (value: string) => `plain:${value}` }));

import { ProviderKeyError, requireProviderKey, resolveModelAndKey } from '@/lib/vision/analyze';
import type { GatewayContext } from '@/lib/gateway-middleware';

type Keys = {
    /** Providers with a key saved in the console (provider_keys). */
    console?: string[];
    /** Providers with a key added through the API (provider_connections). */
    api?: string[];
};

/** A project with these keys. Remembers the provider each query filtered on. */
function ctxWith(keys: Keys, extra: Partial<GatewayContext> = {}): GatewayContext {
    const supabase = {
        from: (table: string) => {
            let provider = '';
            const rows = () => {
                if (table === 'provider_keys') {
                    return keys.console?.includes(provider) ? { encrypted_key: `console-${provider}`, is_active: true } : null;
                }
                if (table === 'provider_connections') {
                    return keys.api?.includes(provider)
                        ? [{ id: 'c1', provider, status: 'active', base_url: null, encrypted_key_ref: `api-${provider}`, created_at: '2026-01-01' }]
                        : [];
                }
                return null;
            };
            const query: Record<string, unknown> = {};
            for (const method of ['select', 'order', 'limit']) query[method] = () => query;
            query.eq = (column: string, value: string) => {
                if (column === 'provider') provider = value;
                return query;
            };
            query.maybeSingle = async () => ({ data: rows(), error: null });
            query.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows(), error: null });
            return query;
        },
    };
    return { supabase, projectId: 'project-1', organizationId: 'org-1', tier: 'free', ...extra } as unknown as GatewayContext;
}

describe('the key an image or document call runs on', () => {
    beforeEach(() => {
        balance.value = 0;
        vi.stubEnv('OPENAI_API_KEY', 'managed-openai');
    });
    afterEach(() => vi.unstubAllEnvs());

    it('uses the project\'s own key with an empty wallet, whichever way the key was added', async () => {
        expect(await requireProviderKey(ctxWith({ console: ['openai'] }), 'openai'))
            .toEqual({ key: 'plain:console-openai', usesByok: true });
        expect(await requireProviderKey(ctxWith({ api: ['openai'] }), 'openai'))
            .toEqual({ key: 'plain:api-openai', usesByok: true });
    });

    it('hands out Cencori\'s key only while there are credits', async () => {
        balance.value = 5;
        expect(await requireProviderKey(ctxWith({}), 'openai')).toEqual({ key: 'managed-openai', usesByok: false });

        balance.value = 0;
        const refusal = await requireProviderKey(ctxWith({}), 'openai', 'gpt-4o-mini').catch((error) => error);
        expect(refusal).toBeInstanceOf(ProviderKeyError);
        expect(refusal.code).toBe('credit_balance_exhausted');
        expect(refusal.status).toBe(403);
        expect(refusal.message).toContain('gpt-4o-mini runs on openai');

        // Enterprise is invoiced, not prepaid.
        expect(await requireProviderKey(ctxWith({}, { tier: 'enterprise' }), 'openai'))
            .toEqual({ key: 'managed-openai', usesByok: false });
    });

    it('reads an image on the key the project connected when no model is named', async () => {
        const google = await resolveModelAndKey(ctxWith({ console: ['google'] }), undefined);
        expect(google.model.key).toBe('gemini-2.5-flash');
        expect(google.providerKey).toEqual({ key: 'plain:console-google', usesByok: true });

        const anthropic = await resolveModelAndKey(ctxWith({ api: ['anthropic'] }), undefined);
        expect(anthropic.model.provider).toBe('anthropic');
        expect(anthropic.providerKey.usesByok).toBe(true);
    });

    it('keeps the usual default while it can be used', async () => {
        balance.value = 5;
        const funded = await resolveModelAndKey(ctxWith({ console: ['google'] }), undefined);
        expect(funded.model.key).toBe('gpt-4o-mini');
        expect(funded.providerKey.usesByok).toBe(false);
    });

    it('does not swap a model the request named for another', async () => {
        const refusal = await resolveModelAndKey(ctxWith({ console: ['google'] }), 'gpt-4o').catch((error) => error);
        expect(refusal).toBeInstanceOf(ProviderKeyError);
        expect(refusal.provider).toBe('openai');
    });
});
