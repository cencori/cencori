import { afterEach, describe, expect, it, vi } from 'vitest';
import { CencoriEmbeddedApiError, RunsNamespace, TenantsNamespace } from './index';

const config = { apiKey: 'csk_test', baseUrl: 'https://cencori.com', headers: {} };

afterEach(() => vi.restoreAllMocks());

describe('embedded SDK request diagnostics', () => {
    it('preserves HTTP status, code, and request ID', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'tenant_not_found', message: 'Tenant not found', request_id: 'req_123' },
        }), { status: 404 }));
        await expect(new TenantsNamespace(config).get('ten_missing')).rejects.toMatchObject({
            name: 'CencoriEmbeddedApiError', status: 404, code: 'tenant_not_found', requestId: 'req_123',
        } satisfies Partial<CencoriEmbeddedApiError>);
    });

    it('passes an AbortSignal to run creation', async () => {
        const controller = new AbortController();
        const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 202 }));
        await new RunsNamespace(config).create('agt_123', { input: { prompt: 'hello' } }, 'retry-key', { signal: controller.signal });
        expect(fetchMock).toHaveBeenCalledWith('https://cencori.com/v1/agents/agt_123/runs', expect.objectContaining({
            signal: controller.signal,
            headers: expect.objectContaining({ 'Idempotency-Key': 'retry-key' }),
        }));
    });

    it('exposes Retry-After on 429 errors', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'run_rate_exceeded', message: 'Run rate limit exceeded; retry shortly', request_id: 'req_429' },
        }), { status: 429, headers: { 'Retry-After': '7' } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error).toBeInstanceOf(CencoriEmbeddedApiError);
        expect(error.status).toBe(429);
        expect(error.code).toBe('run_rate_exceeded');
        expect(error.retryAfterSeconds).toBe(7);
    });

    it('falls back to retry_after_ms in the body when the header is missing', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429b', retry_after_ms: 4500 },
        }), { status: 429 }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBe(5);
    });

    it('treats large retry_after body values as seconds, not milliseconds', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429c', retry_after: 3600 },
        }), { status: 429 }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBe(3600);
    });

    it('parses HTTP-date Retry-After into remaining seconds', async () => {
        const future = new Date(Date.now() + 120_000).toUTCString();
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429d' },
        }), { status: 429, headers: { 'Retry-After': future } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(119);
        expect(error.retryAfterSeconds).toBeLessThanOrEqual(120);
    });

    it('normalizes past HTTP-date Retry-After to zero', async () => {
        const past = new Date(Date.now() - 60_000).toUTCString();
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429e' },
        }), { status: 429, headers: { 'Retry-After': past } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBe(0);
    });

    it('rejects malformed numeric Retry-After values', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429f' },
        }), { status: 429, headers: { 'Retry-After': '60garbage' } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBeNull();
    });

    it('rejects fractional Retry-After values', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429g' },
        }), { status: 429, headers: { 'Retry-After': '2.5' } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBeNull();
    });

    it('uses JSON fallback when the header is malformed', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: { type: 'invalid_request_error', code: 'rate_limit_exceeded', message: 'Rate limit exceeded', request_id: 'req_429h', retry_after_seconds: 10 },
        }), { status: 429, headers: { 'Retry-After': '60garbage' } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.retryAfterSeconds).toBe(10);
    });
});
