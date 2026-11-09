/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const charged = vi.hoisted(() => ({ amounts: [] as number[], logs: [] as Array<Record<string, unknown>> }));
vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: vi.fn(async () => ({ success: true, context: { requestId: 'req_1' } })),
    addGatewayHeaders: (res: NextResponse) => res,
    logGatewayRequest: vi.fn(async (_ctx: unknown, entry: Record<string, unknown>) => { charged.logs.push(entry); }),
    incrementUsage: vi.fn(async (_ctx: unknown, cost: number) => { charged.amounts.push(cost); }),
}));

import { WEB_PRICES_USD, webCharge } from '@/lib/web/pricing';
import { runWebRoute } from '@/lib/web/http';
import { WebRuntimeError } from '@/lib/web/errors';
import { isMeteredGatewayRequest } from '@/lib/gateway/credit-policy';

const req = () => new NextRequest('http://localhost/api/v1/web/search', { method: 'POST', body: JSON.stringify({ query: 'x' }) });

describe('Cencori Web pricing', () => {
    beforeEach(() => { charged.amounts.length = 0; charged.logs.length = 0; });

    it('prices each billed endpoint and nothing else', () => {
        expect(webCharge('web/search')).toBe(WEB_PRICES_USD['web/search']);
        expect(webCharge('web/crawl', 10)).toBeCloseTo(WEB_PRICES_USD['web/crawl'] * 10, 9);
        expect(webCharge('web/takedown')).toBe(0);
        expect(webCharge('web/crawl', 0)).toBe(0);
    });

    it('charges a successful call and logs the charge', async () => {
        await runWebRoute(req(), 'web/search', async () => ({ body: { ok: true } }));
        expect(charged.amounts).toEqual([WEB_PRICES_USD['web/search']]);
        expect(charged.logs[0]).toMatchObject({ status: 'success', cencoriChargeUsd: WEB_PRICES_USD['web/search'] });
    });

    it('charges a crawl per page indexed', async () => {
        await runWebRoute(req(), 'web/crawl', async () => ({ body: {}, billableUnits: 7 }));
        expect(charged.amounts[0]).toBeCloseTo(WEB_PRICES_USD['web/crawl'] * 7, 9);
    });

    it('does not charge a failed call', async () => {
        const res = await runWebRoute(req(), 'web/search', async () => { throw new WebRuntimeError('invalid_query', 'query is required'); });
        expect(res.status).toBe(400);
        expect(charged.amounts).toEqual([]);
    });

    it('blocks billed web calls at a zero balance, but not takedown requests', () => {
        for (const path of ['search', 'fetch', 'extract', 'crawl']) {
            expect(isMeteredGatewayRequest('POST', `/api/v1/web/${path}`)).toBe(true);
        }
        expect(isMeteredGatewayRequest('POST', '/api/v1/web/takedown')).toBe(false);
    });
});
