import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity, logApiGatewayRequest } from "@/lib/api-gateway-logs";
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
    type GatewayContext,
} from "@/lib/gateway-middleware";
import { extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";
import { resumeSessionTurn, type SupabaseAdmin } from "@/lib/gateway/session-engine";
import type { SubscriptionTier } from "@/lib/entitlements";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id/approve';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let gatewayCtx: GatewayContext | null = null;
    const { id: sessionId } = await params;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (!gatewayCtx) return response;
        void logApiGatewayRequest({
            projectId: gatewayCtx.projectId, apiKeyId: gatewayCtx.apiKeyId,
            requestId: gatewayCtx.requestId, endpoint, method: 'POST',
            statusCode: response.status, startedAt, environment: gatewayCtx.environment,
            ipAddress: gatewayCtx.clientIp, countryCode: gatewayCtx.countryCode,
            userAgent: req.headers.get('user-agent'),
            callerOrigin: callerIdentity.callerOrigin, clientApp: callerIdentity.clientApp,
            errorCode: errorCode || null, errorMessage: errorMessage || null,
        });
        return addGatewayHeaders(response, { requestId: gatewayCtx.requestId });
    };

    const respondError = (status: number, message: string, code = 'invalid_request_error') => {
        return respond(NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status }), code, message);
    };

    try {
        const authHeader = req.headers.get("Authorization");
        const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
        const isApiKeyAuth = !!providedApiKey;

        if (isApiKeyAuth) {
            const validation = await validateGatewayRequest(req);
            if (!validation.success) return validation.response;
            gatewayCtx = validation.context;
        } else if (authHeader) {
            const userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } },
            });
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            if (authError || !user) return respondError(401, "Unauthorized", "unauthorized");
        } else {
            return respondError(401, "Missing Authorization", "missing_authorization");
        }

        if (!gatewayCtx) return respondError(500, "Gateway context missing", "gateway_context_missing");

        const body = await req.json() as { action_id: string; tool_results?: Array<{ action_id: string; output: string }> };
        const { action_id, tool_results } = body;

        if (!action_id) {
            return respondError(400, "Missing action_id", "missing_action_id");
        }

        const adminClient = createAdminClient();

        const { data: session, error: sessionError } = await adminClient
            .from('sessions')
            .select('id, project_id, status, last_turn_number')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (session.project_id !== gatewayCtx.projectId) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (session.status !== 'paused') {
            return respondError(409, `Session is ${session.status}, not paused`, "session_not_paused");
        }

        // Fetch the paused event to verify action_id and compute next sequence
        const { data: pausedEvent } = await adminClient
            .from('session_events')
            .select('id, payload')
            .eq('session_id', sessionId)
            .eq('turn_number', session.last_turn_number)
            .eq('event_type', 'turn.paused')
            .single();

        if (!pausedEvent) {
            return respondError(409, "No pending pause to approve", "no_pending_pause");
        }

        const pausedPayload = pausedEvent.payload as Record<string, unknown>;
        if (pausedPayload.action_id !== action_id) {
            return respondError(409, "action_id does not match the paused tool call", "action_id_mismatch");
        }

        // If tool_results provided, verify at least one matches the paused action_id
        if (tool_results && tool_results.length > 0) {
            const validIds = new Set([action_id, ...Object.keys(pausedPayload.arguments as Record<string, unknown> || {})]);
            for (const tr of tool_results) {
                if (!validIds.has(tr.action_id)) {
                    return respondError(400, `tool_result action_id "${tr.action_id}" does not match any paused tool call`, "invalid_tool_result_action_id");
                }
            }
        }

        // Compute next sequence number for this turn
        const { data: seqResult } = await adminClient
            .from('session_events')
            .select('sequence')
            .eq('session_id', sessionId)
            .eq('turn_number', session.last_turn_number)
            .order('sequence', { ascending: false })
            .limit(1);

        const nextSeq = (seqResult && seqResult.length > 0 ? seqResult[0].sequence : 0) + 1;

        // Append turn.resumed event
        const { error: eventError } = await adminClient.from('session_events').insert({
            session_id: sessionId,
            turn_number: session.last_turn_number,
            sequence: nextSeq,
            event_type: 'turn.resumed',
            payload: { action_id, resolution: 'approved' },
        });

        if (eventError) {
            return respondError(500, eventError.message, 'event_creation_failed');
        }

        // Set session back to active (CAS: only if still paused) with no TTL
        const { data: updated, error: updateError } = await adminClient
            .from('sessions')
            .update({ status: 'active', expires_at: null })
            .eq('id', sessionId)
            .eq('status', 'paused')
            .select('id, status')
            .single();

        if (updateError) {
            if (updateError.code === 'PGRST116') {
                return respondError(409, 'Session was already processed by another request', 'concurrent_modification');
            }
            return respondError(500, updateError.message, 'session_update_failed');
        }

        // If tool results provided, resume the turn and return SSE stream
        if (tool_results && tool_results.length > 0) {
            const execResult = await resumeSessionTurn({
                supabase: adminClient as SupabaseAdmin,
                gatewayCtx,
                sessionId,
                turnNumber: session.last_turn_number,
                toolResults: tool_results,
                tier: (gatewayCtx.tier || "free") as SubscriptionTier,
                logSuccess: (meta) => {
                    void logGatewayRequest(gatewayCtx, {
                        endpoint: "/v1/sessions/:id/approve",
                        model: meta.model,
                        provider: meta.provider,
                        status: meta.status,
                        promptTokens: meta.promptTokens,
                        completionTokens: meta.completionTokens,
                        totalTokens: meta.totalTokens,
                        costUsd: meta.cencoriChargeUsd,
                        providerCostUsd: meta.providerCostUsd,
                        cencoriChargeUsd: meta.cencoriChargeUsd,
                        markupPercentage: meta.markupPercentage,
                        errorMessage: meta.errorMessage,
                    });
                },
                incrementUsage: (chargeUsd) => {
                    void incrementUsage(gatewayCtx, chargeUsd);
                },
            });

            if (!execResult.ok) {
                return respond(
                    NextResponse.json(execResult.body, { status: execResult.status }),
                    "resume_failed",
                    (execResult.body as { error?: { message?: string } }).error?.message || "Resume failed",
                );
            }

            return respond(execResult.response);
        }

        // No tool results — return acknowledgment
        return respond(NextResponse.json({
            id: sessionId,
            action_id,
            resolution: 'approved',
            status: 'active',
        }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
