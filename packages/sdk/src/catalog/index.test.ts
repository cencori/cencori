import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    listCatalogModels,
    listCatalogProviders,
    providerLogoUrl,
    DEFAULT_CATALOG_BASE_URL,
} from './index';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('catalog', () => {
    it('lists models with filters as query params', async () => {
        const spy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
                object: 'list',
                data: [{
                    id: 'gpt-5',
                    object: 'model',
                    name: 'GPT-5',
                    provider: 'openai',
                    provider_name: 'OpenAI',
                    provider_logo_url: `${DEFAULT_CATALOG_BASE_URL}/api/providers/openai/logo`,
                    owned_by: 'openai',
                    type: 'chat',
                    types: ['chat'],
                    context_window: 400000,
                    context_display: '400K',
                    pricing: {
                        input_per_million: 5,
                        output_per_million: 15,
                        currency: 'USD',
                        input_display: '$5.00',
                        output_display: '$15.00',
                        per_image: false,
                        per_image_usd: null,
                    },
                    added_at: '2025-08-07',
                    created: 1754524800,
                }],
                providers: [],
                total: 1,
                distinct_model_ids: 1,
                updated_at: '2026-10-01T00:00:00.000Z',
            }), { status: 200 }),
        );

        const res = await listCatalogModels({ provider: 'openai', capability: ['tools', 'code'] });

        expect(spy).toHaveBeenCalledOnce();
        const url = String(spy.mock.calls[0]?.[0]);
        expect(url).toBe(
            `${DEFAULT_CATALOG_BASE_URL}/api/models?provider=openai&capability=tools&capability=code`,
        );
        expect(res.total).toBe(1);
        expect(res.data[0]?.provider_logo_url).toBe(providerLogoUrl('openai'));
    });

    it('lists providers', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response(JSON.stringify({
                object: 'list',
                data: [{
                    id: 'openai',
                    name: 'OpenAI',
                    icon: '/providers/openai.svg',
                    icon_url: `${DEFAULT_CATALOG_BASE_URL}/providers/openai.svg`,
                    logo_url: providerLogoUrl('openai'),
                    website: 'https://openai.com',
                    docs_url: 'https://platform.openai.com/docs',
                    model_count: 32,
                }],
                total: 1,
                updated_at: '2026-10-01T00:00:00.000Z',
            }), { status: 200 }),
        );

        const res = await listCatalogProviders();
        expect(res.total).toBe(1);
        expect(res.data[0]?.logo_url).toBe(`${DEFAULT_CATALOG_BASE_URL}/api/providers/openai/logo`);
    });

    it('builds logo urls against a custom base', () => {
        expect(providerLogoUrl('xai', 'https://staging.example.com/')).toBe(
            'https://staging.example.com/api/providers/xai/logo',
        );
    });

    it('throws a readable error on non-2xx', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(
            new Response('oops', { status: 500 }),
        );
        await expect(listCatalogModels()).rejects.toThrow('Catalog request failed (500');
    });
});
