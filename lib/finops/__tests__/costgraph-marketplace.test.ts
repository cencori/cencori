/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
    bucketRates,
    planMarketplaceSync,
    syncModelPrices,
    toMarketplaceRows,
    type CatalogueEntry,
} from '@/lib/finops/costgraph-marketplace';
import type { CostGraphPricingClient, ModelPrice } from '@/lib/finops/costgraph';

const sonnet: CatalogueEntry = {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    pricing: {
        inputPer1KTokens: 0.003,
        outputPer1KTokens: 0.015,
        cachedInputPer1KTokens: 0.0003,
        cacheWriteMultiplier: 1.25,
        cencoriMarkupPercentage: 0,
    },
};

const gpt: CatalogueEntry = {
    provider: 'openai',
    model: 'gpt-6',
    pricing: { inputPer1KTokens: 0.00125, outputPer1KTokens: 0.01, cencoriMarkupPercentage: 0 },
};

describe('bucketRates', () => {
    it('converts per-1K rates to per-million without float noise', () => {
        expect(bucketRates(sonnet.pricing)).toEqual({ input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 });
    });

    /**
     * The gateway bills an unpriced cache read at the input rate and a write with no premium as
     * input, so publishing exactly that is what keeps CostGraph's numbers equal to our invoices.
     */
    it('publishes what the gateway bills when a cache rate is not stored', () => {
        expect(bucketRates(gpt.pricing)).toEqual({ input: 1.25, output: 10, cache_read: 1.25, cache_write: 1.25 });
    });
});

describe('toMarketplaceRows', () => {
    it('publishes all four buckets for every model, under the cencori host', () => {
        const rows = toMarketplaceRows([sonnet, gpt]);
        expect(rows).toHaveLength(8);
        expect(new Set(rows.map((r) => r.token_bucket))).toEqual(new Set(['input', 'output', 'cache_read', 'cache_write']));
        expect(rows.every((r) => r.host === 'cencori' && r.region === 'global' && r.currency === 'USD')).toBe(true);
    });

    /**
     * CostGraph keys a price on (model, host, region, bucket) without the provider, so the same model
     * sold through two upstreams must publish under different names or one overwrites the other.
     */
    it('keeps the same model from two upstreams apart', () => {
        const viaGroq: CatalogueEntry = { provider: 'groq', model: 'openai/gpt-oss-120b', pricing: { inputPer1KTokens: 0.00015, outputPer1KTokens: 0.0006, cencoriMarkupPercentage: 0 } };
        const viaVercel: CatalogueEntry = { ...viaGroq, provider: 'vercel', pricing: { inputPer1KTokens: 0.00035, outputPer1KTokens: 0.00075, cencoriMarkupPercentage: 0 } };
        const names = new Set(toMarketplaceRows([viaGroq, viaVercel]).map((r) => r.model));
        expect(names).toEqual(new Set(['groq/openai/gpt-oss-120b', 'vercel/openai/gpt-oss-120b']));
    });

    /** Each of these was rejected by the live API (400 or 500); CostGraph sets them itself. */
    it('sends only fields CostGraph accepts on write', () => {
        for (const row of toMarketplaceRows([sonnet])) {
            for (const field of ['model_id', 'source', 'source_url', 'effective_from']) {
                expect(row, field).not.toHaveProperty(field);
            }
            expect(row.tags).toMatchObject({ cencori_model: 'anthropic/claude-sonnet-5' });
        }
    });

    it('flags long-context tiers it cannot represent', () => {
        const rows = toMarketplaceRows([{ ...gpt, pricing: { ...gpt.pricing, longContextThresholdTokens: 272_000 } }]);
        expect(rows[0].tags).toMatchObject({ long_context_threshold_tokens: 272_000, long_context_not_published: true });
    });
});

describe('planMarketplaceSync', () => {
    const desired = toMarketplaceRows([sonnet]);
    const published = (overrides: Partial<ModelPrice> = {}): ModelPrice[] =>
        desired.map((row, i) => ({ ...row, id: `id_${i}`, ...overrides }));

    it('writes nothing when the catalogue is unchanged', () => {
        const plan = planMarketplaceSync(desired, published());
        expect(plan).toMatchObject({ create: [], update: [], unchanged: 4, stale: [] });
    });

    it('patches only the buckets whose price moved', () => {
        const live = published();
        live[1] = { ...live[1], unit_price_per_mtok: 12 }; // output was 12, now 15
        const plan = planMarketplaceSync(desired, live);
        expect(plan.update).toEqual([{ id: 'id_1', from: 12, row: desired[1] }]);
        expect(plan.unchanged).toBe(3);
    });

    it('reports models no longer sold, and ignores retired versions and other hosts', () => {
        const extra: ModelPrice = { ...desired[0], model: 'anthropic/claude-old', id: 'old' };
        const retired: ModelPrice = { ...desired[0], id: 'v1', effective_to: '2026-09-01T00:00:00Z', unit_price_per_mtok: 99 };
        const otherHost: ModelPrice = { ...desired[0], model: 'x', host: 'someone-else', id: 'x' };
        const plan = planMarketplaceSync(desired, [...published(), extra, retired, otherHost]);
        expect(plan.stale.map((r) => r.id)).toEqual(['old']);
        expect(plan.update).toEqual([]);
    });
});

describe('syncModelPrices', () => {
    function client(published: ModelPrice[] = []) {
        return {
            listModelPrices: vi.fn(async () => published),
            publishModelPrices: vi.fn(async () => ({})),
            patchModelPrice: vi.fn(async () => ({})),
            deleteModelPrice: vi.fn(async () => undefined),
        };
    }

    it('changes nothing on a dry run', async () => {
        const c = client();
        const result = await syncModelPrices({ client: c as unknown as CostGraphPricingClient, catalogue: [sonnet], dryRun: true });
        expect(result).toMatchObject({ dryRun: true, created: 4 });
        expect(c.publishModelPrices).not.toHaveBeenCalled();
    });

    it('publishes new rows and prunes only when asked', async () => {
        const stale: ModelPrice = { ...toMarketplaceRows([gpt])[0], id: 'gone' };
        const c = client([stale]);
        const result = await syncModelPrices({ client: c as unknown as CostGraphPricingClient, catalogue: [sonnet] });
        expect(c.publishModelPrices).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ created: 4, stale: 1, pruned: 0 });
        expect(c.deleteModelPrice).not.toHaveBeenCalled();

        await syncModelPrices({ client: c as unknown as CostGraphPricingClient, catalogue: [sonnet], prune: true });
        expect(c.deleteModelPrice).toHaveBeenCalledWith('gone');
    });
});
