import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity } from "@/lib/api-gateway-logs";
import {
    addGatewayHeaders,
    handleCorsPreFlight,
    type GatewayContext,
} from "@/lib/gateway-middleware";
import { authSessionRequest, denyOnScopeMismatch, hasClientPermission } from "@/lib/embedded/session-auth";
import { expireStaleSessions } from "@/lib/gateway/session-engine";

export async function OPTIONS() {
    return handleCorsPreFlight();
}

type HandlerContext = {
    gatewayCtx: GatewayContext;
    embeddedScope: { tenantId: string; externalUserId: string; installationIds?: string[]; permissions?: string[] } | null;
    respond: (response: NextResponse, errorCode?: string, errorMessage?: string) => NextResponse;
    respondError: (status: number, message: string, code?: string) => NextResponse;
};

async function authOrError(req: NextRequest, endpoint: string, startedAt: number, callerIdentity: ReturnType<typeof extractGatewayCallerIdentity>): Promise<NextResponse | HandlerContext> {
    const { logApiGatewayRequest } = await import("@/lib/api-gateway-logs");
    const result = await authSessionRequest(req, endpoint, startedAt, callerIdentity, (args) => {
        void logApiGatewayRequest({ ...args, apiKeyId: args.apiKeyId ?? '' });
    }, addGatewayHeaders);
    if ('status' in result) return result;
    return { gatewayCtx: result.gatewayCtx, embeddedScope: result.embeddedScope ?? null, respond: result.respond, respondError: result.respondError };
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    const { id } = await params;

    const ctx = await authOrError(req, endpoint, startedAt, callerIdentity);
    if ('status' in ctx) return ctx;
    const { gatewayCtx, embeddedScope, respondError, respond } = ctx;
    if (embeddedScope && !hasClientPermission(embeddedScope, 'sessions:turn')) {
        return respondError(403, 'Client token lacks sessions:turn permission', 'insufficient_scope');
    }

    try {
        const adminClient = createAdminClient();
        void expireStaleSessions(adminClient as never).catch((error) => {
            console.error('[Sessions] Opportunistic expiry failed:', error);
        });
        const { data: session, error } = await adminClient
            .from('sessions')
            .select('id, project_id, status, last_turn_number, created_at, updated_at, agent_id, metadata, total_cost_usd, tenant_id, external_user_id, installation_id')
            .eq('id', id)
            .single();

        if (error || !session) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (denyOnScopeMismatch(session as { project_id: string; tenant_id?: string | null; external_user_id?: string | null; installation_id?: string | null }, gatewayCtx.projectId, embeddedScope)) {
            return respondError(404, "Session not found", "session_not_found");
        }

        return respond(NextResponse.json({
            id: session.id,
            status: session.status,
            turn_count: session.last_turn_number,
            created_at: session.created_at,
            updated_at: session.updated_at,
            agent_id: session.agent_id,
            metadata: session.metadata,
            tenant_id: (session as { tenant_id?: string }).tenant_id ?? null,
            external_user_id: (session as { external_user_id?: string }).external_user_id ?? null,
            installation_id: (session as { installation_id?: string }).installation_id ?? null,
            total_cost: session.total_cost_usd ?? 0,
        }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const endpoint = '/v1/sessions/:id';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    const { id } = await params;

    const ctx = await authOrError(req, endpoint, startedAt, callerIdentity);
    if ('status' in ctx) return ctx;
    const { gatewayCtx, embeddedScope, respondError, respond } = ctx;
    if (embeddedScope && !hasClientPermission(embeddedScope, 'sessions:turn')) {
        return respondError(403, 'Client token lacks sessions:turn permission', 'insufficient_scope');
    }

    try {
        const adminClient = createAdminClient();

        const { data: session, error: fetchError } = await adminClient
            .from('sessions')
            .select('id, project_id, status, tenant_id')
            .eq('id', id)
            .single();

        if (fetchError || !session) {
            return respondError(404, "Session not found", "session_not_found");
        }

        if (denyOnScopeMismatch(session as { project_id: string; tenant_id?: string | null; external_user_id?: string | null; installation_id?: string | null }, gatewayCtx.projectId, embeddedScope)) {
            return respondError(404, "Session not found", "session_not_found");
        }

        const { error: deleteError } = await adminClient
            .from('sessions')
            .delete()
            .eq('id', id);

        if (deleteError) {
            return respondError(500, deleteError.message, 'session_deletion_failed');
        }

        return respond(NextResponse.json({ id, deleted: true }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
