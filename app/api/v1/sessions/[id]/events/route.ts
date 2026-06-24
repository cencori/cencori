import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity, logApiGatewayRequest } from "@/lib/api-gateway-logs";
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    type GatewayContext,
} from "@/lib/gateway-middleware";
import { extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id/events';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let gatewayCtx: GatewayContext | null = null;
    const { id: sessionId } = await params;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (!gatewayCtx) return response;
        void logApiGatewayRequest({
            projectId: gatewayCtx.projectId,
            apiKeyId: gatewayCtx.apiKeyId,
            requestId: gatewayCtx.requestId,
            endpoint,
            method: 'GET',
            statusCode: response.status,
            startedAt,
            environment: gatewayCtx.environment,
            ipAddress: gatewayCtx.clientIp,
            countryCode: gatewayCtx.countryCode,
            userAgent: req.headers.get('user-agent'),
            callerOrigin: callerIdentity.callerOrigin,
            clientApp: callerIdentity.clientApp,
            errorCode: errorCode || null,
            errorMessage: errorMessage || null,
        });
        return addGatewayHeaders(response, { requestId: gatewayCtx.requestId });
    };

    const respondError = (status: number, message: string, code = 'invalid_request_error') => {
        return respond(
            NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status }),
            code,
            message,
        );
    };

    try {
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);

        if (!providedApiKey) {
            return respondError(401, "Missing CENCORI_API_KEY", "missing_api_key");
        }

        const validation = await validateGatewayRequest(req);
        if (!validation.success) return validation.response;
        gatewayCtx = validation.context;

        const adminClient = createAdminClient();

        // Verify session belongs to project
        const { data: session, error: sessionError } = await adminClient
            .from('sessions')
            .select('id, project_id')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (session.project_id !== gatewayCtx.projectId) {
            return respondError(404, "Session not found", "session_not_found");
        }

        // Parse pagination
        const searchParams = req.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
        const offset = (page - 1) * limit;

        // Filter by turn_number if provided
        const turnFilter = searchParams.get('turn_number');
        const turnNumber = turnFilter ? parseInt(turnFilter, 10) : NaN;
        let query = adminClient
            .from('session_events')
            .select('id, session_id, turn_number, sequence, event_type, payload, created_at', { count: 'exact' })
            .eq('session_id', sessionId)
            .order('turn_number', { ascending: true })
            .order('sequence', { ascending: true })
            .order('id', { ascending: true })
            .range(offset, offset + limit - 1);

        if (turnFilter && !isNaN(turnNumber)) {
            query = query.eq('turn_number', turnNumber);
        }

        const { data: events, error, count } = await query;

        if (error) {
            return respondError(500, error.message, 'events_fetch_failed');
        }

        return respond(NextResponse.json({
            data: events || [],
            pagination: {
                page,
                limit,
                total: count || 0,
                total_pages: count ? Math.ceil(count / limit) : 0,
            },
        }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
