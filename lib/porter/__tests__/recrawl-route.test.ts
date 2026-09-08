/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), refresh: vi.fn() }));
vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/porter/knowledge', () => ({
    refreshPorterKnowledge: mocks.refresh,
    PorterRefreshError: class extends Error {},
}));

import { POST } from '@/app/api/cron/porter-recrawl/route';

const summary = { checked: 1, changed: 0, unchanged: 1, failed: 0, deferred: 0 };
const porter = (id: number) => ({
    id: `porter-${id}`, project_id: `project-${id}`, organization_id: 'org-1',
    source_url: `https://example${id}.com`, lease_token: `lease-${id}`,
});
const request = (secret = 'cron-test') => new NextRequest('https://cencori.com/api/cron/porter-recrawl', {
    method: 'POST', headers: { Authorization: `Bearer ${secret}` },
});

function claims(count: number) {
    let next = 1;
    mocks.rpc.mockImplementation(async (method: string) => method === 'claim_porter_recrawl'
        ? { data: next <= count ? [porter(next++)] : [], error: null }
        : { data: true, error: null });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-test';
    mocks.refresh.mockResolvedValue(summary);
    claims(0);
});

describe('Porter recrawl cron', () => {
    it('refuses unauthenticated runs before claiming work', async () => {
        expect((await POST(request('wrong'))).status).toBe(401);
        expect(mocks.rpc).not.toHaveBeenCalled();
    });

    it('finishes an idle sweep without fetching sites', async () => {
        const response = await POST(request());
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ porters: 0, refreshed: 0, failed: 0 });
        expect(mocks.refresh).not.toHaveBeenCalled();
    });

    it('claims at most 20 Porters and passes every processed ID back as an exclusion', async () => {
        claims(25);
        const response = await POST(request());
        expect(await response.json()).toMatchObject({ porters: 20, refreshed: 20, failed: 0 });
        const claimCalls = mocks.rpc.mock.calls.filter(([method]) => method === 'claim_porter_recrawl');
        const releaseCalls = mocks.rpc.mock.calls.filter(([method]) => method === 'finish_porter_recrawl');
        expect(claimCalls).toHaveLength(20);
        expect(releaseCalls).toHaveLength(20);
        expect(claimCalls[19][1].p_exclude_ids).toEqual(Array.from({ length: 19 }, (_, i) => `porter-${i + 1}`));
        expect(releaseCalls[0][1]).toMatchObject({ p_porter_id: 'porter-1', p_lease_token: 'lease-1', p_summary: summary });
    });

    it('claims just in time and stops when the first site uses the work budget', async () => {
        claims(25);
        const start = Date.now();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
        mocks.refresh.mockImplementationOnce(async () => {
            clock.mockReturnValue(start + 240_000);
            return summary;
        });
        try {
            const response = await POST(request());
            expect(await response.json()).toMatchObject({ porters: 1, deadlineReached: true });
            expect(mocks.rpc.mock.calls.map(([method]) => method)).toEqual(['claim_porter_recrawl', 'finish_porter_recrawl']);
            expect(mocks.refresh).toHaveBeenCalledWith(expect.anything(), porter(1), undefined, { deadlineMs: start + 240_000 });
        } finally {
            clock.mockRestore();
        }
    });

    it('releases failed work, attempts the next site, and returns an error status', async () => {
        claims(2);
        mocks.refresh.mockRejectedValueOnce(new Error('database unavailable'));
        const response = await POST(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ porters: 2, refreshed: 1, failed: 1 });
        expect(mocks.rpc).toHaveBeenCalledWith('finish_porter_recrawl', expect.objectContaining({
            p_porter_id: 'porter-1', p_lease_token: 'lease-1', p_error: 'database unavailable',
        }));
    });

    it('returns an error status and persists the summary when some pages fail', async () => {
        claims(1);
        mocks.refresh.mockResolvedValueOnce({ ...summary, unchanged: 0, failed: 1 });
        const response = await POST(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ results: [{ checked: 1, failed: 1 }] });
        expect(mocks.rpc).toHaveBeenCalledWith('finish_porter_recrawl', expect.objectContaining({
            p_summary: expect.objectContaining({ failed: 1 }), p_error: '1 page(s) could not be refreshed',
        }));
    });

    it('reports claim failures to the scheduler', async () => {
        mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database unavailable' } });
        const response = await POST(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ porters: 0, errors: ['claim_failed'] });
    });

    it.each([
        { data: false, error: null },
        { data: null, error: { message: 'database unavailable' } },
    ])('reports failed lease releases: %j', async release => {
        let claimed = false;
        mocks.rpc.mockImplementation(async (method: string) => {
            if (method === 'finish_porter_recrawl') return release;
            if (claimed) return { data: [], error: null };
            claimed = true;
            return { data: [porter(1)], error: null };
        });
        const response = await POST(request());
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ results: [{ release_error: 'release_failed' }] });
    });
});
