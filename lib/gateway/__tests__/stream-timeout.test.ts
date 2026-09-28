/** @vitest-environment node */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamWithTimeout } from '@/lib/gateway/stream-timeout';

afterEach(() => vi.useRealTimers());

describe('provider stream deadlines', () => {
    it('reports a stalled next() even when generator cleanup cannot finish', async () => {
        vi.useFakeTimers();
        let providerSignal!: AbortSignal;
        let cleanedUp = false;
        const stream = streamWithTimeout(signal => {
            providerSignal = signal;
            return (async function* () {
                try {
                    yield 'quote timestamps b';
                    await new Promise(() => {});
                } finally {
                    cleanedUp = true;
                }
            })();
        }, 'provider', { timeoutMs: 50 });
        expect(await stream.next()).toEqual({ done: false, value: 'quote timestamps b' });
        const stalled = stream.next();
        const rejected = expect(stalled).rejects.toThrow('next chunk timed out after 50ms');
        await vi.advanceTimersByTimeAsync(50);
        await rejected;
        expect(providerSignal.aborted).toBe(true);
        // The provider ignores abort and return() remains queued; the caller still settled.
        expect(cleanedUp).toBe(false);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('resets the deadline for each chunk and pauses it while the caller works', async () => {
        vi.useFakeTimers();
        const stream = streamWithTimeout(() => (async function* () {
            yield 'first';
            await new Promise(resolve => setTimeout(resolve, 40));
            yield 'second';
            await new Promise(resolve => setTimeout(resolve, 40));
            yield 'third';
        })(), 'provider', { timeoutMs: 50 });
        expect((await stream.next()).value).toBe('first');
        // An output guard can take time. This is not provider silence and must not abort it.
        await vi.advanceTimersByTimeAsync(500);
        const second = stream.next();
        await vi.advanceTimersByTimeAsync(40);
        expect((await second).value).toBe('second');
        const third = stream.next();
        await vi.advanceTimersByTimeAsync(40);
        expect((await third).value).toBe('third');
        expect((await stream.next()).done).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('forwards cancellation and settles even if a provider ignores abort', async () => {
        const cancel = new AbortController();
        let providerSignal!: AbortSignal;
        const stream = streamWithTimeout(signal => {
            providerSignal = signal;
            return { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) };
        }, 'provider', { signal: cancel.signal });
        const next = stream.next();
        const rejected = expect(next).rejects.toThrow('Cancelled by caller');
        cancel.abort(new Error('Cancelled by caller'));
        await rejected;
        expect(providerSignal.aborted).toBe(true);
    });

    it('preserves a provider error when cleanup rejects', async () => {
        const stream = streamWithTimeout(() => ({ [Symbol.asyncIterator]: () => ({
            next: () => Promise.reject(new Error('Provider disconnected')),
            return: () => Promise.reject(new Error('Cleanup failed')),
        }) }), 'provider');
        await expect(stream.next()).rejects.toThrow('Provider disconnected');
    });
});
