/** @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    attemptSignal,
    DEFAULT_PROVIDER_TIMEOUT_MS,
    enforceRequestBudget,
    resolveProviderTransport,
    runWithProviderRetry,
    type ResolvedProviderTransport,
    type UnifiedChatRequest,
} from '../base';
import {
    BudgetExceededError,
    InvalidRequestError,
    RateLimitError,
    ServiceUnavailableError,
} from '../errors';
import { parseRequestControls } from '@/lib/gateway/request-controls';
import { mapProviderErrorToHttpResponse } from '@/lib/gateway-reliability';

const { safeFetch } = vi.hoisted(() => ({ safeFetch: vi.fn() }));
vi.mock('@/lib/security/outbound-url', () => ({ safeProviderFetch: safeFetch }));
vi.mock('../pricing', () => ({
    getPricingFromDB: vi.fn().mockResolvedValue({
        inputPer1KTokens: 1,
        outputPer1KTokens: 2,
        cencoriMarkupPercentage: 0,
    }),
}));
import { OpenAICompatibleProvider } from '../openai-compatible';
import { CohereProvider } from '../cohere';

beforeEach(() => safeFetch.mockReset());

const baseTransport = (): ResolvedProviderTransport => ({
    fetch: undefined,
    timeoutMs: DEFAULT_PROVIDER_TIMEOUT_MS,
    maxRetries: 0,
    retryBaseDelayMs: 1,
    hooks: undefined,
});

describe('resolveProviderTransport', () => {
    it('prefers per-request timeout, then request transport, then client, then default', () => {
        expect(resolveProviderTransport({ timeoutMs: 1000 }, { timeoutMs: 2000 }).timeoutMs).toBe(2000);
        expect(
            resolveProviderTransport({ timeoutMs: 1000 }, { transport: { timeoutMs: 3000 } }).timeoutMs,
        ).toBe(3000);
        expect(resolveProviderTransport({ timeoutMs: 1000 }, {}).timeoutMs).toBe(1000);
        expect(resolveProviderTransport(undefined, {}).timeoutMs).toBe(DEFAULT_PROVIDER_TIMEOUT_MS);
    });

    it('sanitizes garbage timeouts to the default instead of failing the call', () => {
        for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 'fast' as never]) {
            expect(resolveProviderTransport(undefined, { timeoutMs: bad }).timeoutMs).toBe(
                DEFAULT_PROVIDER_TIMEOUT_MS,
            );
        }
    });

    it('clamps retries to 0..10 and prefers the per-request value', () => {
        expect(resolveProviderTransport({ maxRetries: 2 }, { transport: { maxRetries: 4 } }).maxRetries).toBe(4);
        expect(resolveProviderTransport(undefined, { transport: { maxRetries: 99 } }).maxRetries).toBe(10);
        expect(resolveProviderTransport(undefined, { transport: { maxRetries: -3 } }).maxRetries).toBe(0);
        expect(resolveProviderTransport(undefined, {}).maxRetries).toBe(0);
    });

    it('prefers per-request fetch and hooks over client ones', () => {
        const clientFetch = vi.fn();
        const requestFetch = vi.fn();
        const resolved = resolveProviderTransport(
            { fetch: clientFetch as never },
            { transport: { fetch: requestFetch as never } },
        );
        expect(resolved.fetch).toBe(requestFetch);
        expect(resolveProviderTransport({ fetch: clientFetch as never }, {}).fetch).toBe(clientFetch);
    });
});

describe('attemptSignal', () => {
    it('combines caller cancellation with a fresh timeout', () => {
        const caller = new AbortController();
        const { signal, timedOut } = attemptSignal(caller.signal, 1000);
        expect(signal?.aborted).toBe(false);
        expect(timedOut()).toBe(false);
        caller.abort();
        expect(signal?.aborted).toBe(true);
        expect(timedOut()).toBe(false);
    });

    it('passes an already-aborted caller signal through untouched', () => {
        const caller = new AbortController();
        caller.abort(new Error('caller stopped'));
        const { signal, timedOut } = attemptSignal(caller.signal, 1000);
        expect(signal).toBe(caller.signal);
        expect(timedOut()).toBe(false);
    });
});

describe('runWithProviderRetry', () => {
    it('returns the first attempt untouched and reports one attempt', async () => {
        const settled: unknown[] = [];
        const result = await runWithProviderRetry({
            provider: 'p',
            model: 'm',
            transport: { ...baseTransport(), hooks: { onSettled: (e) => settled.push(e) } },
            operation: async () => 'ok',
        });
        expect(result).toBe('ok');
        expect(settled).toHaveLength(1);
        expect(settled[0]).toMatchObject({ provider: 'p', model: 'm', attempts: 1 });
    });

    it('retries retryable failures with hooks and backoff, then succeeds', async () => {
        const attempts: number[] = [];
        const retries: unknown[] = [];
        let calls = 0;
        const result = await runWithProviderRetry({
            provider: 'p',
            model: 'm',
            transport: {
                ...baseTransport(),
                maxRetries: 2,
                retryBaseDelayMs: 1,
                hooks: {
                    onAttempt: (e) => attempts.push(e.attempt),
                    onRetry: (e) => retries.push(e),
                },
            },
            operation: async () => {
                calls += 1;
                if (calls < 3) throw new ServiceUnavailableError('p', new Error('503'));
                return 'recovered';
            },
        });
        expect(result).toBe('recovered');
        expect(attempts).toEqual([1, 2, 3]);
        expect(retries).toHaveLength(2);
    });

    it('fails fast on non-retryable errors without retrying', async () => {
        let calls = 0;
        await expect(
            runWithProviderRetry({
                provider: 'p',
                model: 'm',
                transport: { ...baseTransport(), maxRetries: 3, retryBaseDelayMs: 1 },
                operation: async () => {
                    calls += 1;
                    throw new InvalidRequestError('p', 'bad request');
                },
            }),
        ).rejects.toBeInstanceOf(InvalidRequestError);
        expect(calls).toBe(1);
    });

    it('never retries caller cancellation', async () => {
        const caller = new AbortController();
        let calls = 0;
        await expect(
            runWithProviderRetry({
                provider: 'p',
                model: 'm',
                transport: { ...baseTransport(), maxRetries: 3, retryBaseDelayMs: 1 },
                callerSignal: caller.signal,
                operation: async () => {
                    calls += 1;
                    caller.abort(new Error('user stopped'));
                    throw new ServiceUnavailableError('p', new Error('503'));
                },
            }),
        ).rejects.toThrow();
        expect(calls).toBe(1);
    });

    it('honours RateLimitError.retryAfter for the next delay', async () => {
        const retries: Array<{ nextDelayMs: number }> = [];
        let calls = 0;
        await expect(
            runWithProviderRetry({
                provider: 'p',
                model: 'm',
                transport: {
                    ...baseTransport(),
                    maxRetries: 1,
                    retryBaseDelayMs: 5000,
                    hooks: { onRetry: (e) => retries.push(e) },
                },
                operation: async () => {
                    calls += 1;
                    if (calls === 1) throw new RateLimitError('p', 0, new Error('429'));
                    throw new InvalidRequestError('p', 'still bad');
                },
            }),
        ).rejects.toBeInstanceOf(InvalidRequestError);
        expect(retries).toHaveLength(1);
        expect(retries[0].nextDelayMs).toBe(0);
    });

    it('treats raw HTTP 5xx by status as retryable', async () => {
        let calls = 0;
        const result = await runWithProviderRetry({
            provider: 'p',
            model: 'm',
            transport: { ...baseTransport(), maxRetries: 1, retryBaseDelayMs: 1 },
            operation: async () => {
                calls += 1;
                if (calls === 1) throw Object.assign(new Error('500 Internal Server Error'), { status: 500 });
                return 'recovered';
            },
        });
        expect(result).toBe('recovered');
        expect(calls).toBe(2);
    });
});

describe('enforceRequestBudget', () => {
    const usage = { promptTokens: 1000, completionTokens: 500, totalTokens: 1500 };

    it('is a no-op without a budget or with an invalid one', () => {
        expect(() =>
            enforceRequestBudget({ provider: 'p', model: 'm', costUsd: 99, usage }),
        ).not.toThrow();
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 'cheap' as never]) {
            expect(() =>
                enforceRequestBudget({ provider: 'p', model: 'm', costUsd: 99, budgetUsd: bad, usage }),
            ).not.toThrow();
        }
    });

    it('allows costs at or under budget', () => {
        expect(() =>
            enforceRequestBudget({ provider: 'p', model: 'm', costUsd: 2, budgetUsd: 2, usage }),
        ).not.toThrow();
    });

    it('throws BudgetExceededError carrying cost and usage over budget', () => {
        try {
            enforceRequestBudget({ provider: 'p', model: 'm', costUsd: 2, budgetUsd: 1, usage });
            expect.unreachable('should have thrown');
        } catch (error) {
            expect(error).toBeInstanceOf(BudgetExceededError);
            const budget = error as BudgetExceededError;
            expect(budget.costUsd).toBe(2);
            expect(budget.budgetUsd).toBe(1);
            expect(budget.usage).toEqual(usage);
            expect(budget.retryable).toBe(false);
        }
    });

    it('maps to HTTP 402 budget_exceeded', () => {
        const failure = mapProviderErrorToHttpResponse(
            new BudgetExceededError('deepseek', 'deepseek-v4-pro', 2, 1),
            'deepseek',
            'deepseek-v4-pro',
        );
        expect(failure.status).toBe(402);
        expect(failure.error).toBe('budget_exceeded');
    });
});

describe('parseRequestControls', () => {
    it('accepts valid timeout and budget', () => {
        expect(parseRequestControls({ timeout_ms: 10_000, max_cost_usd: 0.5 })).toEqual({
            timeoutMs: 10_000,
            maxCostUsd: 0.5,
        });
    });

    it('treats absent fields as unset', () => {
        expect(parseRequestControls({})).toEqual({ timeoutMs: undefined, maxCostUsd: undefined });
    });

    it('accepts legacy camelCase aliases', () => {
        expect(parseRequestControls({ timeoutMs: 10_000, maxCostUsd: 0.5 })).toEqual({
            timeoutMs: 10_000,
            maxCostUsd: 0.5,
        });
    });

    it('rejects invalid values and caps runaway timeouts', () => {
        expect(parseRequestControls({ timeout_ms: 'fast' })).toMatchObject({
            error: expect.stringContaining('timeout_ms'),
        });
        expect(parseRequestControls({ timeout_ms: -5 })).toMatchObject({
            error: expect.stringContaining('timeout_ms'),
        });
        expect(parseRequestControls({ max_cost_usd: -1 })).toMatchObject({
            error: expect.stringContaining('max_cost_usd'),
        });
        expect(parseRequestControls({ timeout_ms: 9_000_000 })).toEqual({
            timeoutMs: 300_000,
            maxCostUsd: undefined,
        });
    });
});

const chatRequest = (overrides: Partial<UnifiedChatRequest> = {}): UnifiedChatRequest => ({
    model: 'deepseek-v4-pro',
    messages: [{ role: 'user', content: 'Hello.' }],
    ...overrides,
});

const completionJson = (promptTokens = 1000, completionTokens = 500) =>
    JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion',
        model: 'deepseek-v4-pro',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Hi.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
    });

describe('OpenAICompatibleProvider transport', () => {
    it('uses the injected per-request fetch instead of the default', async () => {
        const customFetch = vi.fn().mockResolvedValue(
            new Response(completionJson(), { headers: { 'Content-Type': 'application/json' } }),
        );
        const result = await new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
            chatRequest({ transport: { fetch: customFetch as never } }),
        );
        expect(result.content).toBe('Hi.');
        expect(customFetch).toHaveBeenCalledTimes(1);
        expect(safeFetch).not.toHaveBeenCalled();
    });

    it('retries a 500 once with hooks, then succeeds', async () => {
        const attempts: number[] = [];
        const retries: unknown[] = [];
        let calls = 0;
        const flaky = vi.fn().mockImplementation(() => {
            calls += 1;
            if (calls === 1) return Promise.resolve(new Response('upstream blew up', { status: 500 }));
            return Promise.resolve(
                new Response(completionJson(), { headers: { 'Content-Type': 'application/json' } }),
            );
        });
        const result = await new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
            chatRequest({
                transport: {
                    fetch: flaky as never,
                    maxRetries: 1,
                    retryBaseDelayMs: 1,
                    hooks: {
                        onAttempt: (e) => attempts.push(e.attempt),
                        onRetry: (e) => retries.push(e),
                    },
                },
            }),
        );
        expect(result.content).toBe('Hi.');
        expect(flaky).toHaveBeenCalledTimes(2);
        expect(attempts).toEqual([1, 2]);
        expect(retries).toHaveLength(1);
    });

    it('does not retry a 400', async () => {
        const bad = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
        await expect(
            new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
                chatRequest({ transport: { fetch: bad as never, maxRetries: 3, retryBaseDelayMs: 1 } }),
            ),
        ).rejects.toThrow();
        expect(bad).toHaveBeenCalledTimes(1);
    });

    it('fails a hanging call at the attempt deadline', async () => {
        // A faithful fetch stub: real fetch rejects on abort, so must the stub.
        const hanging = vi.fn().mockImplementation(
            (_input: unknown, init?: RequestInit) =>
                new Promise((_resolve, reject) => {
                    init?.signal?.addEventListener(
                        'abort',
                        () => reject((init.signal as AbortSignal).reason ?? new Error('aborted')),
                        { once: true },
                    );
                }),
        );
        await expect(
            new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
                chatRequest({ transport: { fetch: hanging as never }, timeoutMs: 50 }),
            ),
        ).rejects.toBeInstanceOf(ServiceUnavailableError);
        expect(hanging).toHaveBeenCalledTimes(1);
    });

    it('enforces maxCostUsd against the computed cost ($2 at test pricing)', async () => {
        const ok = vi
            .fn()
            .mockImplementation(() =>
                Promise.resolve(
                    new Response(completionJson(), { headers: { 'Content-Type': 'application/json' } }),
                ),
            );
        await expect(
            new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
                chatRequest({ transport: { fetch: ok as never }, maxCostUsd: 1 }),
            ),
        ).rejects.toBeInstanceOf(BudgetExceededError);
        const within = await new OpenAICompatibleProvider('deepseek', 'synthetic-key').chat(
            chatRequest({ transport: { fetch: ok as never }, maxCostUsd: 5 }),
        );
        expect(within.cost.providerCostUsd).toBeCloseTo(2);
    });
});

describe('CohereProvider transport', () => {
    it('uses the injected fetch for raw HTTP calls', async () => {
        const customFetch = vi.fn().mockResolvedValue(
            new Response(
                JSON.stringify({
                    text: 'Kia ora.',
                    generation_id: 'gen-1',
                    chat_history: [],
                    finish_reason: 'COMPLETE',
                    meta: { api_version: { version: '1' }, billed_units: { input_tokens: 8, output_tokens: 4 } },
                }),
                { headers: { 'Content-Type': 'application/json' } },
            ),
        );
        const result = await new CohereProvider('synthetic-key', {
            fetch: customFetch as never,
        }).chat(chatRequest({ model: 'command-r-plus-08-2024' }));
        expect(result.content).toBe('Kia ora.');
        expect(customFetch).toHaveBeenCalledTimes(1);
        expect(safeFetch).not.toHaveBeenCalled();
    });
});
