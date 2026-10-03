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
import { fetchWriteReceipt, isValidWriteRequestId } from '@/lib/memory';

export async function OPTIONS() {
    return handleCorsPreFlight();
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
        const receipt = await fetchWriteReceipt(ctx.supabase, ctx.projectId, requestId);
        return respond(receipt, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return respond({ error: 'internal_error', message }, 500);
    }
}
