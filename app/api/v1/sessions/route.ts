import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { extractGatewayCallerIdentity, logApiGatewayRequest } from "@/lib/api-gateway-logs";
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    type GatewayContext,
} from "@/lib/gateway-middleware";
import { extractBearerToken, extractCencoriApiKeyFromHeaders } from "@/lib/api-keys";
import { verifyClientToken } from "@/lib/embedded/client-tokens";
import { CLIENT_TOKEN_PREFIX } from "@/lib/embedded/types";
import { dePrefixId } from "@/lib/embedded/http";
import type { CreateSessionRequest } from "@/lib/gateway/session-types";
import { expireStaleSessions } from "@/lib/gateway/session-engine";

export async function OPTIONS() {
    return handleCorsPreFlight();
}

type AuthResult = {
    gatewayCtx: GatewayContext | null;
    embeddedScope?: { tenantId: string; externalUserId: string; installationIds?: string[]; permissions?: string[] } | null;
    respond: (response: NextResponse, errorCode?: string, errorMessage?: string) => NextResponse;
    respondError: (status: number, message: string, code?: string) => NextResponse;
    method: string;
    startedAt: number;
    callerIdentity: ReturnType<typeof extractGatewayCallerIdentity>;
    errorResponse: NextResponse | null;
};

async function authOrError(req: NextRequest): Promise<AuthResult> {
    const method = req.method;
    const endpoint = '/v1/sessions';
    const startedAt = Date.now();
    const callerIdentity = extractGatewayCallerIdentity(req.headers);
    let gatewayCtx: GatewayContext | null = null;

    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        if (!gatewayCtx) return response;
        void logApiGatewayRequest({
            projectId: gatewayCtx.projectId, apiKeyId: gatewayCtx.apiKeyId,
            requestId: gatewayCtx.requestId, endpoint, method,
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

    const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
    if (!providedApiKey) {
        // Browser-safe client token path (ect_): scope derives from verified claims, never body.
        const bearer = extractBearerToken(req.headers.get('Authorization'));
        if (bearer?.startsWith(CLIENT_TOKEN_PREFIX)) {
            const verified = verifyClientToken(bearer);
            if (!verified.ok) {
                return { gatewayCtx: null, embeddedScope: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: respondError(401, verified.message, verified.code) };
            }
            const admin = createAdminClient();
            const { data: project } = await admin.from('projects').select('id, organization_id').eq('id', verified.claims.project_id).maybeSingle();
            if (!project) {
                return { gatewayCtx: null, embeddedScope: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: respondError(401, 'Invalid client token project', 'client_token_revoked') };
            }
            const { data: tenant } = await admin.from('platform_tenants').select('id, status').eq('id', dePrefixId(verified.claims.tenant_id)).eq('project_id', verified.claims.project_id).maybeSingle();
            if (!tenant || (tenant.status as string) !== 'active') {
                return { gatewayCtx: null, embeddedScope: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: respondError(403, 'Tenant is not active', 'tenant_suspended') };
            }
            gatewayCtx = {
                supabase: admin as never,
                projectId: verified.claims.project_id,
                organizationId: (project.organization_id as string) ?? '',
                apiKeyId: null,
                allowedModels: null,
                sponsoredModels: null,
                fullySponsoredKey: false,
                environment: verified.claims.env,
                keyType: 'client_token',
                tier: 'embedded',
                requestId: crypto.randomUUID(),
                startTime: Date.now(),
                clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
                countryCode: null,
                projectName: '',
                defaultModel: null,
                defaultProvider: null,
                endUserBillingEnabled: false,
            };
            return {
                gatewayCtx,
                embeddedScope: { tenantId: tenant.id as string, externalUserId: verified.claims.external_user_id, installationIds: verified.claims.installation_ids?.map(dePrefixId), permissions: verified.claims.permissions },
                respond, respondError, method, startedAt, callerIdentity, errorResponse: null,
            };
        }
        return { gatewayCtx: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: respondError(401, "Missing CENCORI_API_KEY", "missing_api_key") };
    }

    const validation = await validateGatewayRequest(req);
    if (!validation.success) return { gatewayCtx: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: validation.response };
    gatewayCtx = validation.context;
    if (gatewayCtx.keyType !== 'secret') {
        return { gatewayCtx: null, respond, respondError, method, startedAt, callerIdentity, errorResponse: respondError(403, "This operation requires a secret project key", "secret_key_required") };
    }

    return { gatewayCtx, respond, respondError, method, startedAt, callerIdentity, errorResponse: null };
}

function handleAuthResult(result: AuthResult): { gatewayCtx: GatewayContext; embeddedScope: AuthResult['embeddedScope']; respond: AuthResult['respond']; respondError: AuthResult['respondError'] } | NextResponse {
    if (result.errorResponse) return result.errorResponse;
    if (!result.gatewayCtx) return result.respondError(401, "Unauthorized", "unauthorized");
    return { gatewayCtx: result.gatewayCtx, embeddedScope: result.embeddedScope ?? null, respond: result.respond, respondError: result.respondError };
}

export async function GET(req: NextRequest) {
    const authResult = await authOrError(req);
    const auth = handleAuthResult(authResult);
    if ('status' in auth) return auth;
    const { gatewayCtx, embeddedScope, respond, respondError } = auth;

    try {
        const adminClient = createAdminClient();

        // Sweep expired paused sessions before listing
        void expireStaleSessions(adminClient as never).catch((error) => {
            console.error('[Sessions] Opportunistic expiry failed:', error);
        });

        const searchParams = req.nextUrl.searchParams;
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
        const offset = (page - 1) * limit;
        const statusFilter = searchParams.get('status');
        const agentIdFilter = searchParams.get('agent_id');

        let query = adminClient
            .from('sessions')
            .select('id, status, last_turn_number, created_at, updated_at, agent_id, metadata, total_cost_usd, tenant_id, external_user_id, installation_id', { count: 'exact' })
            .eq('project_id', gatewayCtx.projectId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (statusFilter) query = query.eq('status', statusFilter);
        if (agentIdFilter) query = query.eq('agent_id', agentIdFilter);
        // Client tokens see only their tenant AND user; secret keys may filter by tenant_id.
        if (embeddedScope?.tenantId) {
            if (!(embeddedScope.permissions ?? []).includes('sessions:turn')) {
                return respondError(403, 'Client token lacks sessions:turn permission', 'insufficient_scope');
            }
            query = query.eq('tenant_id', embeddedScope.tenantId).eq('external_user_id', embeddedScope.externalUserId);
        } else {
            const tenantFilter = searchParams.get('tenant_id');
            if (tenantFilter) query = query.eq('tenant_id', dePrefixId(tenantFilter));
        }

        const { data: sessions, error, count } = await query;

        if (error) return respondError(500, error.message, 'sessions_fetch_failed');

        return respond(NextResponse.json({
            data: (sessions || []).map(s => ({
                id: s.id, status: s.status,
                turn_count: s.last_turn_number,
                created_at: s.created_at, updated_at: s.updated_at,
                agent_id: s.agent_id, metadata: s.metadata,
                tenant_id: (s as { tenant_id?: string }).tenant_id ?? null,
                external_user_id: (s as { external_user_id?: string }).external_user_id ?? null,
                installation_id: (s as { installation_id?: string }).installation_id ?? null,
                total_cost: s.total_cost_usd ?? 0,
            })),
            pagination: { page, limit, total: count || 0, total_pages: count ? Math.ceil(count / limit) : 0 },
        }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}

export async function POST(req: NextRequest) {
    const authResult = await authOrError(req);
    const auth = handleAuthResult(authResult);
    if ('status' in auth) return auth;
    const { gatewayCtx, embeddedScope, respond, respondError } = auth;

    try {
        const body = await req.json() as CreateSessionRequest;
        const adminClient = createAdminClient();

        // Resolve embedded scope: ect_ claims win and cannot be overridden by body.
        let tenantId: string | null = null;
        let externalUserId: string | null = null;
        let installationId: string | null = null;

        if (embeddedScope) {
            if (!(embeddedScope.permissions ?? []).includes('sessions:create')) {
                return respondError(403, 'Client token lacks sessions:create permission', 'insufficient_scope');
            }
            if (body.tenant_id && dePrefixId(body.tenant_id) !== dePrefixId(embeddedScope.tenantId)) {
                return respondError(403, 'The installation does not belong to this tenant.', 'tenant_scope_mismatch');
            }
            if (body.external_user_id && body.external_user_id !== embeddedScope.externalUserId) {
                return respondError(403, 'The installation does not belong to this tenant.', 'tenant_scope_mismatch');
            }
            if (body.installation_id && embeddedScope.installationIds?.length && !embeddedScope.installationIds.map(dePrefixId).includes(dePrefixId(body.installation_id))) {
                return respondError(403, 'The installation does not belong to this tenant.', 'tenant_scope_mismatch');
            }
            // A token without an installation list may still name one, but it
            // must belong to the token's tenant — never a foreign installation.
            if (body.installation_id && !embeddedScope.installationIds?.length) {
                const { data: ins } = await adminClient
                    .from('agent_installations')
                    .select('id, tenant_id')
                    .eq('project_id', gatewayCtx.projectId)
                    .eq('id', dePrefixId(body.installation_id))
                    .maybeSingle();
                if (!ins || (ins.tenant_id as string) !== embeddedScope.tenantId) {
                    return respondError(403, 'The installation does not belong to this tenant.', 'tenant_scope_mismatch');
                }
            }
            tenantId = embeddedScope.tenantId;
            externalUserId = embeddedScope.externalUserId;
            // Raw UUID into the UUID column — never the prefixed public form.
            installationId = body.installation_id ? dePrefixId(body.installation_id) : (embeddedScope.installationIds?.[0] ?? null);
        } else if (body.tenant_id || body.installation_id || body.external_user_id) {
            // Secret-key path: trusted, but tenant/user must exist under this project.
            if (body.tenant_id) {
                const raw = dePrefixId(body.tenant_id);
                const { data: tenant } = await adminClient.from('platform_tenants').select('id, status').eq('project_id', gatewayCtx.projectId).eq('id', raw).maybeSingle();
                const tenantRow = tenant ?? (await adminClient.from('platform_tenants').select('id, status').eq('project_id', gatewayCtx.projectId).eq('external_id', body.tenant_id).maybeSingle()).data;
                if (!tenantRow) return respondError(404, 'Tenant not found', 'tenant_not_found');
                if ((tenantRow.status as string) !== 'active') return respondError(403, 'Tenant is not active', 'tenant_suspended');
                tenantId = (tenantRow as { id: string }).id;
            }
            if (body.external_user_id) {
                if (!tenantId) return respondError(400, 'tenant_id is required with external_user_id', 'tenant_scope_mismatch');
                const { data: user } = await adminClient.from('platform_users').select('id, status').eq('project_id', gatewayCtx.projectId).eq('tenant_id', tenantId).eq('external_id', body.external_user_id).maybeSingle();
                if (!user) return respondError(404, 'User not found for tenant', 'user_not_found');
                if ((user.status as string) !== 'active') return respondError(403, 'User is not active', 'user_not_found');
                externalUserId = body.external_user_id;
            }
            if (body.installation_id) {
                // The FK proves existence, not ownership: scope the load by
                // project and verify tenant/agent consistency before binding.
                const { data: ins } = await adminClient
                    .from('agent_installations')
                    .select('id, tenant_id, agent_id, status')
                    .eq('project_id', gatewayCtx.projectId)
                    .eq('id', dePrefixId(body.installation_id))
                    .maybeSingle();
                if (!ins) return respondError(404, 'Installation not found', 'installation_not_found');
                if ((ins.status as string) !== 'active') return respondError(409, 'Installation is not active', 'installation_not_found');
                if (tenantId && (ins.tenant_id as string) !== tenantId) {
                    return respondError(403, 'The installation does not belong to this tenant.', 'tenant_scope_mismatch');
                }
                if (!tenantId) tenantId = (ins.tenant_id as string);
                installationId = (ins.id as string);
            }
        }

        if (body.agent_id) {
            const { data: agent, error: agentError } = await adminClient
                .from('agents')
                .select('id, project_id, is_active')
                .eq('id', body.agent_id)
                .maybeSingle();

            if (agentError) {
                return respondError(500, 'Failed to verify agent', 'agent_access_check_failed');
            }
            if (!agent || agent.project_id !== gatewayCtx.projectId) {
                return respondError(404, 'Agent not found', 'agent_not_found');
            }
            if (installationId) {
                const { data: insCheck } = await adminClient.from('agent_installations').select('agent_id').eq('id', installationId).maybeSingle();
                if (insCheck && (insCheck.agent_id as string) !== body.agent_id) {
                    return respondError(403, 'The installation does not belong to this agent.', 'tenant_scope_mismatch');
                }
            }
            if (!agent.is_active) {
                return respondError(409, 'Agent is not active', 'agent_inactive');
            }
        }

        const { data: session, error } = await adminClient.from('sessions').insert({
            project_id: gatewayCtx.projectId,
            organization_id: gatewayCtx.organizationId,
            status: 'active',
            agent_id: body.agent_id || null,
            metadata: body.metadata || {},
            tenant_id: tenantId,
            external_user_id: externalUserId,
            installation_id: installationId,
        }).select('id, status, last_turn_number, created_at, updated_at, agent_id, metadata, total_cost_usd, tenant_id, external_user_id, installation_id').single();

        if (error || !session) {
            return respondError(500, error?.message || 'Failed to create session', 'session_creation_failed');
        }

        return respond(NextResponse.json({
            id: session.id, status: session.status,
            turn_count: session.last_turn_number,
            created_at: session.created_at, updated_at: session.updated_at,
            agent_id: session.agent_id, metadata: session.metadata,
            tenant_id: (session as { tenant_id?: string }).tenant_id ?? null,
            external_user_id: (session as { external_user_id?: string }).external_user_id ?? null,
            installation_id: (session as { installation_id?: string }).installation_id ?? null,
            total_cost: session.total_cost_usd ?? 0,
        }, { status: 201 }));
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Internal server error";
        return respondError(500, message, 'internal_error');
    }
}
