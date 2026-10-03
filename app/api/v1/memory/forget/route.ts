/**
 * POST /v1/memory/forget — forget memories by filter (hard delete).
 *
 * Forget is first-class: real row removal (not an annotation), audit-logged
 * under `memory/forget`. At least one bound is required — a scope key always,
 * plus optional namespace / before / ids — so there is no "delete everything
 * in the project" shape. Session scope clears the Redis list instead.
 *
 * Auth: gateway API key. Org/project always from the authenticated context.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
} from '@/lib/gateway-middleware';
import {
    buildMemoryOpsExceededBody,
    checkMemoryOpsQuota,
    clearSessionMemories,
    fromMemoryId,
    getProjectMemorySettings,
    normalizeDirectiveScope,
    parseMemoryDirective,
    toMemoryId,
} from '@/lib/memory';
import type { SubscriptionTier } from '@/lib/entitlements';

/** Hard cap per forget call — page with `before` cursors for larger purges. */
export const MEMORY_FORGET_MAX_ROWS = 1000;

interface ForgetMemoryRequest {
    userId?: string;
    sessionId?: string;
    scope?: string;
    workspaceId?: string;
    orgId?: string;
    namespace?: string;
    /** Forget memories created before this ISO-8601 instant. */
    before?: string;
    /** Forget only these memory ids (mem_-prefixed or raw). */
    ids?: string[];
}

export async function OPTIONS() {
    return handleCorsPreFlight();
}

export async function POST(req: NextRequest) {
    const validation = await validateGatewayRequest(req);
    if (!validation.success) {
        return validation.response;
    }
    const ctx = validation.context;

    const respond = (body: unknown, status: number) =>
        addGatewayHeaders(NextResponse.json(body, { status }), { requestId: ctx.requestId });

    try {
        const body: ForgetMemoryRequest = await req.json();

        const settings = await getProjectMemorySettings(ctx.supabase, ctx.projectId);
        if (!settings.enabled) {
            return respond(
                { error: 'memory_disabled', message: 'Memory is disabled for this project.' },
                403
            );
        }

        const parsed = parseMemoryDirective({
            userId: body.userId,
            sessionId: body.sessionId,
            scope: body.scope,
            workspaceId: body.workspaceId,
            orgId: body.orgId,
            namespace: body.namespace,
        });
        if (!parsed.ok) {
            return respond({ error: 'bad_request', message: parsed.error }, 400);
        }
        const directive = normalizeDirectiveScope(parsed.directive, ctx.organizationId);
        const tier = ctx.tier as SubscriptionTier;

        let before: string | null = null;
        if (body.before !== undefined) {
            const parsedBefore = Date.parse(body.before);
            if (!Number.isFinite(parsedBefore)) {
                return respond({ error: 'bad_request', message: 'before must be an ISO-8601 timestamp' }, 400);
            }
            before = new Date(parsedBefore).toISOString();
        }

        let ids: string[] | null = null;
        if (body.ids !== undefined) {
            if (!Array.isArray(body.ids) || body.ids.length === 0) {
                return respond({ error: 'bad_request', message: 'ids must be a non-empty array' }, 400);
            }
            if (body.ids.length > MEMORY_FORGET_MAX_ROWS) {
                return respond(
                    { error: 'bad_request', message: `ids is capped at ${MEMORY_FORGET_MAX_ROWS} per call` },
                    400
                );
            }
            ids = body.ids.map(id => fromMemoryId(String(id)));
        }

        // ── Session scope: drop the Redis list ──
        if (directive.scope === 'session') {
            await clearSessionMemories(ctx.organizationId, ctx.projectId, directive.scopeKey);
            await logGatewayRequest(ctx, {
                endpoint: 'memory/forget',
                model: 'none',
                provider: 'none',
                status: 'success',
                metadata: { scope: 'session' },
                requestPayload: { operation: 'forget', scope: 'session', scope_key: directive.scopeKey },
                responsePayload: { content: 'Cleared session memories', cleared: true },
            });
            return respond({ forgotten: 0, clearedSession: true, scope: 'session' }, 200);
        }

        // A forget is a mutation: count one write op.
        const writeOps = await checkMemoryOpsQuota(ctx.projectId, tier, directive.scopeKey, 'write');
        if (!writeOps.allowed) {
            return respond(buildMemoryOpsExceededBody(ctx.projectId, tier, 'write', writeOps), 429);
        }

        // Two-step with an explicit cap: select up to MAX+1 ids, then delete
        // exactly the first MAX. A bare DELETE has no reliable LIMIT.
        let selectQuery = ctx.supabase
            .from('gateway_memories')
            .select('id')
            .eq('organization_id', ctx.organizationId)
            .eq('project_id', ctx.projectId)
            .eq('scope', directive.scope)
            .eq('scope_key', directive.scopeKey);

        if (directive.namespace) {
            selectQuery = selectQuery.eq('namespace', directive.namespace);
        }
        if (before) {
            selectQuery = selectQuery.lt('created_at', before);
        }
        if (ids) {
            selectQuery = selectQuery.in('id', ids);
        }

        const { data: found, error: findError } = await selectQuery.limit(MEMORY_FORGET_MAX_ROWS + 1);

        if (findError) {
            return respond({ error: 'internal_error', message: 'Failed to forget memories' }, 500);
        }

        const rows = found ?? [];
        const truncated = rows.length > MEMORY_FORGET_MAX_ROWS;
        const targetIds = (truncated ? rows.slice(0, MEMORY_FORGET_MAX_ROWS) : rows).map(r => r.id);

        if (targetIds.length > 0) {
            const { error: deleteError } = await ctx.supabase
                .from('gateway_memories')
                .delete()
                .eq('organization_id', ctx.organizationId)
                .eq('project_id', ctx.projectId)
                .in('id', targetIds);

            if (deleteError) {
                return respond({ error: 'internal_error', message: 'Failed to forget memories' }, 500);
            }
        }

        const forgotten = targetIds.length;

        await logGatewayRequest(ctx, {
            endpoint: 'memory/forget',
            model: 'none',
            provider: 'none',
            status: 'success',
            metadata: {
                scope: directive.scope,
                namespace: directive.namespace,
                forgotten,
                truncated,
            },
            requestPayload: {
                operation: 'forget',
                scope: directive.scope,
                scope_key: directive.scopeKey,
                ...(directive.namespace ? { namespace: directive.namespace } : {}),
                ...(before ? { before } : {}),
                ...(ids ? { ids: ids.map(id => toMemoryId(id)) } : {}),
            },
            responsePayload: {
                content: `Forgot ${forgotten} memories`,
                forgotten,
            },
        });

        return respond(
            {
                forgotten,
                truncated,
                scope: directive.scope,
                scopeKey: directive.scopeKey,
            },
            200
        );
    } catch (error) {
        console.error('[Memory] Forget API error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return respond({ error: 'internal_error', message }, 500);
    }
}
