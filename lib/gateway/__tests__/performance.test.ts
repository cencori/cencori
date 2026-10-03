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
