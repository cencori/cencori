import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { AgentVersionsNamespace, CencoriEmbeddedApiError, RunsNamespace, TenantsNamespace, parseWebhook, verifyWebhookSignature } from './index';

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

    it('preserves gateway top-level code and retry hints', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            error: 'Rate limit exceeded', code: 'rate_limit_exceeded', retry_after_ms: 60000,
        }), { status: 429, headers: { 'Retry-After': '60', 'X-Request-Id': 'req_gw_1' } }));
        const error = await new RunsNamespace(config).create('agt_123', { input: {} }).catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.status).toBe(429);
        expect(error.code).toBe('rate_limit_exceeded');
        expect(error.retryAfterSeconds).toBe(60);
        expect(error.requestId).toBe('req_gw_1');
    });
});

describe('knowledge file upload', () => {
    it('sends multipart form data without a JSON content type', async () => {
        const { KnowledgeNamespace } = await import('./index');
        const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{"id":"src_1"}', { status: 201 }));
        const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

        await new KnowledgeNamespace(config).addFileSource('kb_1', pdf, { filename: 'handbook.pdf', metadata: { team: 'support' } });

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://cencori.com/v1/knowledge-bases/kb_1/sources');
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
        const form = init.body as FormData;
        expect((form.get('file') as File).name).toBe('handbook.pdf');
        expect(form.get('metadata')).toBe('{"team":"support"}');
    });
});

describe('version validation failures', () => {
    it('surfaces the server message and the individual errors', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            valid: false,
            errors: ['model is required', "skill version 'skv_1' is not published"],
            error: { type: 'invalid_request_error', code: 'validation_failed', message: "Version failed validation: model is required; skill version 'skv_1' is not published", request_id: 'req_v' },
        }), { status: 422 }));
        const error = await new AgentVersionsNamespace(config).validate('agt_1', '1.0.0').catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.status).toBe(422);
        expect(error.code).toBe('validation_failed');
        expect(error.message).toContain('model is required');
        expect(error.errors).toEqual(['model is required', "skill version 'skv_1' is not published"]);
    });

    it('never throws a blank message when the body has only an errors list and no status text', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
            valid: false, errors: ['model is required'],
        }), { status: 422, statusText: '' }));
        const error = await new AgentVersionsNamespace(config).validate('agt_1', '1.0.0').catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.message).toBe('Cencori API error: model is required');
    });

    it('falls back to the status code when the body says nothing', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 422, statusText: '' }));
        const error = await new AgentVersionsNamespace(config).validate('agt_1', '1.0.0').catch((e) => e) as CencoriEmbeddedApiError;
        expect(error.message).toBe('Cencori API error: Request failed with status 422');
    });
});

describe('webhook verification', () => {
    const secret = 'whsec_0123456789abcdef';
    const sign = (body: string, key = secret) => `sha256=${createHmac('sha256', key).update(body).digest('hex')}`;

    it('accepts the signature Cencori sends and rejects anything else', async () => {
        const body = JSON.stringify({ event: 'run.completed', project_id: 'p', timestamp: new Date().toISOString(), data: { run_id: 'r' } });
        expect(await verifyWebhookSignature(body, sign(body), secret)).toBe(true);
        expect(await verifyWebhookSignature(body, sign(body).toUpperCase().replace('SHA256', 'sha256'), secret)).toBe(true);
        expect(await verifyWebhookSignature(body + ' ', sign(body), secret)).toBe(false);
        expect(await verifyWebhookSignature(body, sign(body, 'another-secret-value'), secret)).toBe(false);
        for (const bad of [undefined, null, '', 'bad', 'sha256=abc', sign(body).slice(7)]) {
            expect(await verifyWebhookSignature(body, bad, secret)).toBe(false);
        }
    });

    it('parses a fresh delivery and rejects a stale one', async () => {
        const fresh = JSON.stringify({ event: 'run.completed', project_id: 'p', timestamp: new Date().toISOString(), data: { run_id: 'r' } });
        expect(await parseWebhook(fresh, sign(fresh), secret)).toMatchObject({ event: 'run.completed', data: { run_id: 'r' } });
        const stale = JSON.stringify({ event: 'run.completed', project_id: 'p', timestamp: new Date(Date.now() - 3_600_000).toISOString(), data: {} });
        expect(await parseWebhook(stale, sign(stale), secret)).toBeNull();
        expect(await parseWebhook(stale, sign(stale), secret, { toleranceSeconds: 0 })).not.toBeNull();
        expect(await parseWebhook(fresh, 'sha256=' + '0'.repeat(64), secret)).toBeNull();
    });
});
