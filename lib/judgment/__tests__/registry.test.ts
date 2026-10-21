/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJudgmentAdapter, getManagedJudgmentProviderNames, resolveJudgmentAdapter } from '../registry';

describe('judgment provider registry', () => {
    it('serves every catalog judgment model through the same route contract', () => {
        const typesafeIds = ['jev-latest', 'jev-preview', 'jev-1.13.0'];
        for (const id of typesafeIds) {
            const adapter = resolveJudgmentAdapter(id);
            expect(adapter.provider).toBe('typesafe');
            expect(typeof adapter.evaluate).toBe('function');
            expect(typeof adapter.price).toBe('function');
            expect(typeof adapter.resolveKey).toBe('function');
        }
    });

    it('serves Cloudflare Clef models through the cloudflare adapter', () => {
        for (const id of ['clef-latest', 'clef-flash', 'clef-omni']) {
            const adapter = resolveJudgmentAdapter(id);
            expect(adapter.provider).toBe('cloudflare');
            expect(adapter.managedEnvVar).toBe('CLOUDFLARE_API_TOKEN');
            expect(typeof adapter.evaluate).toBe('function');
            expect(typeof adapter.price).toBe('function');
            expect(typeof adapter.resolveKey).toBe('function');
        }
    });

    describe('managed judgment providers', () => {
        afterEach(() => vi.unstubAllEnvs());

        it('lists a vendor only when every managed env var is set', () => {
            vi.stubEnv('TYPESAFE_API_KEY', 'ts-key');
            vi.stubEnv('CLOUDFLARE_API_TOKEN', 'cf-token');
            vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
            expect([...getManagedJudgmentProviderNames()]).toEqual(['typesafe']);

            vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', 'acct');
            expect(getManagedJudgmentProviderNames()).toEqual(new Set(['typesafe', 'cloudflare']));
        });
    });

    it('fails closed on unknown ids', () => {
        expect(() => resolveJudgmentAdapter('gpt-5')).toThrowError(
            expect.objectContaining({ code: 'unknown_model' }),
        );
    });

    it('returns null for vendors with no adapter', () => {
        expect(getJudgmentAdapter('openai')).toBeNull();
        expect(getJudgmentAdapter('typesafe')?.provider).toBe('typesafe');
        expect(getJudgmentAdapter('cloudflare')?.provider).toBe('cloudflare');
    });
});
