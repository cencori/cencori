import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { extractGatewayCallerIdentity } from '@/lib/api-gateway-logs';
import { validateGatewayRequest, type GatewayContext } from '@/lib/gateway-middleware';
import { extractBearerToken, extractCencoriApiKeyFromHeaders } from '@/lib/api-keys';
import { verifyClientToken } from './client-tokens';
import { CLIENT_TOKEN_PREFIX } from './types';
import { dePrefixId } from './http';

export interface EmbeddedSessionAuth {
    gatewayCtx: GatewayContext;
    embeddedScope: { tenantId: string; externalUserId: string; installationIds?: string[]; permissions?: string[] } | null;
    respond: (response: NextResponse, errorCode?: string, errorMessage?: string) => NextResponse;
    respondError: (status: number, message: string, code?: string) => NextResponse;
}

/**
 * Shared session auth: secret-key (project_service) or ect_ client token (client_user).
 * Client-token scope derives from verified claims; body scope can never override it.
 */
export async function authSessionRequest(
    req: NextRequest,
    endpoint: string,
    startedAt: number,
    callerIdentity: ReturnType<typeof extractGatewayCallerIdentity>,
    logFn: (args: {
        projectId: string; apiKeyId: string | null; requestId: string; endpoint: string; method: string;
        statusCode: number; startedAt: number; environment: string; ipAddress: string; countryCode: string | null;
        userAgent: string | null; callerOrigin: string | null; clientApp: string | null;
        errorCode: string | null; errorMessage: string | null;
    }) => void,
    addHeaders: (r: NextResponse, opts: { requestId: string }) => NextResponse,
): Promise<NextResponse | EmbeddedSessionAuth> {
    const providedApiKey = extractCencoriApiKeyFromHeaders(req.headers);
    if (!providedApiKey) {
        const bearer = extractBearerToken(req.headers.get('Authorization'));
        if (bearer?.startsWith(CLIENT_TOKEN_PREFIX)) {
            const verified = verifyClientToken(bearer);
            const fail = (status: number, message: string, code: string) =>
                NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status });
            if (!verified.ok) return fail(401, verified.message, verified.code);
            const admin = createAdminClient();
            const { data: project } = await admin.from('projects').select('id, organization_id').eq('id', verified.claims.project_id).maybeSingle();
            if (!project) return fail(401, 'Invalid client token project', 'client_token_revoked');
            const { data: tenant } = await admin.from('platform_tenants').select('id, status').eq('id', dePrefixId(verified.claims.tenant_id)).eq('project_id', verified.claims.project_id).maybeSingle();
            if (!tenant || (tenant.status as string) !== 'active') return fail(403, 'Tenant is not active', 'tenant_suspended');
            const requestId = crypto.randomUUID();
            const gatewayCtx = {
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
                requestId,
                startTime: Date.now(),
                clientIp: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '',
                countryCode: null,
                projectName: '',
                defaultModel: null,
                defaultProvider: null,
                endUserBillingEnabled: false,
            } as unknown as GatewayContext;
            const respond = (response: NextResponse) => addHeaders(response, { requestId });
            const respondError = (status: number, message: string, code = 'invalid_request_error') =>
                respond(NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status }));
            return {
                gatewayCtx,
                embeddedScope: { tenantId: tenant.id as string, externalUserId: verified.claims.external_user_id, installationIds: verified.claims.installation_ids?.map(dePrefixId), permissions: verified.claims.permissions },
                respond,
                respondError,
            };
        }
        return NextResponse.json({ error: { message: 'Missing CENCORI_API_KEY', type: 'invalid_request_error', code: 'missing_api_key' }, status: 'failed' }, { status: 401 });
    }

    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') {
        return NextResponse.json({ error: { message: 'This operation requires a secret project key', type: 'invalid_request_error', code: 'secret_key_required' }, status: 'failed' }, { status: 403 });
    }
    const gatewayCtx = validation.context;
    const respond = (response: NextResponse, errorCode?: string, errorMessage?: string) => {
        void logFn({
            projectId: gatewayCtx.projectId, apiKeyId: gatewayCtx.apiKeyId, requestId: gatewayCtx.requestId,
            endpoint, method: req.method, statusCode: response.status, startedAt, environment: gatewayCtx.environment,
            ipAddress: gatewayCtx.clientIp, countryCode: gatewayCtx.countryCode, userAgent: req.headers.get('user-agent'),
            callerOrigin: callerIdentity.callerOrigin, clientApp: callerIdentity.clientApp,
            errorCode: errorCode || null, errorMessage: errorMessage || null,
        });
        return addHeaders(response, { requestId: gatewayCtx.requestId });
    };
    const respondError = (status: number, message: string, code = 'invalid_request_error') =>
        respond(NextResponse.json({ error: { message, type: 'invalid_request_error', code }, status: 'failed' }, { status }), code, message);
    return { gatewayCtx, embeddedScope: null, respond, respondError };
}

/** Fail closed when a session's tenant scope does not match the caller's scope. Returns true when denied. */
export function denyOnTenantMismatch(
    session: { project_id: string; tenant_id?: string | null },
    gatewayProjectId: string,
    embeddedScope: EmbeddedSessionAuth['embeddedScope'],
): 'project' | 'tenant' | null {
    if (session.project_id !== gatewayProjectId) return 'project';
    if (embeddedScope && session.tenant_id && session.tenant_id !== embeddedScope.tenantId) return 'tenant';
    return null;
}

/**
 * Full client-token scope check: project → tenant → user → installation.
 * A token may access only its tenant and user (PRD §14.3). Sessions stamped
 * before scoping existed (null user/installation) remain accessible within
 * the tenant so legacy browser flows keep working.
 */
export function denyOnScopeMismatch(
    session: { project_id: string; tenant_id?: string | null; external_user_id?: string | null; installation_id?: string | null },
    gatewayProjectId: string,
    embeddedScope: EmbeddedSessionAuth['embeddedScope'],
): 'project' | 'tenant' | 'user' | 'installation' | null {
    if (session.project_id !== gatewayProjectId) return 'project';
    if (!embeddedScope) return null;
    if (session.tenant_id && session.tenant_id !== embeddedScope.tenantId) return 'tenant';
    if (session.external_user_id && session.external_user_id !== embeddedScope.externalUserId) return 'user';
    // Compare normalized on both sides: callers pass raw UUIDs, but older
    // tokens or prefixed body values must not cause false scope failures.
    const granted = new Set((embeddedScope.installationIds ?? []).map(dePrefixId));
    if (session.installation_id && granted.size > 0 && !granted.has(dePrefixId(session.installation_id))) {
        return 'installation';
    }
    return null;
}

/** Client-token permission check. Secret-key callers bypass (full project access). */
export function hasClientPermission(
    embeddedScope: EmbeddedSessionAuth['embeddedScope'],
    permission: string,
): boolean {
    if (!embeddedScope) return true;
    return (embeddedScope.permissions ?? []).includes(permission);
}
