import { describe, expect, it } from 'vitest';
import {
    buildServerTiming,
    GatewayPerformanceTracker,
    parseProxyEdgeTimings,
    PROXY_AUTH_MS_HEADER,
    PROXY_LEASE_MS_HEADER,
} from '@/lib/gateway/performance';

describe('GatewayPerformanceTracker', () => {
    it('records phase latency and output throughput', () => {
        const tracker = new GatewayPerformanceTracker(1_000);
        tracker.markPreflightComplete(1_025);
        tracker.markProviderStart(1_030);
        tracker.markProviderFirstToken(1_080);
        tracker.markClientFirstByte(1_090);
        tracker.markComplete(100, 2_080);

        expect(tracker.snapshot()).toEqual({
            gatewayPreflightMs: 25,
            providerTtftMs: 50,
            clientTtftMs: 90,
            totalCompletionMs: 1080,
            tokensPerSecond: 100,
        });
    });

    it('keeps the first mark when retries or fallbacks mark a phase again', () => {
        const tracker = new GatewayPerformanceTracker(100);
        tracker.markProviderStart(110);
        tracker.markProviderStart(150);
        tracker.markProviderFirstToken(200);
        expect(tracker.snapshot().providerTtftMs).toBe(90);
    });
});

describe('parseProxyEdgeTimings', () => {
    const headers = (entries: Record<string, string>) => new Headers(entries);

    it('reads proxy auth and lease durations', () => {
        expect(parseProxyEdgeTimings(headers({
            [PROXY_AUTH_MS_HEADER]: '12',
            [PROXY_LEASE_MS_HEADER]: '847',
        }))).toEqual({ authMs: 12, leaseMs: 847 });
    });

    it('treats absent or malformed values as unknown, never as zero', () => {
        expect(parseProxyEdgeTimings(headers({}))).toEqual({ authMs: null, leaseMs: null });
        expect(parseProxyEdgeTimings(headers({
            [PROXY_AUTH_MS_HEADER]: 'nope',
            [PROXY_LEASE_MS_HEADER]: '-5',
        }))).toEqual({ authMs: null, leaseMs: null });
    });
});

describe('buildServerTiming', () => {
    it('joins known spans and skips unknowns', () => {
        expect(buildServerTiming([
            { name: 'tensor_auth', durMs: 12 },
            { name: 'tensor_lease', durMs: null },
            { name: 'cencori_preflight', durMs: 230 },
        ])).toBe('tensor_auth;dur=12, cencori_preflight;dur=230');
    });

    it('returns null when nothing is known', () => {
        expect(buildServerTiming([{ name: 'tensor_lease', durMs: null }])).toBeNull();
    });
});

describe('GatewayPerformanceTracker.breakdown', () => {
    it('reports steps, timed calls and phase offsets from the start', async () => {
        const tracker = new GatewayPerformanceTracker(1_000);
        tracker.step('auth', 1_040);
        tracker.step('body', 1_045);
        await tracker.timed('lookup', Promise.resolve('x'));
        await tracker.timed('plain', 'not a promise');
        tracker.markPreflightComplete(1_100);
        tracker.markProviderStart(1_130);
        tracker.markProviderFirstToken(1_900);

        const breakdown = tracker.breakdown();
        expect(breakdown.steps).toEqual({ auth: 40, body: 5 });
        expect(Object.keys(breakdown.spans)).toEqual(['lookup', 'plain']);
        expect(breakdown.preflightDoneAt).toBe(100);
        expect(breakdown.providerStartAt).toBe(130);
        expect(breakdown.providerFirstTokenAt).toBe(900);
        expect(breakdown.completedAt).toBeNull();
    });

    it('records a timed call that rejects', async () => {
        const tracker = new GatewayPerformanceTracker(1_000);
        await expect(tracker.timed('fails', Promise.reject(new Error('down')))).rejects.toThrow('down');
        expect(Object.keys(tracker.breakdown().spans)).toEqual(['fails']);
    });
});
