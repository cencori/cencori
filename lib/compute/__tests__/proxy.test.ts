/**
 * @vitest-environment node
 *
 * Compute runtime proxy: successes pass through byte-identical; failures
 * come back as a structured envelope (code, message, requestId, timestamp,
 * upstream status) instead of raw upstream text.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { forwardJson } from '../proxy';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('forwardJson', () => {
    it('relays successful responses verbatim', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ id: 'run_1', status: 'ok' }), { status: 200 })
        );
        const res = await forwardJson('https://runtime.example', '/runs/1', 'GET');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ id: 'run_1', status: 'ok' });
    });

    it('normalizes upstream failures with code, request id, and timestamp', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(
            new Response(JSON.stringify({ error: 'validation_failed', message: 'Bad schema' }), {
                status: 422,
            })
        );
        const res = await forwardJson('https://runtime.example', '/runs', 'POST', '{}');
        expect(res.status).toBe(422);
        const body = await res.json();
        expect(body.code).toBe('validation_failed');
        expect(body.message).toBe('Bad schema');
        expect(typeof body.requestId).toBe('string');
        expect(typeof body.timestamp).toBe('string');
        expect(body.upstream_status).toBe(422);
    });

    it('structures even non-JSON upstream failures', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
        const res = await forwardJson('https://runtime.example', '/runs', 'GET');
        const body = await res.json();
        expect(res.status).toBe(502);
        expect(body.code).toBe('runtime_error_502');
        expect(typeof body.requestId).toBe('string');
    });

    it('returns runtime_unreachable with a request id when the host is down', async () => {
        vi.spyOn(global, 'fetch').mockRejectedValue(new Error('connect refused'));
        const res = await forwardJson('https://runtime.example', '/runs', 'GET');
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.code).toBe('runtime_unreachable');
        expect(typeof body.requestId).toBe('string');
    });
});
