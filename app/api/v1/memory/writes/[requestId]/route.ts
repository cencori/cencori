/**
 * GET /v1/memory/writes/:requestId — confirm an async chat writeback.
 *
 * Chat writeback runs after the response flushes, so the chat response
 * carries `memory.write_request_id` (== the chat request id) with
 * `write_status: 'pending'`. Poll this endpoint until `status` leaves
 * `pending`: the writeback logs one `memory/writeback` row under the same
 * request id when it finishes.
 *
 * Isolation: rows are filtered by the caller's project — another org's
 * request id reads as `pending`, never leaks.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
} from '@/lib/gateway-middleware';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

/** Gateway request ids are UUIDs; bound the shape before querying. */
export function isValidWriteRequestId(value: string): boolean {
    return /^[A-Za-z0-9-]{8,64}$/.test(value);
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ requestId: string }> }
) {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;
    const { requestId } = await params;

    const respond = (body: unknown, status: number) =>
        addGatewayHeaders(NextResponse.json(body, { status }), { requestId: ctx.requestId });

    if (!isValidWriteRequestId(requestId)) {
        return respond({ error: 'bad_request', message: 'Invalid write request id.' }, 400);
    }

    try {
        const { data, error } = await ctx.supabase
            .from('ai_requests')
            .select('status, metadata, error_message, created_at')
            .eq('project_id', ctx.projectId)
            .eq('request_id', requestId)
            .eq('endpoint', 'memory/writeback')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return respond({ requestId, status: 'pending' }, 200);
        }

        const metadata = (data.metadata ?? {}) as {
            extracted?: unknown;
            written?: unknown;
            scope?: unknown;
        };
        return respond(
            {
                requestId,
                status: data.status === 'success' ? 'success' : 'error',
                extracted: typeof metadata.extracted === 'number' ? metadata.extracted : null,
                written: typeof metadata.written === 'number' ? metadata.written : null,
                scope: typeof metadata.scope === 'string' ? metadata.scope : null,
                error: typeof data.error_message === 'string' ? data.error_message : null,
                finishedAt: data.created_at,
            },
            200
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return respond({ error: 'internal_error', message }, 500);
    }
}
