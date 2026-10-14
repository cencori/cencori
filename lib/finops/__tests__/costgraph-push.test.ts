/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { daysToPush, monthToRestate, pushWindow } from '@/lib/finops/costgraph-push';
import type { CostGraphPlatformClient } from '@/lib/finops/costgraph';
import type { UsageRollupRow } from '@/lib/finops/focus';

describe('daysToPush', () => {
    it('sends only yesterday once caught up', () => {
        expect(daysToPush('2026-10-12', new Date('2026-10-14T04:17:00Z'))).toEqual(['2026-10-13']);
    });

    it('sends nothing twice in a day', () => {
        expect(daysToPush('2026-10-13', new Date('2026-10-14T23:00:00Z'))).toEqual([]);
    });

    it('starts a new connection at the first of the month', () => {
        const days = daysToPush(null, new Date('2026-10-04T04:00:00Z'));
        expect(days).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
    });

    it('starts a new connection on the 1st with the whole previous month', () => {
        const days = daysToPush(null, new Date('2026-11-01T04:00:00Z'));
        expect(days[0]).toBe('2026-10-01');
        expect(days.at(-1)).toBe('2026-10-31');
    });

    it('caps how far back an outage catches up', () => {
        const days = daysToPush('2026-01-01', new Date('2026-10-14T04:00:00Z'));
        expect(days).toHaveLength(35);
        expect(days.at(-1)).toBe('2026-10-13');
    });
});

describe('monthToRestate', () => {
    it('waits until the month has had time to close', () => {
        expect(monthToRestate(null, new Date('2026-10-02T04:00:00Z'))).toBeNull();
    });

    it('re-sends the previous month once, from the 3rd', () => {
        const now = new Date('2026-10-03T04:00:00Z');
        expect(monthToRestate('2026-08-01', now)).toEqual({ start: '2026-09-01', end: '2026-10-01' });
        expect(monthToRestate('2026-09-01', now)).toBeNull();
    });

    it('crosses the year boundary', () => {
        expect(monthToRestate(null, new Date('2027-01-05T00:00:00Z'))).toEqual({ start: '2026-12-01', end: '2027-01-01' });
    });
});

function rollupRow(i: number): UsageRollupRow {
    return {
        day: '2026-10-13', project_id: 'p1', project_name: 'P', environment: 'production',
        provider: 'openai', model: `m${i}`, endpoint_family: 'chat', sub_account_id: 'p1',
        requests: 1, prompt_tokens: 10, completion_tokens: 1, total_tokens: 11,
        cache_read_tokens: null, cache_write_tokens: null, uncached_prompt_tokens: 10,
        unsplit_requests: 0, charge_usd: 0.01, provider_cost_usd: 0.01,
    };
}

/** A stand-in for the RPC over `total` rollup rows, paged the way focus_usage_daily pages. */
function fakeSupabase(total: number) {
    const rows = Array.from({ length: total }, (_, i) => rollupRow(i));
    return {
        rpc: vi.fn(async (_name: string, args: { p_limit: number; p_offset: number }) => ({
            data: {
                rows: rows.slice(args.p_offset, args.p_offset + args.p_limit),
                has_more: args.p_offset + args.p_limit < rows.length,
            },
            error: null,
        })),
    };
}

function fakeClient() {
    const pushFocus = vi.fn(async () => ({}));
    return { client: { pushFocus } as unknown as CostGraphPlatformClient, pushFocus };
}

const base = {
    organization: { id: 'org_1', name: 'Acme' },
    projectIds: ['p1'],
    connectionId: 'fpc_123',
    subAccount: 'project' as const,
    start: '2026-10-13',
    end: '2026-10-14',
};

describe('pushWindow', () => {
    it('replaces the window in one request when it fits', async () => {
        const { client, pushFocus } = fakeClient();
        const result = await pushWindow({ ...base, supabase: fakeSupabase(3) as never, client });

        expect(result).toMatchObject({ rows: 3, pages: 1 });
        const [body] = pushFocus.mock.calls[0] as unknown as [Record<string, unknown>];
        expect(body).toMatchObject({
            connection_id: 'fpc_123',
            complete: true,
            row_offset: 0,
            focus_version: '1.2',
            charge_period_start: '2026-10-13T00:00:00.000Z',
            charge_period_end: '2026-10-14T00:00:00.000Z',
        });
    });

    /**
     * Only the first page may clear the window; later pages append under the same batch, addressed
     * by their offset, so a retried page rewrites itself and never wipes the pages after it.
     */
    it('pages a large window under one batch, clearing it only once', async () => {
        const { client, pushFocus } = fakeClient();
        const result = await pushWindow({ ...base, supabase: fakeSupabase(5) as never, client, pageSize: 2 });

        expect(result).toMatchObject({ rows: 5, pages: 3 });
        const bodies = pushFocus.mock.calls.map((call) => (call as unknown as [Record<string, unknown>])[0]);
        expect(bodies.map((b) => b.complete)).toEqual([true, undefined, undefined]);
        expect(bodies.map((b) => b.row_offset)).toEqual([0, 2, 4]);
        expect(new Set(bodies.map((b) => b.batch_id)).size).toBe(1);
        expect(bodies.map((b) => (b.rows as unknown[]).length)).toEqual([2, 2, 1]);
    });

    /** CostGraph refuses complete=true with no rows, because it would silently clear the window. */
    it('sends nothing for a day with no usage', async () => {
        const { client, pushFocus } = fakeClient();
        const result = await pushWindow({ ...base, supabase: fakeSupabase(0) as never, client });

        expect(result.skipped).toBe('empty');
        expect(pushFocus).not.toHaveBeenCalled();
    });
});
