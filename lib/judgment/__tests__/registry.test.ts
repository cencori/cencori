/** @vitest-environment node */
import { describe, expect, it } from 'vitest';
import { getJudgmentAdapter, resolveJudgmentAdapter } from '../registry';

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
