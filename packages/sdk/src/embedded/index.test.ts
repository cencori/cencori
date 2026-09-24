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
});
