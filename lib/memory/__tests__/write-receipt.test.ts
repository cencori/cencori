/**
 * @vitest-environment node
 *
 * GET /v1/memory/writes/:requestId — the confirmed-written signal behind
 * chat's `memory.write_request_id`. Pending when the async writeback hasn't
 * logged yet; success/error once its `memory/writeback` row lands. Rows are
 * always filtered by the caller's project — foreign request ids read as
 * pending, never leak.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { createMockGatewayContext } from '@/lib/gateway/__tests__/fixtures';

const routeMocks = vi.hoisted(() => ({
    validateGatewayRequest: vi.fn(),
    addGatewayHeaders: vi.fn((res: Response) => res),
}));

vi.mock('@/lib/gateway-middleware', () => ({
    validateGatewayRequest: (...args: unknown[]) => routeMocks.validateGatewayRequest(...args),
    handleCorsPreFlight: vi.fn(),
    addGatewayHeaders: (...args: unknown[]) => (routeMocks.addGatewayHeaders as never as (...a: unknown[]) => unknown)(...args),
}));

import { GET } from '@/app/api/v1/memory/writes/[requestId]/route';
import { isValidWriteRequestId } from '@/lib/memory';

function mockSupabase(result: { data: unknown; error: unknown }) {
    const maybeSingle = vi.fn(async () => result);
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eqThird = vi.fn(() => ({ order }));
    const eqSecond = vi.fn(() => ({ eq: eqThird }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const select = vi.fn(() => ({ eq: eqFirst }));
    const from = vi.fn(() => ({ select }));
    return { supabase: { from } as never, chain: { eqFirst, eqSecond, eqThird } };
}

function getRequest(id: string): NextRequest {
    return new NextRequest(`http://x/v1/memory/writes/${id}`, { method: 'GET' });
}

describe('isValidWriteRequestId', () => {
    it('accepts gateway UUIDs and rejects junk', () => {
        expect(isValidWriteRequestId('f2f55531-0a92-4d45-8e78-6624d390c75d')).toBe(true);
        expect(isValidWriteRequestId('')).toBe(false);
        expect(isValidWriteRequestId('../ai_requests')).toBe(false);
        expect(isValidWriteRequestId("x' OR '1'='1")).toBe(false);
    });
});

describe('GET /v1/memory/writes/:requestId', () => {
    let ctx: ReturnType<typeof createMockGatewayContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        ctx = createMockGatewayContext();
        routeMocks.validateGatewayRequest.mockResolvedValue({ success: true, context: ctx });
    });

    it('rejects unauthenticated requests', async () => {
        routeMocks.validateGatewayRequest.mockResolvedValue({
            success: false,
            response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
        });
        const res = await GET(getRequest('req-1'), { params: Promise.resolve({ requestId: 'req-1' }) });
        expect(res.status).toBe(401);
    });

    it('400s on a malformed request id without touching the DB', async () => {
        const { supabase } = mockSupabase({ data: null, error: null });
        ctx.supabase = supabase as never;
        const res = await GET(getRequest('nope!'), { params: Promise.resolve({ requestId: 'nope!' }) });
        expect(res.status).toBe(400);
    });

    it('returns pending when the writeback has not logged yet', async () => {
        const { supabase, chain } = mockSupabase({ data: null, error: null });
        ctx.supabase = supabase as never;
        const res = await GET(getRequest('req-pending-1'), {
            params: Promise.resolve({ requestId: 'req-pending-1' }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            requestId: 'req-pending-1',
            status: 'pending',
            extracted: null,
            written: null,
            scope: null,
            error: null,
            finishedAt: null,
        });
        // Isolation: project filter is always applied.
        expect(chain.eqFirst).toHaveBeenCalledWith('project_id', ctx.projectId);
        expect(chain.eqSecond).toHaveBeenCalledWith('request_id', 'req-pending-1');
        expect(chain.eqThird).toHaveBeenCalledWith('endpoint', 'memory/writeback');
    });

    it('returns the writeback outcome on success', async () => {
        const { supabase } = mockSupabase({
            data: {
                status: 'success',
                metadata: { extracted: 3, written: 2, scope: 'user' },
                error_message: null,
                created_at: '2026-07-18T20:42:47.461867+00:00',
            },
            error: null,
        });
        ctx.supabase = supabase as never;
        const res = await GET(getRequest('req-done-1'), {
            params: Promise.resolve({ requestId: 'req-done-1' }),
        });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            requestId: 'req-done-1',
            status: 'success',
            extracted: 3,
            written: 2,
            scope: 'user',
            error: null,
            finishedAt: '2026-07-18T20:42:47.461867+00:00',
        });
    });

    it('surfaces writeback failures as error with the message', async () => {
        const { supabase } = mockSupabase({
            data: {
                status: 'error',
                metadata: { extracted: 1, written: 0, scope: 'user' },
                error_message: 'memory_ops_quota_exceeded',
                created_at: '2026-07-18T20:42:47.461867+00:00',
            },
            error: null,
        });
        ctx.supabase = supabase as never;
        const res = await GET(getRequest('req-fail-1'), {
            params: Promise.resolve({ requestId: 'req-fail-1' }),
        });
        const body = await res.json();
        expect(body.status).toBe('error');
        expect(body.error).toBe('memory_ops_quota_exceeded');
        expect(body.written).toBe(0);
    });

    it('500s when the log lookup fails', async () => {
        const { supabase } = mockSupabase({ data: null, error: { message: 'db down' } });
        ctx.supabase = supabase as never;
        const res = await GET(getRequest('req-err-1'), {
            params: Promise.resolve({ requestId: 'req-err-1' }),
        });
        expect(res.status).toBe(500);
    });
});
