/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import {
    CostGraphError,
    createCostGraphPlatformClient,
    createCostGraphPricingClient,
} from '@/lib/finops/costgraph';

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
    return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

describe('CostGraph clients', () => {
    it('authenticates each host the way it expects', async () => {
        const fetchImpl = vi.fn(async () => respond(200, { data: [], page: { has_more: false } }));

        await createCostGraphPricingClient('bl_key', fetchImpl as typeof fetch).listModelPrices();
        await createCostGraphPlatformClient('cg_key', fetchImpl as typeof fetch).pushFocus({
            connection_id: 'fpc_1', focus_version: '1.2', charge_period_start: 'a', charge_period_end: 'b', rows: [],
        });

        const [pricingUrl, pricingInit] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
        const [platformUrl, platformInit] = fetchImpl.mock.calls[1] as unknown as [URL, RequestInit];
        expect(String(pricingUrl)).toContain('pricing.baselinehq.cloud/v1/marketplace/models');
        expect((pricingInit.headers as Record<string, string>)['X-API-Key']).toBe('bl_key');
        expect(String(platformUrl)).toBe('https://api.costgraph.ai/api/v1/tenant/billing/focus');
        // CostGraph's docs say Bearer; the live platform rejects it with 401 and wants X-API-Key.
        expect((platformInit.headers as Record<string, string>)['X-API-Key']).toBe('cg_key');
        expect(platformInit.headers as Record<string, string>).not.toHaveProperty('Authorization');
    });

    it('follows the marketplace cursor to the end', async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(respond(200, { data: [{ id: '1' }], page: { has_more: true, next_cursor: 'c2' } }))
            .mockResolvedValueOnce(respond(200, { data: [{ id: '2' }], page: { has_more: false } }));
        const rows = await createCostGraphPricingClient('k', fetchImpl as typeof fetch).listModelPrices();
        expect(rows.map((r) => r.id)).toEqual(['1', '2']);
        expect(String((fetchImpl.mock.calls[1] as unknown as [URL])[0])).toContain('cursor=c2');
    });

    it('surfaces an RFC 9457 problem with its stable code, without retrying a client error', async () => {
        const fetchImpl = vi.fn(async () => respond(422, {
            type: 'https://docs.costgraph.ai/pricing/errors/validation_failed',
            title: 'Validation failed',
            status: 422,
            code: 'validation_failed',
            detail: 'One or more fields are invalid.',
            errors: [{ pointer: '/entries/0/unit_price_per_mtok', detail: 'must be >= 0' }],
        }));

        const error = await createCostGraphPricingClient('k', fetchImpl as typeof fetch)
            .publishModelPrices([])
            .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(CostGraphError);
        expect((error as CostGraphError).code).toBe('validation_failed');
        expect((error as CostGraphError).message).toContain('/entries/0/unit_price_per_mtok');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('retries a rate limit, honouring Retry-After', async () => {
        vi.useFakeTimers();
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(respond(429, { code: 'rate_limited', status: 429 }, { 'Retry-After': '1' }))
            .mockResolvedValueOnce(respond(200, { cost_per_hour: 0.01 }));
        const pending = createCostGraphPricingClient('k', fetchImpl as typeof fetch).priceMachine({
            provider: 'Base', service: 'BaseCompute', region: 'iad', vm: { cpu_cores: 1, ram_gb: 0.5 },
        });
        await vi.advanceTimersByTimeAsync(1_000);
        await expect(pending).resolves.toEqual({ cost_per_hour: 0.01 });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    /** A concurrent ingest on one connection is a 409 that clears on its own. */
    it('treats a busy connection as retryable but a price in use as final', () => {
        expect(new CostGraphError(409, { code: 'conflict' }, '').retryable).toBe(true);
        expect(new CostGraphError(409, { code: 'price_in_use' }, '').retryable).toBe(false);
        expect(new CostGraphError(401, { code: 'unauthenticated' }, '').retryable).toBe(false);
    });

    it('reads the platform\'s {message, status} error shape', async () => {
        const fetchImpl = vi.fn(async () => respond(404, { message: 'Could not find resource', status: 'error' }));
        const error = await createCostGraphPlatformClient('k', fetchImpl as typeof fetch).pushFocus({
            connection_id: 'fpc_x', focus_version: '1.2', charge_period_start: 'a', charge_period_end: 'b', rows: [],
        }).catch((e: unknown) => e);
        expect((error as CostGraphError).status).toBe(404);
        expect((error as CostGraphError).message).toContain('Could not find resource');
    });

    it('reads the deprecated routes\' plain error shape too', async () => {
        const fetchImpl = vi.fn(async () => respond(401, { error: 'unauthorized' }));
        const error = await createCostGraphPricingClient('k', fetchImpl as typeof fetch).listProviders().catch((e: unknown) => e);
        expect((error as CostGraphError).message).toContain('unauthorized');
    });
});
