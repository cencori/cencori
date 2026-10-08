/**
 * Vision capability guard.
 *
 * A model tagged `vision` in the catalog is advertised as accepting images, but
 * image requests don't go down the normal chat pipeline — `/v1/chat/completions`
 * hands them to the vision layer, which resolves the model against its own
 * registry and throws `Unknown vision model` for anything it doesn't know.
 *
 * So a `vision` tag with no vision-layer entry is a promise the gateway breaks
 * at request time. Maximo Atlas was exactly that until the OpenAI-compatible
 * vision path landed. This test connects the two lists so the next one fails CI
 * instead of failing a customer.
 */

import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '@/lib/providers/config';
import { listVisionModels, VISION_PROVIDER_LIMITS, OPENAI_COMPATIBLE_VISION_PROVIDERS } from '../analyze';
import { upgradeModelForVision } from '@/lib/gateway/chat-vision-router';

/**
 * Catalog entries tagged `vision` that the vision layer cannot serve, with the
 * reason each is tolerated. Do not add to this to make a build pass — register
 * the model in VISION_MODELS instead, or drop the tag.
 */
const KNOWN_UNROUTABLE: Record<string, string> = {
    // Tagged vision before the OpenAI-compatible vision path existed. Cerebras
    // is on the OpenAI wire format so the mechanism would cover it, but the
    // account is unfunded — every model returns 402 payment_required as of
    // 2026-08-20 — so image support still cannot be verified against the live
    // model, and an unverified capability claim is the bug this file exists to
    // catch. Register it once the account is funded and an image round-trips.
    'cerebras:gemma-4-31b': 'image support unverified — account unfunded (402)',
};

function visionTaggedCatalogModels(): Array<{ key: string; id: string }> {
    const tagged: Array<{ key: string; id: string }> = [];
    for (const provider of SUPPORTED_PROVIDERS) {
        for (const model of provider.models) {
            const types = Array.isArray(model.type) ? model.type : [model.type];
            if (types.includes('vision')) {
                tagged.push({ key: `${provider.id}:${model.id}`, id: model.id });
            }
        }
    }
    return tagged;
}

describe('vision capability coverage', () => {
    it('routes every vision-tagged catalog model, or documents why not', () => {
        const routable = new Set(listVisionModels().map((model) => model.id));

        const unroutable = visionTaggedCatalogModels()
            .filter(({ id }) => !routable.has(id))
            .map(({ key }) => key)
            .filter((key) => !(key in KNOWN_UNROUTABLE));

        expect(unroutable).toEqual([]);
    });

    it('registers Atlas 1.2 against the Maximo provider', () => {
        const byId = new Map(listVisionModels().map((model) => [model.id, model.provider]));

        expect(byId.get('maximo-atlas-1.2')).toBe('maximo');
    });

    it('declares image limits for every OpenAI-compatible vision provider', () => {
        // VISION_PROVIDER_LIMITS drives validateImageForProvider. A provider
        // missing from it would throw on the first image it was handed.
        for (const provider of OPENAI_COMPATIBLE_VISION_PROVIDERS) {
            const limits = VISION_PROVIDER_LIMITS[provider];
            expect(limits.formats.length).toBeGreaterThan(0);
            expect(limits.maxBytes).toBeGreaterThan(0);
        }
    });

    it('does not "upgrade" Atlas to another provider on an image request', () => {
        // Before this was in VISION_CAPABLE_PATTERNS, Atlas fell through to the
        // unknown-provider branch. It survived by accident; now it's explicit.
        expect(upgradeModelForVision('maximo-atlas-1.2')).toEqual({ model: 'maximo-atlas-1.2', upgraded: false });
    });

    it('keeps image requests on vision-capable chat models', () => {
        // Every id here takes image input upstream. Before their patterns were
        // added, GPT-5/6 and o-series requests were downgraded to gpt-4o-mini
        // and newer Claudes fell to the family fallback (claude-3-5-sonnet).
        for (const id of [
            'claude-opus-5-5',
            'claude-sonnet-5-5',
            'claude-haiku-5-5',
            'claude-fable-5-1',
            'claude-mythos-5-1',
            'gpt-5.5',
            'gpt-6-sol',
            'gpt-6.1-sol',
            'gpt-4.1',
            'o3',
            'o4-mini',
            'mistral-large-4-0',
            'mistral-large-latest',
        ]) {
            expect(upgradeModelForVision(id)).toEqual({ model: id, upgraded: false });
        }
    });

    it('still upgrades models without confirmed image support', () => {
        // Haiku 4.5 keeps its deliberate Sonnet upgrade — the haiku pattern
        // above is scoped to 5.5 precisely so this keeps working.
        expect(upgradeModelForVision('claude-haiku-4-5')).toEqual({
            model: 'claude-sonnet-4-6',
            upgraded: true,
            from: 'claude-haiku-4-5',
        });
    });
});
