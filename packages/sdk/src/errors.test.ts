import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    AuthenticationError,
    CencoriError,
    RateLimitError,
    SafetyError,
    parseRetryAfterMs,
    throwCencoriError,
} from './errors';
import { fetchWithRetry } from './utils';
import { ChatNamespace } from './chat';
import { MemoryClient } from './memory';

function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), { status, headers });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('parseRetryAfterMs', () => {
    it('parses seconds, rejects garbage', () => {
        expect(parseRetryAfterMs('120')).toBe(120000);
        expect(parseRetryAfterMs('0')).toBe(0);
        expect(parseRetryAfterMs(null)).toBeNull();
        expect(parseRetryAfterMs('soon')).toBeNull();
        expect(parseRetryAfterMs('-5')).toBeNull();
    });
});

describe('throwCencoriError', () => {
    it('maps 401 with the request id', () => {
        const res = jsonResponse({ error: { message: 'Bad key', code: 'invalid_api_key' } }, 401, {
            'X-Request-Id': 'req-1',
        });
        try {
            throwCencoriError(res, { error: { message: 'Bad key', code: 'invalid_api_key' } });
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(AuthenticationError);
            const err = error as AuthenticationError;
            expect(err.statusCode).toBe(401);
            expect(err.requestId).toBe('req-1');
            expect(err.isRetryable).toBe(false);
        }
    });

    it('maps 429 with header and body retry hints', () => {
        const res = jsonResponse(
            { error: { message: 'Slow down', code: 'rate_limit_exceeded' }, retry_after_ms: 45000 },
            429,
            { 'X-Request-Id': 'req-2', 'Retry-After': '120' }
        );
        try {
            throwCencoriError(res, {
                error: { message: 'Slow down', code: 'rate_limit_exceeded' },
                retry_after_ms: 45000,
            });
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(RateLimitError);
            const err = error as RateLimitError;
            expect(err.retryAfterMs).toBe(120000);
            expect(err.requestId).toBe('req-2');
            expect(err.isRetryable).toBe(true);
        }
    });

    it('maps 400 with reasons to SafetyError', () => {
        const res = jsonResponse({ error: 'Blocked', reasons: ['jailbreak: "x"'] }, 400);
        try {
            throwCencoriError(res, { error: 'Blocked', reasons: ['jailbreak: "x"'] });
            expect.unreachable();
        } catch (error) {
            expect(error).toBeInstanceOf(SafetyError);
            expect((error as SafetyError).reasons).toEqual(['jailbreak: "x"']);
        }
    });

    it('preserves machine codes on other statuses and marks retryability', () => {
        const res = jsonResponse({ error: { message: 'Broke', code: 'credit_balance_exhausted' } }, 403);
        try {
            throwCencoriError(res, { error: { message: 'Broke', code: 'credit_balance_exhausted' } });
            expect.unreachable();
        } catch (error) {
            const err = error as CencoriError;
            expect(err).toBeInstanceOf(CencoriError);
            expect(err.code).toBe('credit_balance_exhausted');
            expect(err.isRetryable).toBe(false);
        }

        const retryable = (() => {
            try {
                throwCencoriError(jsonResponse({}, 503), {});
            } catch (error) {
                return error as CencoriError;
            }
            throw new Error('unreachable');
        })();
        expect(retryable.isRetryable).toBe(true);
    });
});

describe('fetchWithRetry', () => {
    it('retries a 429 once the server hint elapses, then succeeds', async () => {
        const calls: string[] = [];
        vi.spyOn(global, 'fetch').mockImplementation(async () => {
            calls.push('call');
            if (calls.length === 1) {
                return jsonResponse({ error: 'Slow' }, 429, { 'Retry-After': '0' });
            }
            return jsonResponse({ ok: true }, 200);
        });
        const res = await fetchWithRetry('https://x.test/', { method: 'POST' }, 3);
        expect(res.status).toBe(200);
        expect(calls).toHaveLength(2);
    });

    it('returns the final 429 after exhausting attempts', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ error: 'Slow' }, 429, { 'Retry-After': '0' }));
        const res = await fetchWithRetry('https://x.test/', { method: 'POST' }, 2);
        expect(res.status).toBe(429);
    });

    it('never retries an aborted request', async () => {
        const controller = new AbortController();
        controller.abort();
        vi.spyOn(global, 'fetch').mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        await expect(fetchWithRetry('https://x.test/', { method: 'POST', signal: controller.signal }, 3)).rejects.toMatchObject({
            name: 'AbortError',
        });
    });
});

describe('client error surfacing', () => {
    const config = { apiKey: 'csk_test', baseUrl: 'https://cencori.com', headers: {} } as never;

    it('chat completions throw CencoriError with code + request id', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(
            jsonResponse({ error: { message: 'Out of credits', code: 'credit_balance_exhausted' } }, 403, {
                'X-Request-Id': 'req-9',
            })
        );
        const chat = new ChatNamespace(config);
        const failure = await chat.completions
            .create({ model: 'gpt-4o', messages: [] })
            .then(
                () => null,
                (error: unknown) => error as CencoriError
            );
        expect(failure).toBeInstanceOf(CencoriError);
        expect(failure?.statusCode).toBe(403);
        expect(failure?.code).toBe('credit_balance_exhausted');
        expect(failure?.requestId).toBe('req-9');
        expect(failure?.isRetryable).toBe(false);
    });

    it('chat create attaches request id and safety on success', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(
                JSON.stringify({
                    id: 'chatcmpl-1',
                    object: 'chat.completion',
                    created: 1,
                    model: 'gpt-4o',
                    choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
                    safety: { scanned: true, input: { safe: true, layer: 'multi', riskScore: 0.1, reasons: [] } },
                }),
                { status: 200, headers: { 'X-Request-Id': 'req-10' } }
            )
        );
        const chat = new ChatNamespace(config);
        const res = await chat.completions.create({ model: 'gpt-4o', messages: [] });
        expect(res.requestId).toBe('req-10');
        expect(res.safety).toEqual({
            scanned: true,
            input: { safe: true, layer: 'multi', riskScore: 0.1, reasons: [] },
        });
    });

    it('memory client throws CencoriError with code + request id', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(
            jsonResponse({ error: { message: 'Too fast', code: 'rate_limit_exceeded' }, retry_after_ms: 2000 }, 429, {
                'X-Request-Id': 'req-11',
            })
        );
        const memory = new MemoryClient(config);
        const failure = await memory.list({ userId: 'u' }).then(
            () => null,
            (error: unknown) => error as RateLimitError
        );
        expect(failure).toBeInstanceOf(RateLimitError);
        expect(failure?.retryAfterMs).toBe(2000);
        expect(failure?.requestId).toBe('req-11');
    });
});
