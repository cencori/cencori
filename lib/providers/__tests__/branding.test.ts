import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS } from '../config';
import {
    publicFailureMessage,
    publicProviderDisplayName,
    publicProviderLabel,
} from '../branding';
import { ServiceUnavailableError } from '../errors';
import { mapProviderErrorToHttpResponse } from '@/lib/gateway-reliability';

describe('public provider identity', () => {
    it('brands every catalog model with its real vendor', () => {
        // The free tier (retired 2026-09-23) used to relabel Cencori-served
        // models; with nothing free, the public label must always equal the
        // routing provider — a mismatch would strand the row in the wrong
        // provider filter.
        const relabelled = SUPPORTED_PROVIDERS.flatMap((provider) =>
            provider.models
                .filter((model) => publicProviderLabel(provider.id, model.id) !== provider.id)
                .map((model) => `${provider.id}:${model.id}`)
        );

        expect(relabelled).toEqual([]);
    });

    it('leaves paid models attributed to their real vendor', () => {
        expect(publicProviderLabel('openai', 'gpt-5')).toBe('openai');
        expect(publicProviderLabel('anthropic', 'claude-opus-5')).toBe('anthropic');
        // The paid twin of a free listing must not inherit the branding.
        expect(publicProviderLabel('groq', 'openai/gpt-oss-20b')).toBe('groq');
    });

    it('still reports the real provider on an error for a paid model', () => {
        const failure = mapProviderErrorToHttpResponse(
            new ServiceUnavailableError('anthropic'), undefined, 'claude-opus-5'
        );
        expect(failure.provider).toBe('anthropic');
    });

    it('leaves the failover aggregate intact for paid models', () => {
        const aggregate =
            'All providers exhausted. Primary (openrouter): [openrouter] 429. '
            + 'Fallback attempts: [anthropic: credit balance is too low]';

        expect(publicFailureMessage(aggregate, 'openai', 'gpt-5')).toBe(aggregate);
    });

    it('shows the vendor display name for every catalog model', () => {
        // The console catalog and playground both build their provider column
        // from these two helpers. With the free tier retired, the display name
        // must always be the vendor's own — never a white-label.
        for (const provider of SUPPORTED_PROVIDERS) {
            for (const model of provider.models) {
                expect(
                    publicProviderDisplayName(provider.id, provider.name, model.id),
                    `${provider.id}/${model.id}`
                ).toBe(provider.name);
            }
        }
    });

    it('keeps a provider visible for its paid models', () => {
        // Groq serves paid models and must stay in the catalog's provider
        // filter. OpenRouter was removed 2026-09-23 and must be fully gone —
        // a leftover row would strand in a filter with nothing behind it.
        const listed = SUPPORTED_PROVIDERS.map(p => p.id);
        expect(listed).toContain('groq');
        expect(listed).not.toContain('openrouter');
        const stillListed = SUPPORTED_PROVIDERS.filter(p =>
            p.models.some(m => publicProviderLabel(p.id, m.id) === p.id)
        ).map(p => p.id);
        expect(stillListed).toContain('groq');
    });

    it('advertises no catalog row as free', () => {
        // The rows are gone; this catches leftover "free" copy promising what
        // billing no longer honours.
        for (const provider of SUPPORTED_PROVIDERS) {
            for (const model of provider.models) {
                const text = `${model.name} ${model.description ?? ''}`.toLowerCase();
                expect(text, `${model.id} name/description`).not.toContain('free');
            }
        }
    });
});
