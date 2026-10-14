/**
 * @vitest-environment node
 *
 * Token buckets on the request log.
 *
 * FinOps exports price cache reads, cache writes and uncached input separately, and `prompt_tokens`
 * cannot be split after the fact — OpenAI and Gemini count cached tokens inside it, Anthropic leaves
 * them out. So the buckets are written when the request is logged.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/functions', () => ({
    waitUntil: () => undefined,
    geolocation: () => ({}),
    ipAddress: () => undefined,
}));
vi.mock('@/lib/governance/record-decision', () => ({
    recordGatewayGovernanceDecision: () => Promise.resolve(),
}));

import { logGatewayRequest, tokenBucketColumns, type GatewayContext } from '@/lib/gateway-middleware';

describe('tokenBucketColumns', () => {
    it('takes the uncached count from a provider that reports cache activity', () => {
        expect(tokenBucketColumns({
            promptTokens: 11_000,
            cacheReadTokens: 10_000,
            cacheWriteTokens: 0,
            uncachedPromptTokens: 1_000,
        })).toEqual({ cache_read_tokens: 10_000, cache_write_tokens: 0, uncached_prompt_tokens: 1_000 });
    });

    it('treats the whole prompt as uncached when the provider reports no cache at all', () => {
        expect(tokenBucketColumns({ promptTokens: 700 })).toEqual({
            cache_read_tokens: null,
            cache_write_tokens: null,
            uncached_prompt_tokens: 700,
        });
    });

    /**
     * Guessing here would price cached tokens at the full input rate. NULL keeps it honest: the
     * export counts the request as unsplit instead.
     */
    it('leaves the uncached count unknown when cache is reported without it', () => {
        expect(tokenBucketColumns({ promptTokens: 1_000, cacheReadTokens: 400 }).uncached_prompt_tokens).toBeNull();
    });

    it('never stores a negative or fractional count', () => {
        expect(tokenBucketColumns({ promptTokens: 10, cacheReadTokens: -5, uncachedPromptTokens: 3.6 })).toEqual({
            cache_read_tokens: 0,
            cache_write_tokens: null,
            uncached_prompt_tokens: 4,
        });
    });
});

function contextWith(insert: ReturnType<typeof vi.fn>): GatewayContext {
    return {
        supabase: { from: () => ({ insert }) },
        projectId: 'proj_1',
        organizationId: 'org_1',
        apiKeyId: 'key_1',
        environment: 'production',
        requestId: 'req_1',
        startTime: Date.now(),
        clientIp: '127.0.0.1',
        countryCode: null,
    } as unknown as GatewayContext;
}

function insertReturning(...results: Array<{ data: unknown; error: unknown }>) {
    const insert = vi.fn();
    for (const result of results) {
        insert.mockReturnValueOnce({ select: () => ({ single: () => Promise.resolve(result) }) });
    }
    return insert;
}

describe('logGatewayRequest with token buckets', () => {
    const params = {
        endpoint: '/v1/chat/completions',
        model: 'claude-sonnet-5',
        provider: 'anthropic',
        status: 'success' as const,
        promptTokens: 1_100,
        completionTokens: 50,
        totalTokens: 1_150,
        cacheReadTokens: 1_000,
        uncachedPromptTokens: 100,
    };

    it('writes the buckets with the row', async () => {
        const insert = insertReturning({ data: { id: 'row_1' }, error: null });

        await expect(logGatewayRequest(contextWith(insert), params)).resolves.toBe('row_1');
        expect(insert.mock.calls[0][0]).toMatchObject({
            cache_read_tokens: 1_000,
            cache_write_tokens: null,
            uncached_prompt_tokens: 100,
        });
    });

    /**
     * Migrations are applied by hand, so the code can ship before the columns exist. Losing the
     * billing row over a new optional column would be far worse than losing the buckets.
     */
    it('still logs the request when the bucket columns have not been migrated yet', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const insert = insertReturning(
            { data: null, error: { code: 'PGRST204', message: "Could not find the 'cache_read_tokens' column of 'ai_requests' in the schema cache" } },
            { data: { id: 'row_2' }, error: null },
        );

        await expect(logGatewayRequest(contextWith(insert), params)).resolves.toBe('row_2');
        expect(insert).toHaveBeenCalledTimes(2);
        expect(insert.mock.calls[1][0]).not.toHaveProperty('cache_read_tokens');
        expect(insert.mock.calls[1][0]).toMatchObject({ prompt_tokens: 1_100, model: 'claude-sonnet-5' });
        warn.mockRestore();
    });

    it('does not retry for an unrelated rejection', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const insert = insertReturning({ data: null, error: { code: '23502', message: 'null value in column "request_payload"' } });

        await expect(logGatewayRequest(contextWith(insert), params)).resolves.toBeNull();
        expect(insert).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });
});
