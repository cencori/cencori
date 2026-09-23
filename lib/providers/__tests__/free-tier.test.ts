import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';
import { isExplicitlyFree } from '../pricing';
import { ProviderRouter } from '../router';

/**
 * The free tier was retired 2026-09-23: every `free: true` catalog row and
 * every free-models.ts entry was deleted, and `isExplicitlyFree` permanently
 * returns false. These tests guard the new invariant, so a promo re-added
 * casually (a flag here, an entry there) fails CI instead of silently
 * resurrecting a tier with no quota behind it.
 *
 * History: Groq's compound/mini 404'd, the B.AI GLM-5.3 Flash promo ended with
 * the account at zero credits, OpenRouter's `:free` pool was capped at 50
 * req/day account-wide — and 2026-09-23 OpenRouter left as a provider entirely.
 * See free-models.ts for the full removal list.
 */
describe('retired free model tier', () => {
    const router = new ProviderRouter();

    it('lists no free models in the catalog', () => {
        const free = SUPPORTED_PROVIDERS.flatMap((provider) =>
            provider.models
                .filter((model) => model.free)
                .map((model) => `${provider.id}:${model.id}`)
        );

        expect(free).toEqual([]);
    });

    it('resolves no catalog model to zero-price static pricing', () => {
        for (const provider of SUPPORTED_PROVIDERS) {
            for (const model of provider.models) {
                expect(
                    isExplicitlyFree(provider.id, model.id),
                    `${provider.id}:${model.id}`
                ).toBe(false);
            }
        }
    });

    it('does not advertise retired promos as free', () => {
        expect(isExplicitlyFree('centaur', 'centaur')).toBe(false);
        expect(isExplicitlyFree('centaur', 'julian-origin')).toBe(false);
        expect(isExplicitlyFree('bai', 'glm-5.3-flash')).toBe(false);
        expect(isExplicitlyFree('zai', 'glm-5.3-flash')).toBe(false);
        expect(isExplicitlyFree('groq', 'groq/compound')).toBe(false);
        expect(router.normalizeModelName('centaur', 'centaur')).toBe('julian-origin');
    });
});
