import { describe, expect, it } from 'vitest';
import { resolveCustomProviderMatchFromRows, type CustomProviderLookupRow } from '@/lib/providers/custom-provider-routing';

const baseProviders: CustomProviderLookupRow[] = [
    {
        id: 'provider-1',
        name: 'azure-gpt',
        base_url: 'https://example.azure.com/v1',
        api_format: 'openai',
        encrypted_api_key: 'encrypted',
        custom_models: [
            { model_name: 'gpt-4o-enterprise', is_active: true },
            { model_name: 'gpt-4o-mini-enterprise', is_active: true },
        ],
    },
    {
        id: 'provider-2',
        name: 'internal-claude',
        base_url: 'https://example.anthropic-proxy.com',
        api_format: 'anthropic',
        encrypted_api_key: 'encrypted',
        custom_models: [
            { model_name: 'claude-3-7-sonnet-custom', is_active: true },
        ],
    },
];

describe('resolveCustomProviderMatchFromRows', () => {
    it('matches by exact custom model name', () => {
        const result = resolveCustomProviderMatchFromRows(baseProviders, 'gpt-4o-enterprise');

        expect(result).not.toBeNull();
        expect(result?.id).toBe('provider-1');
        expect(result?.matchedBy).toBe('model');
        expect(result?.upstreamModel).toBe('gpt-4o-enterprise');
    });

    it('matches by provider name alias and maps to first active model', () => {
        const result = resolveCustomProviderMatchFromRows(baseProviders, 'azure-gpt');

        expect(result).not.toBeNull();
        expect(result?.id).toBe('provider-1');
        expect(result?.matchedBy).toBe('provider_name');
        expect(result?.upstreamModel).toBe('gpt-4o-enterprise');
    });

    it('matches provider/model prefix and routes using suffix model', () => {
        const result = resolveCustomProviderMatchFromRows(baseProviders, 'azure-gpt/gpt-4o-mini-enterprise');

        expect(result).not.toBeNull();
        expect(result?.id).toBe('provider-1');
        expect(result?.matchedBy).toBe('provider_prefix');
        expect(result?.upstreamModel).toBe('gpt-4o-mini-enterprise');
    });

    it('returns null when there is no match', () => {
        const result = resolveCustomProviderMatchFromRows(baseProviders, 'gpt-4o');
        expect(result).toBeNull();
    });
});

