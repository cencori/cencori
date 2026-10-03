/**
 * POST /v1/memory/export — GDPR export: a portable dump of everything stored
 * about a scope key. The read half of the right-to-be-forgotten contract
 * (pair with POST /v1/memory/forget or DELETE /v1/memory/:id).
 *
 * Cursor-paginated (created_at, limit ≤ 1000). Session scope is ephemeral
 * Redis state and is reported empty with `ephemeral: true` rather than dumped.
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
    getProjectMemorySettings,
    normalizeDirectiveScope,
    parseMemoryDirective,
    toMemoryId,
} from '@/lib/memory';
import type { SubscriptionTier } from '@/lib/entitlements';

/** Hard cap per export page — large dumps walk the cursor. */
export const MEMORY_EXPORT_MAX_LIMIT = 1000;

interface ExportMemoryRequest {
    userId?: string;
    sessionId?: string;
    scope?: string;
    workspaceId?: string;
    orgId?: string;
    namespace?: string;
    limit?: number;
    /** ISO created_at of the last memory on the previous page. */
    cursor?: string;
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
        const body: ExportMemoryRequest = await req.json();

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

        if (directive.scope === 'session') {
            return respond(
                {
                    scope: 'session',
                    scopeKey: directive.scopeKey,
                    memories: [],
                    count: 0,
                    nextCursor: null,
                    ephemeral: true,
                },
                200
            );
        }

        const limit = Math.min(
            MEMORY_EXPORT_MAX_LIMIT,
            Math.max(1, Math.round(typeof body.limit === 'number' ? body.limit : 200))
        );

        let cursor: string | null = null;
        if (body.cursor !== undefined) {
            const parsedCursor = Date.parse(body.cursor);
            if (!Number.isFinite(parsedCursor)) {
                return respond({ error: 'bad_request', message: 'cursor must be an ISO-8601 timestamp' }, 400);
            }
            cursor = new Date(parsedCursor).toISOString();
        }

        // An export is a read: count one search op.
        const searchOps = await checkMemoryOpsQuota(ctx.projectId, tier, directive.scopeKey, 'search');
        if (!searchOps.allowed) {
            return respond(buildMemoryOpsExceededBody(ctx.projectId, tier, 'search', searchOps), 429);
        }

        let query = ctx.supabase
            .from('gateway_memories')
            .select('id, scope, namespace, content, importance, metadata, status, created_at')
            .eq('organization_id', ctx.organizationId)
            .eq('project_id', ctx.projectId)
            .eq('scope', directive.scope)
            .eq('scope_key', directive.scopeKey)
            .order('created_at', { ascending: true })
            .limit(limit + 1);

        if (directive.namespace) {
            query = query.eq('namespace', directive.namespace);
        }
        if (cursor) {
            query = query.gt('created_at', cursor);
        }

        const { data, error } = await query;

        if (error) {
            return respond({ error: 'internal_error', message: 'Failed to export memories' }, 500);
        }

        const rows = data ?? [];
        const truncated = rows.length > limit;
        const page = truncated ? rows.slice(0, limit) : rows;

        await logGatewayRequest(ctx, {
            endpoint: 'memory/export',
            model: 'none',
            provider: 'none',
            status: 'success',
            metadata: { scope: directive.scope, exported: page.length, truncated },
            requestPayload: {
                operation: 'export',
                scope: directive.scope,
                scope_key: directive.scopeKey,
            },
        });

        return respond(
            {
                scope: directive.scope,
                scopeKey: directive.scopeKey,
                exportedAt: new Date().toISOString(),
                memories: page.map(row => ({
                    id: toMemoryId(row.id),
                    scope: row.scope,
                    namespace: row.namespace,
                    content: row.content,
                    importance: Number(row.importance),
                    metadata: row.metadata,
                    status: row.status,
                    createdAt: row.created_at,
                })),
                count: page.length,
                nextCursor: truncated ? page[page.length - 1].created_at : null,
                truncated,
            },
            200
        );
    } catch (error) {
        console.error('[Memory] Export API error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return respond({ error: 'internal_error', message }, 500);
    }
}
