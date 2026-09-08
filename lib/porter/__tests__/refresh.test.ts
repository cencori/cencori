/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetch: vi.fn(), extract: vi.fn(), index: vi.fn(), reschedule: vi.fn(),
    queryError: null as { message: string } | null,
    scheduleError: null as { message: string } | null,
    due: [] as Array<{ id: string; canonical_url: string; content: string }>,
}));
vi.mock('@/lib/web/crawl', () => ({ crawlWeb: vi.fn() }));
vi.mock('@/lib/web/store', () => ({ createWebDataStore: () => ({}) }));
vi.mock('@/lib/web/fetch', () => ({ fetchWebResource: mocks.fetch }));
vi.mock('@/lib/web/html', () => ({ extractWebDocument: mocks.extract }));
vi.mock('@/lib/web/index', () => ({ indexWebDocument: mocks.index }));
vi.mock('@/lib/web/sitemap', () => ({ parseSitemap: vi.fn() }));

import { PorterRefreshError, refreshPorterKnowledge } from '@/lib/porter/knowledge';

function client() {
    return {
        from: () => {
            let id = '';
            let update: unknown;
            const builder = {
                select: () => builder,
                eq: (field: string, value: string) => { if (field === 'id') id = value; return builder; },
                not: () => builder,
                lte: () => builder,
                order: () => builder,
                limit: async () => ({ data: mocks.due, error: mocks.queryError }),
                update: (value: unknown) => { update = value; return builder; },
                then: (resolve: (value: unknown) => unknown) => {
                    mocks.reschedule(id, update);
                    return Promise.resolve({ error: mocks.scheduleError }).then(resolve);
                },
            };
            return builder;
        },
    } as unknown as Parameters<typeof refreshPorterKnowledge>[0];
}

const porter = { id: 'porter-1', project_id: 'project-1', organization_id: 'org-1' };

beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryError = null;
    mocks.scheduleError = null;
    mocks.due = [1, 2, 3].map(i => ({ id: `page-${i}`, canonical_url: `https://example.com/${i}`, content: 'Original page text' }));
    mocks.fetch.mockResolvedValue({});
    mocks.extract.mockReturnValue({ content: 'Original page text' });
    mocks.index.mockResolvedValue({});
});

describe('refreshPorterKnowledge scheduling', () => {
    it('propagates failed due-page queries instead of reporting an idle site', async () => {
        mocks.queryError = { message: 'database unavailable' };
        await expect(refreshPorterKnowledge(client(), porter)).rejects.toMatchObject({
            name: 'PorterRefreshError', message: 'Could not list due Porter pages: database unavailable',
            summary: { checked: 0 },
        });
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.reschedule).not.toHaveBeenCalled();
    });

    it('reschedules unchanged pages without indexing them again', async () => {
        const summary = await refreshPorterKnowledge(client(), porter);
        expect(summary).toEqual({ checked: 3, changed: 0, unchanged: 3, failed: 0, deferred: 0 });
        expect(mocks.index).not.toHaveBeenCalled();
        expect(mocks.reschedule.mock.calls.map(([id]) => id)).toEqual(['page-1', 'page-2', 'page-3']);
    });

    it('leaves unprocessed page deadlines untouched when the time budget ends', async () => {
        const start = Date.now();
        const clock = vi.spyOn(Date, 'now').mockReturnValue(start);
        mocks.fetch.mockImplementationOnce(async () => {
            clock.mockReturnValue(start + 1000);
            return {};
        });
        try {
            const summary = await refreshPorterKnowledge(client(), porter, undefined, { deadlineMs: start + 1000 });
            expect(summary).toMatchObject({ checked: 1, unchanged: 1, deferred: 2 });
            expect(mocks.fetch).toHaveBeenCalledTimes(1);
            expect(mocks.reschedule.mock.calls.map(([id]) => id)).toEqual(['page-1']);
        } finally {
            clock.mockRestore();
        }
    });

    it('does not fetch or reschedule any page after an already elapsed deadline', async () => {
        const summary = await refreshPorterKnowledge(client(), porter, undefined, { deadlineMs: Date.now() - 1 });
        expect(summary).toMatchObject({ checked: 0, deferred: 3 });
        expect(mocks.fetch).not.toHaveBeenCalled();
        expect(mocks.reschedule).not.toHaveBeenCalled();
    });

    it('propagates rescheduling failures with partial progress and stops the site', async () => {
        mocks.scheduleError = { message: 'write unavailable' };
        const error = await refreshPorterKnowledge(client(), porter).catch(value => value);
        expect(error).toBeInstanceOf(PorterRefreshError);
        expect(error).toMatchObject({ summary: { checked: 1, unchanged: 1, deferred: 2 } });
        expect(mocks.fetch).toHaveBeenCalledTimes(1);
        expect(mocks.reschedule).toHaveBeenCalledTimes(1);
    });

    it('records a failed page while continuing to other due pages', async () => {
        mocks.fetch.mockRejectedValueOnce(new Error('remote unavailable'));
        const summary = await refreshPorterKnowledge(client(), porter);
        expect(summary).toMatchObject({ checked: 3, failed: 1, unchanged: 2 });
        expect(mocks.reschedule).toHaveBeenCalledTimes(3);
    });
});
