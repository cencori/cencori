/**
 * @vitest-environment node
 *
 * An empty provider stop (no text, no calls) settles rather than fails, but
 * the settled response must say it is empty — otherwise an empty turn is
 * indistinguishable from a delivered one in stored history.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteGatewayChat = vi.fn();

vi.mock('@/lib/gateway/chat-executor', () => ({
    executeGatewayChat: (...args: unknown[]) => mockExecuteGatewayChat(...args),
    streamGatewayChat: vi.fn(),
}));

vi.mock('@/lib/gateway/providers-setup', () => ({
    resolveGatewayProvider: vi.fn().mockResolvedValue({
        providerName: 'openai',
        model: 'gpt-4o',
        provider: { supportsTools: true },
        billingMode: 'standard',
    }),
}));

vi.mock('@/lib/gateway/output-guard', () => ({
    runGatewayOutputGuard: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/supabaseAdmin', () => ({ createAdminClient: vi.fn() }));

import { runV1ResponsesExecution } from '@/lib/gateway/v1-responses-execute';
import { GatewayPerformanceTracker } from '@/lib/gateway/performance';
import { createMockGatewayContext, toUnifiedMessages } from '@/lib/gateway/__tests__/fixtures';
import type { SecurityCheckResult } from '@/lib/safety/multi-layer-check';

const inputSecurity: SecurityCheckResult = {
    safe: true,
    reasons: [],
    layer: 'input',
    riskScore: 0,
    confidence: 1,
};

function baseParams(overrides: Record<string, unknown> = {}) {
    return {
        supabase: {} as never,
        gatewayCtx: createMockGatewayContext(),
        model: 'gpt-4o',
        body: { model: 'gpt-4o', input: 'Hello', stream: false, store: false },
        messages: toUnifiedMessages([{ role: 'user', content: 'Hello' }]),
        inputText: 'Hello',
        inputSecurity,
        endUserId: null,
        endUserQuota: null,
        tier: 'free' as const,
        recordEndUserUsage: vi.fn(),
        logSuccess: vi.fn(),
        incrementUsage: vi.fn(),
        ...overrides,
    } as never;
}

function providerResult(overrides: Record<string, unknown> = {}) {
    return {
        content: '',
        model: 'gpt-4o',
        provider: 'openai',
        usage: { promptTokens: 9, completionTokens: 0, totalTokens: 9 },
        cost: { providerCostUsd: 0, cencoriChargeUsd: 0, markupPercentage: 0 },
        latencyMs: 1,
        finishReason: 'stop',
        toolCalls: [],
        actualProvider: 'openai',
        actualModel: 'gpt-4o',
        usedFallback: false,
        originalProvider: 'openai',
        originalModel: 'gpt-4o',
        billingMode: 'standard',
        ...overrides,
    };
}

beforeEach(() => vi.clearAllMocks());

describe('empty completions', () => {
    it('marks a non-streamed turn that produced no message', async () => {
        mockExecuteGatewayChat.mockResolvedValue(providerResult());
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const json = await result.response.json() as {
            status: string;
            output: unknown[];
            metadata?: Record<string, string>;
        };
        expect(json.status).toBe('completed');
        expect(json.output).toEqual([]);
        expect(json.metadata?.cencori_empty_completion).toBe('true');
    });

    it('leaves a turn with text unmarked', async () => {
        mockExecuteGatewayChat.mockResolvedValue(providerResult({ content: 'Hi.' }));
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const json = await result.response.json() as { metadata?: Record<string, string> };
        expect(json.metadata?.cencori_empty_completion).toBeUndefined();
    });

    it('leaves a tool-only turn unmarked', async () => {
        mockExecuteGatewayChat.mockResolvedValue(providerResult({
            toolCalls: [{ id: 'call-1', type: 'function', function: { name: 'shell', arguments: '{}' } }],
            finishReason: 'tool_calls',
        }));
        const result = await runV1ResponsesExecution(baseParams());
        if (!result.ok) throw new Error('expected ok');
        const json = await result.response.json() as { metadata?: Record<string, string> };
        expect(json.metadata?.cencori_empty_completion).toBeUndefined();
    });

    it('records preflight and client timings on the performance tracker', async () => {
        mockExecuteGatewayChat.mockResolvedValue(providerResult({ content: 'Hi.' }));
        const performance = new GatewayPerformanceTracker(Date.now());
        const seen: unknown[] = [];
        const result = await runV1ResponsesExecution(baseParams({
            performance,
            onPerformance: (metrics: unknown) => seen.push(metrics),
        }));
        if (!result.ok) throw new Error('expected ok');
        await result.response.json();
        expect(seen).toHaveLength(1);
        const snapshot = performance.snapshot();
        expect(snapshot.gatewayPreflightMs).not.toBeNull();
        expect(snapshot.clientTtftMs).not.toBeNull();
        expect(snapshot.totalCompletionMs).not.toBeNull();
    });
});
