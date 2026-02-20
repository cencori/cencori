/**
 * Shadow Mode — Action Approval Polling
 * 
 * Agent clients poll this endpoint to check if their pending tool calls
 * have been approved or rejected by the user in the dashboard.
 * 
 * GET /api/v1/agent/actions/poll?ids=id1,id2,id3
 * 
 * Returns the status of each action:
 * - pending:  still waiting for user decision
 * - approved: user approved, safe to execute
 * - rejected: user rejected, do NOT execute
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import crypto from "crypto";
import { addGatewayHeaders } from "@/lib/gateway-middleware";
import { extractGatewayCallerIdentity, logApiGatewayRequest } from "@/lib/api-gateway-logs";

export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let apiLogContext: { projectId: string; apiKeyId: string; environment: string | null } | null = null;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (apiLogContext) {
            const forwardedFor = req.headers.get('x-forwarded-for');
            const clientIp = forwardedFor?.split(',')[0]?.trim() || req.headers.get('x-real-ip');

            void logApiGatewayRequest({
                projectId: apiLogContext.projectId,
                apiKeyId: apiLogContext.apiKeyId,
                requestId,
                endpoint: '/v1/agent/actions/poll',
                method: 'GET',
                statusCode: response.status,
                startedAt,
                environment: apiLogContext.environment,
                ipAddress: clientIp,
                countryCode: req.headers.get('x-vercel-ip-country') || req.headers.get('x-cencori-user-country'),
                userAgent: req.headers.get('user-agent'),
                callerOrigin: callerIdentity.callerOrigin,
                clientApp: callerIdentity.clientApp,
                errorCode: errorCode || null,
                errorMessage: errorMessage || null,
            });
        }

        return addGatewayHeaders(response, { requestId });
    };

    try {
        // ── Auth (same dual-mode as chat/completions) ──
        const authHeader = req.headers.get("Authorization");
        const apiKey = req.headers.get('CENCORI_API_KEY')
            || (authHeader?.startsWith('Bearer cake_') ? authHeader.replace('Bearer ', '').trim() : null)
            || (authHeader?.startsWith('Bearer cencori_') ? authHeader.replace('Bearer ', '').trim() : null)
            || (authHeader?.startsWith('Bearer cen_') ? authHeader.replace('Bearer ', '').trim() : null);

        if (!apiKey && !authHeader) {
            return respond(
                NextResponse.json({ error: "Missing Authorization" }, { status: 401 }),
                'missing_authorization',
                'Missing Authorization header'
            );
        }

        if (apiKey) {
            // Quick key validation
            const adminClient = createAdminClient();
            const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
            const { data, error } = await adminClient
                .from('api_keys')
                .select('id, project_id, environment')
                .eq('key_hash', keyHash)
                .is('revoked_at', null)
                .single();
            if (error || !data) {
                return respond(
                    NextResponse.json({ error: "Invalid API Key" }, { status: 401 }),
                    'invalid_api_key',
                    'Invalid API key'
                );
            }

            apiLogContext = {
                projectId: data.project_id,
                apiKeyId: data.id,
                environment: data.environment || null,
            };
        }

        // ── Parse action IDs ──
        const idsParam = req.nextUrl.searchParams.get("ids");
        if (!idsParam) {
            return respond(
                NextResponse.json({ error: "Missing 'ids' query parameter" }, { status: 400 }),
                'missing_ids',
                "Missing 'ids' query parameter"
            );
        }

        const ids = idsParam.split(",").filter(Boolean);
        if (ids.length === 0 || ids.length > 20) {
            return respond(
                NextResponse.json({ error: "Provide 1-20 action IDs" }, { status: 400 }),
                'invalid_ids',
                'Provide 1-20 action IDs'
            );
        }

        // ── Fetch action statuses ──
        const adminClient = createAdminClient();
        const { data: actions, error: fetchError } = await adminClient
            .from("agent_actions")
            .select("id, status, payload, approved_at")
            .in("id", ids);

        if (fetchError) {
            return respond(
                NextResponse.json({ error: "Failed to fetch actions" }, { status: 500 }),
                'action_fetch_failed',
                fetchError.message
            );
        }

        // Build response map
        const statusMap: Record<string, {
            status: string;
            approved_at: string | null;
            tool?: string;
        }> = {};

        for (const action of actions || []) {
            statusMap[action.id] = {
                status: action.status,
                approved_at: action.approved_at,
                tool: action.payload?.tool,
            };
        }

        // Check if all are resolved (no longer pending)
        const allResolved = Object.values(statusMap).every(a => a.status !== 'pending');
        const anyRejected = Object.values(statusMap).some(a => a.status === 'rejected');

        return respond(NextResponse.json({
            actions: statusMap,
            all_resolved: allResolved,
            any_rejected: anyRejected,
            // If still pending, suggest a retry interval
            ...(allResolved ? {} : { retry_after_ms: 2000 }),
        }));

    } catch (error: unknown) {
        console.error("Poll Error:", error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return respond(
            NextResponse.json({ error: message }, { status: 500 }),
            'internal_error',
            message
        );
    }
}
