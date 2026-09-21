import type { GatewayContext } from '@/lib/gateway-middleware';
import type { ExecutionContext } from './types';
import { verifyClientToken } from './client-tokens';
import { dePrefixId } from './http';

/** Build typed ExecutionContext from a secret-key gateway context + optional explicit scope. */
export function executionContextFromGateway(
    ctx: GatewayContext,
    scope: { tenantId?: string | null; externalUserId?: string | null; installationId?: string | null },
): ExecutionContext {
    return {
        organizationId: ctx.organizationId,
        projectId: ctx.projectId,
        environment: ctx.environment,
        tenantId: scope.tenantId ?? null,
        externalUserId: scope.externalUserId ?? null,
        installationId: scope.installationId ?? null,
        actor: 'project_service',
        requestId: ctx.requestId,
    };
}

/** Build ExecutionContext from a verified ect_ client token. Body scope cannot override claims. */
export function executionContextFromClientToken(
    claims: { project_id: string; env: string; tenant_id: string; external_user_id: string; installation_ids?: string[]; session_id?: string },
    requestId: string,
    opts: { installationId?: string; sessionId?: string },
): ExecutionContext | { error: string } {
    const granted = (claims.installation_ids ?? []).map(dePrefixId);
    if (opts.installationId && granted.length > 0) {
        if (!granted.includes(dePrefixId(opts.installationId))) {
            return { error: 'The installation does not belong to this tenant.' };
        }
    }
    if (opts.sessionId && claims.session_id && claims.session_id !== opts.sessionId) {
        return { error: 'Session does not belong to this token.' };
    }
    return {
        organizationId: '',
        projectId: claims.project_id,
        environment: claims.env,
        tenantId: claims.tenant_id,
        externalUserId: claims.external_user_id,
        installationId: (opts.installationId ? dePrefixId(opts.installationId) : granted[0]) ?? null,
        actor: 'client_user',
        requestId,
    };
}

export function extractEmbeddedBearer(req: Request): string | null {
    const h = req.headers.get('Authorization');
    if (!h) return null;
    const m = h.match(/^Bearer\s+(.+)$/i);
    return m?.[1]?.trim() || null;
}

export { verifyClientToken };
