/**
 * Publish Cencori's model rates to CostGraph's pricing marketplace.
 *
 * CostGraph prices AI usage from a rate catalogue. Publishing ours under `host: "cencori"` means any
 * CostGraph customer whose traffic runs through Cencori is priced at what Cencori actually charges,
 * per token bucket, rather than at a list price for a different host.
 *
 * Mapping (per model, one marketplace row per bucket, `unit_price_per_mtok` = per-1K rate × 1000):
 *   - input        → `input_price_per_1k_tokens`
 *   - output       → `output_price_per_1k_tokens`
 *   - cache_read   → `cached_input_price_per_1k_tokens`, or the input rate when unset — the gateway
 *                    bills an unpriced cache read at the input rate, so that is the honest rate
 *   - cache_write  → input rate × the provider's cache-write multiplier (Anthropic 1.25×), else
 *                    the input rate
 * Every bucket is published because CostGraph treats a missing bucket as "no price", not zero.
 *
 * Not representable in CostGraph's schema, and so left out (noted in each row's tags):
 *   - long-context tiers — CostGraph has no request-size dimension; the base tier is published;
 *   - Anthropic's 1-hour cache-write premium (2×) — the 5-minute rate is the one the gateway uses.
 *
 * The sync is a diff: unchanged rows are left alone, changed rows are PATCHed (which versions them,
 * so the history of what we charged survives — a re-POST would overwrite the row in place), and rows
 * for models no longer sold are reported and removed only with `prune`.
 */

import type { ModelPricing } from '@/lib/providers/base';
import type { CostGraphPricingClient, ModelPrice, TokenBucket } from './costgraph';

export const CENCORI_HOST = 'cencori';
export const CENCORI_REGION = 'global';
const PUBLISH_CHUNK = 200;
/** Rates are compared at this precision (USD per million tokens). */
const PRICE_EPSILON = 1e-9;

export interface CatalogueEntry {
    provider: string;
    model: string;
    pricing: ModelPricing;
}

const BUCKETS: TokenBucket[] = ['input', 'output', 'cache_read', 'cache_write'];

function perMillion(per1k: number): number {
    // Round away float noise from ×1000 (0.0003 * 1000 = 0.30000000000000004).
    return Math.round(per1k * 1000 * 1e9) / 1e9;
}

export function bucketRates(pricing: ModelPricing): Record<TokenBucket, number> {
    const input = pricing.inputPer1KTokens;
    return {
        input: perMillion(input),
        output: perMillion(pricing.outputPer1KTokens),
        cache_read: perMillion(pricing.cachedInputPer1KTokens ?? input),
        cache_write: perMillion(input * (pricing.cacheWriteMultiplier ?? 1)),
    };
}

/** The `model` Cencori publishes under: unique per upstream, and equal to the FOCUS SkuId. */
export function marketplaceModelName(provider: string, model: string): string {
    return `${provider}/${model}`;
}

function priceKey(provider: string | undefined, model: string, region: string | undefined, bucket: string): string {
    return [provider ?? '', model, region ?? '', bucket].join('|');
}

/**
 * The rows to publish. Only fields CostGraph accepts on write are sent — verified live 2026-10-14:
 *   - `model_id` is rejected with 400 (it expects CostGraph's own id), so ours rides in `tags`;
 *   - `source` / `source_url` are set by CostGraph (`marketplace`, `marketplace://<org>`), and
 *     sending them for an existing row fails with 500;
 *   - `effective_from` fails with 500; CostGraph stamps it on write.
 *
 * `model` is `provider/model`, the same string as the FOCUS `SkuId`. CostGraph keys a model price on
 * (model, host, region, bucket) — not provider — and Cencori sells some models through more than
 * one upstream at different prices (gpt-oss via Groq and Vercel). With the bare model name the
 * second upstream silently overwrote the first (observed live on the first publish).
 */
