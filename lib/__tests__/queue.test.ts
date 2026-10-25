// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => ({ queue: [] as unknown[], dlq: [] as unknown[] }));
const recorded = vi.hoisted(() => [] as unknown[]);

vi.mock('@/lib/redis', () => ({
    createRedisClient: () => ({
        lpop: async () => store.queue.shift() ?? null,
        rpush: async (key: string, value: unknown) => {
            (key.endsWith(':dlq') ? store.dlq : store.queue).push(value);
            return 1;
        },
    }),
}));
vi.mock('@/lib/end-user-billing', () => ({
    recordEndUserUsageAsync: async (task: unknown) => {
        recorded.push(task);
    },
}));

describe('processUsageQueue', () => {
    beforeEach(() => {
        store.queue.length = 0;
        store.dlq.length = 0;
        recorded.length = 0;
    });

    it('records tasks the client already parsed, and raw JSON strings', async () => {
        const { processUsageQueue } = await import('@/lib/queue');
        store.queue.push({ projectId: 'p', endUserId: 'u' }, JSON.stringify({ projectId: 'p2', endUserId: 'u2' }));
        expect(await processUsageQueue(10)).toBe(2);
        expect(recorded).toEqual([
            { projectId: 'p', endUserId: 'u' },
            { projectId: 'p2', endUserId: 'u2' },
        ]);
        expect(store.dlq).toEqual([]);
    });

    it('dead-letters an unreadable task as a string', async () => {
        const { processUsageQueue } = await import('@/lib/queue');
        store.queue.push('{not json');
        await processUsageQueue(10);
        expect(store.dlq).toEqual(['{not json']);
    });
});
