export type GatewayPerformanceMetrics = {
    gatewayPreflightMs: number | null;
    providerTtftMs: number | null;
    clientTtftMs: number | null;
    totalCompletionMs: number | null;
    tokensPerSecond: number | null;
};

/**
 * Edge timings measured by the Tensor inference proxy before the gateway
 * ever sees the request (session auth + billing-lease RPC). The proxy
 * forwards them as headers so the gateway log can attribute what its own
 * clock cannot see: client-measured TTFT minus gateway-measured TTFT is
 * otherwise an unexplained gap, which is exactly the confusion behind the
 * 3.5–9s greeting investigation. Self-reported by the caller, so treated
 * as attribution metadata, never as a billing input.
 */
export type ProxyEdgeTimings = {
    authMs: number | null;
    leaseMs: number | null;
};

export const PROXY_AUTH_MS_HEADER = 'x-tensor-proxy-auth-ms';
export const PROXY_LEASE_MS_HEADER = 'x-tensor-proxy-lease-ms';

function readEdgeMs(value: string | null): number | null {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 && parsed < 3_600_000
        ? Math.round(parsed)
        : null;
}

export function parseProxyEdgeTimings(headers: Headers): ProxyEdgeTimings {
    return {
        authMs: readEdgeMs(headers.get(PROXY_AUTH_MS_HEADER)),
        leaseMs: readEdgeMs(headers.get(PROXY_LEASE_MS_HEADER)),
    };
}

/** Build a `Server-Timing` value from named durations, skipping unknowns. */
export function buildServerTiming(spans: Array<{ name: string; durMs: number | null }>): string | null {
    const parts = spans
        .filter((span) => span.durMs !== null && span.durMs !== undefined)
        .map((span) => `${span.name};dur=${span.durMs as number}`);
    return parts.length > 0 ? parts.join(', ') : null;
}

/**
 * Request-scoped latency tracker shared by the route, provider executor, and
 * stream encoder. Date.now() is intentional: the recorded values need to be
 * comparable with persisted request timestamps, not just process-local marks.
 */
export class GatewayPerformanceTracker {
    private readonly requestStartedAt: number;
    private preflightCompletedAt: number | null = null;
    private providerStartedAt: number | null = null;
    private providerFirstTokenAt: number | null = null;
    private clientFirstByteAt: number | null = null;
    private completedAt: number | null = null;
    private completionTokens: number | null = null;

    constructor(requestStartedAt: number = Date.now()) {
        this.requestStartedAt = requestStartedAt;
    }

    markPreflightComplete(at: number = Date.now()): void {
        this.preflightCompletedAt ??= at;
    }

    markProviderStart(at: number = Date.now()): void {
        this.providerStartedAt ??= at;
    }

    markProviderFirstToken(at: number = Date.now()): void {
        this.providerFirstTokenAt ??= at;
    }

    markClientFirstByte(at: number = Date.now()): void {
        this.clientFirstByteAt ??= at;
    }

    markComplete(completionTokens?: number, at: number = Date.now()): void {
        this.completedAt ??= at;
        if (completionTokens !== undefined && Number.isFinite(completionTokens)) {
            this.completionTokens = Math.max(0, completionTokens);
        }
    }

    snapshot(): GatewayPerformanceMetrics {
        const outputDurationMs = this.completedAt !== null && this.providerFirstTokenAt !== null
            ? Math.max(0, this.completedAt - this.providerFirstTokenAt)
            : null;
        const tokensPerSecond = outputDurationMs !== null
            && outputDurationMs > 0
            && this.completionTokens !== null
                ? this.completionTokens / (outputDurationMs / 1000)
                : null;

        return {
            gatewayPreflightMs: this.preflightCompletedAt === null
                ? null
                : Math.max(0, this.preflightCompletedAt - this.requestStartedAt),
            providerTtftMs: this.providerStartedAt === null || this.providerFirstTokenAt === null
                ? null
                : Math.max(0, this.providerFirstTokenAt - this.providerStartedAt),
            clientTtftMs: this.clientFirstByteAt === null
                ? null
                : Math.max(0, this.clientFirstByteAt - this.requestStartedAt),
            totalCompletionMs: this.completedAt === null
                ? null
                : Math.max(0, this.completedAt - this.requestStartedAt),
            tokensPerSecond,
        };
    }
}