export function toMarketplaceRows(entries: CatalogueEntry[]): ModelPrice[] {
    const rows: ModelPrice[] = [];
    for (const { provider, model, pricing } of entries) {
        const rates = bucketRates(pricing);
        const tags: Record<string, unknown> = { cencori_model: `${provider}/${model}`, source_url: 'https://cencori.com/models' };
        if (pricing.longContextThresholdTokens !== undefined) {
            tags.long_context_threshold_tokens = pricing.longContextThresholdTokens;
            tags.long_context_not_published = true;
        }
        for (const bucket of BUCKETS) {
            rows.push({
                model: marketplaceModelName(provider, model),
                provider,
                publisher: provider,
                host: CENCORI_HOST,
                region: CENCORI_REGION,
                token_bucket: bucket,
                unit_price_per_mtok: rates[bucket],
                currency: 'USD',
                tags,
            });
        }
    }
    return rows;
}

export interface MarketplacePlan {
    create: ModelPrice[];
    update: Array<{ id: string; from: number; row: ModelPrice }>;
    unchanged: number;
    stale: ModelPrice[];
}

/** Compare what Cencori bills now with what is published. Pure, for dry runs and tests. */
export function planMarketplaceSync(desired: ModelPrice[], published: ModelPrice[]): MarketplacePlan {
    const live = new Map<string, ModelPrice>();
    for (const row of published) {
        if (row.host && row.host !== CENCORI_HOST) continue;
        if (row.effective_to) continue; // a retired version
        live.set(priceKey(row.provider, row.model, row.region, row.token_bucket), row);
    }

    const plan: MarketplacePlan = { create: [], update: [], unchanged: 0, stale: [] };
    const wanted = new Set<string>();
    for (const row of desired) {
        const key = priceKey(row.provider, row.model, row.region, row.token_bucket);
        wanted.add(key);
        const existing = live.get(key);
        if (!existing) {
            plan.create.push(row);
        } else if (Math.abs((existing.unit_price_per_mtok ?? 0) - row.unit_price_per_mtok) > PRICE_EPSILON) {
            if (existing.id) plan.update.push({ id: existing.id, from: existing.unit_price_per_mtok, row });
            else plan.create.push(row);
        } else {
            plan.unchanged += 1;
        }
    }
    for (const [key, row] of live) {
        if (!wanted.has(key)) plan.stale.push(row);
    }
    return plan;
}

export interface MarketplaceSyncResult {
    dryRun: boolean;
    created: number;
    updated: number;
    unchanged: number;
    stale: number;
    pruned: number;
    changes: Array<{ model: string; bucket: string; from: number | null; to: number }>;
}

export async function syncModelPrices(params: {
    client: CostGraphPricingClient;
    catalogue: CatalogueEntry[];
    dryRun?: boolean;
    prune?: boolean;
}): Promise<MarketplaceSyncResult> {
    const desired = toMarketplaceRows(params.catalogue);
    const published = await params.client.listModelPrices({ region: CENCORI_REGION });
    const plan = planMarketplaceSync(desired, published);

    const result: MarketplaceSyncResult = {
        dryRun: Boolean(params.dryRun),
        created: plan.create.length,
        updated: plan.update.length,
        unchanged: plan.unchanged,
        stale: plan.stale.length,
        pruned: 0,
        changes: [
            ...plan.create.map((row) => ({ model: row.model, bucket: row.token_bucket, from: null, to: row.unit_price_per_mtok })),
            ...plan.update.map((u) => ({ model: u.row.model, bucket: u.row.token_bucket, from: u.from, to: u.row.unit_price_per_mtok })),
        ],
    };
    if (params.dryRun) return result;

    for (let i = 0; i < plan.create.length; i += PUBLISH_CHUNK) {
        await params.client.publishModelPrices(plan.create.slice(i, i + PUBLISH_CHUNK));
    }
    for (const update of plan.update) {
        // A patch closes the old version and opens a new one with a new id (verified live).
        await params.client.patchModelPrice(update.id, { unit_price_per_mtok: update.row.unit_price_per_mtok });
    }
    if (params.prune) {
        for (const row of plan.stale) {
            if (!row.id) continue;
            await params.client.deleteModelPrice(row.id);
            result.pruned += 1;
        }
    }
    return result;
}
