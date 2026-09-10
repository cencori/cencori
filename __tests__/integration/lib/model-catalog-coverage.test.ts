/**
 * Model catalog coverage guard.
 *
 * A model added to lib/providers/config.ts is not actually usable until it also
 * has an active model_pricing row — getPricingFromDB fails closed, so an unpriced
 * model returns 503 `pricing_unavailable` at inference and is reported
 * `available: false` by GET /v1/models. Nothing used to connect those two facts,
 * so models were shipped into the catalog and quietly never worked; by
 * 2026-08-17 that had accumulated to 35 of 97 catalog entries.
 *
 * This test is the connection. Adding a model to the catalog without pricing now
 * fails CI instead of failing silently in production.
 *
 * KNOWN_UNPRICED is the existing debt, enumerated so it can only shrink. Do not
 * add to it to make a build pass — add the pricing row instead. The only correct
 * reasons to extend it are the ones already listed: the provider publishes no
 * flat token rate, or the model should be deleted from the catalog rather than
 * priced.
 */

import { describe, it, expect } from 'vitest';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { isExplicitlyFree } from '@/lib/providers/pricing';
import { getTestSupabaseClient } from '../utils/db-helpers';

/**
 * Catalog entries known to have no pricing row, with the reason each one is
 * tolerated. Every entry here is a model users cannot call.
 */
const KNOWN_UNPRICED: Record<string, string> = {
    // Groq bills these as agentic systems via the underlying models they invoke
    // and publishes no flat token rate, so any figure would be invented.
    'groq:groq/compound': 'no flat token rate published',
    'groq:groq/compound-mini': 'no flat token rate published',
    // Alive, not dead: re-checked on 2026-09-10 and Groq answered normally (in
    // Arabic). The previous note here claimed it was no longer offered and
    // should be deleted, which was wrong — it needs a pricing row, not removal.
    'groq:allam-2-7b': 'served by Groq but no pricing row yet',

    // Image generation is billed per image, not per token. These need per-image
    // pricing support before they can be advertised as callable.
    'openai:gpt-image-2': 'per-image billing not modelled',
    'openai:gpt-image-1.5': 'per-image billing not modelled',
    'openai:gpt-image-1': 'per-image billing not modelled',
    'google:gemini-3.1-flash-image': 'per-image billing not modelled',
    'google:gemini-3-pro-image': 'per-image billing not modelled',

    // Absent from both of Mistral's pricing pages. A devstral-medium-2507 rate
    // exists but is a different model id than the -latest alias in the catalog.
    'mistral:devstral-latest': 'no published rate for this alias',
};

async function loadActivelyPricedModels(): Promise<Set<string>> {
    const supabase = getTestSupabaseClient();
    const { data, error } = await supabase
        .from('model_pricing')
        .select('provider, model_name, pricing_expires_at, next_input_price_per_1k_tokens, next_output_price_per_1k_tokens')
        .eq('is_active', true);

    if (error) throw new Error(`Could not read model_pricing: ${error.message}`);

    // Mirrors the availability rule in app/api/v1/models/route.ts: a lapsed
    // promotional rate still counts as priced when it carries the follow-on rate
    // it switches to, because that is a scheduled changeover, not a gap.
    return new Set(
        (data ?? [])
            .filter((row) =>
                !row.pricing_expires_at
                || Date.parse(row.pricing_expires_at) > Date.now()
                || (row.next_input_price_per_1k_tokens != null
                    && row.next_output_price_per_1k_tokens != null))
            .map((row) => `${row.provider}:${row.model_name}`)
    );
}

describe('model catalog pricing coverage', () => {
    it('prices every catalog model except the enumerated known gaps', async () => {
        const priced = await loadActivelyPricedModels();

        const unpriced = SUPPORTED_PROVIDERS
            .flatMap((provider) => provider.models.map((model) => ({
                key: `${provider.id}:${model.id}`,
                provider: provider.id,
                model: model.id,
            })))
            .filter(({ key, provider, model }) =>
                !priced.has(key) && !isExplicitlyFree(provider, model))
            .map(({ key }) => key);

        const unexpected = unpriced.filter((key) => !(key in KNOWN_UNPRICED));

        expect(
            unexpected,
            `These catalog models have no active model_pricing row, so they return 503 `
            + `pricing_unavailable and are reported available: false by GET /v1/models. `
            + `Add a pricing row rather than adding them to KNOWN_UNPRICED:\n`
            + unexpected.map((key) => `  - ${key}`).join('\n')
        ).toEqual([]);
    });

    it('has no stale KNOWN_UNPRICED entries', async () => {
        const priced = await loadActivelyPricedModels();
        const catalogKeys = new Set(
            SUPPORTED_PROVIDERS.flatMap((provider) =>
                provider.models.map((model) => `${provider.id}:${model.id}`))
        );

        // An entry that is now priced, or no longer in the catalog at all, is
        // dead weight — left in place it silently excuses a future regression on
        // the same id.
        const stale = Object.keys(KNOWN_UNPRICED)
            .filter((key) => priced.has(key) || !catalogKeys.has(key));

        expect(
            stale,
            `These KNOWN_UNPRICED entries are obsolete (now priced, or gone from the `
            + `catalog) and should be deleted from the list:\n`
            + stale.map((key) => `  - ${key}`).join('\n')
        ).toEqual([]);
    });

    it('does not advertise a model whose provider has no route', async () => {
        // A catalog entry under a provider that neither has an OpenAI-compatible
        // endpoint nor a first-class client cannot be called by any code path.
        const { OPENAI_COMPATIBLE_ENDPOINTS } = await import('@/lib/providers/openai-compatible');
        const FIRST_CLASS_PROVIDERS = new Set(['openai', 'anthropic', 'google', 'cohere']);

        const unroutable = SUPPORTED_PROVIDERS
            .filter((provider) => provider.models.length > 0)
            .filter((provider) =>
                !(provider.id in OPENAI_COMPATIBLE_ENDPOINTS)
                && !FIRST_CLASS_PROVIDERS.has(provider.id))
            .map((provider) => provider.id);

        expect(unroutable, `Providers with models but no route: ${unroutable.join(', ')}`)
            .toEqual([]);
    });
});
