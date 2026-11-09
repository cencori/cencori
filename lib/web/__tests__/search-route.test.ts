/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const state = vi.hoisted(() => ({ allowed: true, charged: [] as number[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/gateway-middleware', () => ({
    handleCorsPreFlight: vi.fn(),
    validateGatewayRequest: vi.fn(async () => ({ success: true, context: { requestId: 'r', projectId: 'p1', tier: 'free' } })),
    addGatewayHeaders: (res: NextResponse) => res,
    logGatewayRequest: vi.fn(async () => {}),
    incrementUsage: vi.fn(async (_ctx: unknown, cost: number) => { state.charged.push(cost); }),
}));
vi.mock('@/lib/web/live-search', () => ({
    takeWebSearchSlot: vi.fn(async () => ({ allowed: state.allowed, remaining: 0, reset: Date.now() + 30_000, limit: 5 })),
    liveWebSearch: vi.fn(async () => [{ title: 'A', url: 'https://a.test', canonicalUrl: 'https://a.test', snippet: '' }]),
}));

import { POST } from '@/app/api/v1/web/search/route';

const call = () => POST(new NextRequest('http://localhost/api/v1/web/search', { method: 'POST', body: JSON.stringify({ query: 'x' }) }));

describe('POST /v1/web/search', () => {
    it('searches and charges within the allowance', async () => {
        state.allowed = true; state.charged.length = 0;
        const res = await call();
        expect(res.status).toBe(200);
        expect(state.charged).toHaveLength(1);
    });

    it('returns 429 with retry details over the per-minute allowance, and charges nothing', async () => {
        state.allowed = false; state.charged.length = 0;
        const res = await call();
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body).toMatchObject({ error: 'rate_limited', details: { limit: 5 } });
        expect(body.details.retry_after_seconds).toBeGreaterThan(0);
        expect(state.charged).toEqual([]);
    });
});
