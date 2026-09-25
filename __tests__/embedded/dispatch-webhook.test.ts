import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    waitUntil: vi.fn(),
    emitEmbeddedEvent: vi.fn(),
}));

vi.mock('@vercel/functions', () => ({ waitUntil: mocks.waitUntil }));
vi.mock('@/lib/embedded/runs', () => ({ emitEmbeddedEvent: mocks.emitEmbeddedEvent }));

import { scheduleEmbeddedWebhook } from '@/lib/embedded/dispatch-webhook';

describe('embedded run webhook dispatch', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns without waiting for a slow customer endpoint', async () => {
        let complete!: () => void;
        const delivery = new Promise<void>((resolve) => { complete = resolve; });
        mocks.emitEmbeddedEvent.mockReturnValue(delivery);

        scheduleEmbeddedWebhook('project-1', 'run.started', { run_id: 'run-1' });

        expect(mocks.emitEmbeddedEvent).toHaveBeenCalledWith('project-1', 'run.started', { run_id: 'run-1' });
        expect(mocks.waitUntil).toHaveBeenCalledOnce();
        complete();
        await mocks.waitUntil.mock.calls[0][0];
    });

    it('contains delivery failure in the background task', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        mocks.emitEmbeddedEvent.mockRejectedValue(new Error('endpoint timed out'));

        scheduleEmbeddedWebhook('project-1', 'run.completed', { run_id: 'run-1' });
        await expect(mocks.waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledWith('[EmbeddedRun] Webhook delivery failed', {
            event: 'run.completed', error: 'Error',
        });
        warn.mockRestore();
    });
});
