import { NextRequest, NextResponse } from 'next/server';
import {
    addGatewayHeaders,
    incrementUsage,
    logGatewayRequest,
    validateGatewayRequest,
    type GatewayContext,
} from '@/lib/gateway-middleware';
import { WebRuntimeError } from './errors';
import { webCharge } from './pricing';

export interface WebRouteResult {
    body: unknown;
    status?: number;
    metadata?: Record<string, unknown>;
    /** How many priced units this call used (crawl: pages indexed). Default 1. */
    billableUnits?: number;
}

export async function runWebRoute(
    req: NextRequest,
    endpoint: string,
    operation: (body: Record<string, unknown>, ctx: GatewayContext) => Promise<WebRouteResult>,
): Promise<NextResponse> {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    const ctx = validation.context;
    const respond = (body: unknown, status: number) =>
        addGatewayHeaders(NextResponse.json(body, { status }), { requestId: ctx.requestId });

    // Kept outside the try so the failure path can still log what was sent.
    let bodyForLog: Record<string, unknown> | null = null;

    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new WebRuntimeError('invalid_json', 'Request body must be valid JSON');
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            throw new WebRuntimeError('invalid_request', 'Request body must be a JSON object');
        }

        bodyForLog = body as Record<string, unknown>;
        const result = await operation(body as Record<string, unknown>, ctx);
        // Priced per call (lib/web/pricing.ts); only a successful call is charged.
        const charge = webCharge(endpoint, result.billableUnits ?? 1);
        await logGatewayRequest(ctx, {
            endpoint,
            model: 'cencori-web-v2',
            provider: 'cencori',
            status: 'success',
            costUsd: charge,
            providerCostUsd: 0,
            cencoriChargeUsd: charge,
            markupPercentage: 0,
            metadata: { ...result.metadata, billable_units: result.billableUnits ?? 1 },
            // Without these the console shows a web row with nothing to inspect.
            requestPayload: body as Record<string, unknown>,
            responsePayload: result.body as Record<string, unknown>,
        });
        await incrementUsage(ctx, charge);
        return respond(result.body, result.status ?? 200);
    } catch (error) {
        const runtimeError = error instanceof WebRuntimeError
            ? error
            : new WebRuntimeError('internal_error', error instanceof Error ? error.message : 'Unknown error', 500);
        console.error(`[Cencori Web] ${endpoint} failed:`, error);
        await logGatewayRequest(ctx, {
            endpoint,
            model: 'cencori-web-v2',
            provider: 'cencori',
            status: 'error',
            errorMessage: runtimeError.message,
            metadata: { code: runtimeError.code },
            requestPayload: bodyForLog ?? undefined,
        });
        return respond({
            error: runtimeError.code,
            message: runtimeError.message,
            ...(runtimeError.details ? { details: runtimeError.details } : {}),
        }, runtimeError.status);
    }
}
