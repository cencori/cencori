/**
 * POST /v1/memory/write/batch — write up to 50 memories in one call.
 *
 * One quota check, one ops unit, one embedding call, one reconciliation pass
 * for the whole batch — bulk seeding without N round trips. Per-item content
 * is validated (required, 10KB cap); PII redaction runs per fact inside
 * writeMemories and blocked facts are dropped.
 *
 * Auth: gateway API key. Org/project always from the authenticated context.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    validateGatewayRequest,
    addGatewayHeaders,
    handleCorsPreFlight,
    logGatewayRequest,
    incrementUsage,
} from '@/lib/gateway-middleware';
import { promptPayload, textResponsePayload } from '@/lib/gateway/log-payload';
import type { SubscriptionTier } from '@/lib/entitlements';
import {
    MEMORY_CONTENT_MAX_CHARS,
    appendSessionMemories,
    buildMemoryOpsExceededBody,
    buildQuotaCheckFailedBody,
    buildQuotaExceededBody,
    checkMemoryOpsQuota,
    checkMemoryQuota,
    getProjectMemorySettings,
    normalizeDirectiveScope,
    parseMemoryDirective,
    redactFact,
    writeMemories,
} from '@/lib/memory';

/** Hard cap on items per batch — bounds the reconcile candidate fan-out. */
export const MEMORY_BATCH_MAX_ITEMS = 50;

interface BatchMemoryItem {
    content?: string;
    importance?: number;
}

interface BatchWriteRequest {
    userId?: string;
    sessionId?: string;
    scope?: string;
    workspaceId?: string;
    orgId?: string;
    namespace?: string;
    metadata?: Record<string, unknown>;
    expiresAt?: string;
    memories?: BatchMemoryItem[];
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
        const body: BatchWriteRequest = await req.json();

        const settings = await getProjectMemorySettings(ctx.supabase, ctx.projectId);
        if (!settings.enabled) {
            return respond(
                { error: 'memory_disabled', message: 'Memory is disabled for this project.' },
                403
            );
        }

        const items = Array.isArray(body.memories) ? body.memories : [];
        if (items.length === 0) {
            return respond({ error: 'bad_request', message: 'memories must be a non-empty array' }, 400);
        }
        if (items.length > MEMORY_BATCH_MAX_ITEMS) {
            return respond(
                {
                    error: 'bad_request',
                    message: `memories is capped at ${MEMORY_BATCH_MAX_ITEMS} items per batch`,
                },
                400
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

        const facts: { content: string; importance: number }[] = [];
        for (let i = 0; i < items.length; i++) {
            const content = typeof items[i]?.content === 'string' ? (items[i].content as string).trim() : '';
            if (!content) {
                return respond({ error: 'bad_request', message: `memories[${i}].content is required` }, 400);
            }
            if (content.length > MEMORY_CONTENT_MAX_CHARS) {
                return respond(
                    {
                        error: 'bad_request',
                        message: `memories[${i}].content exceeds the ${MEMORY_CONTENT_MAX_CHARS}-character limit per memory`,
                    },
                    400
                );
            }
            const importance =
                typeof items[i]?.importance === 'number'
                    ? Math.min(1, Math.max(0, items[i].importance as number))
                    : 0.5;
            facts.push({ content, importance });
        }

        let expiresAt: string | null = null;
        if (body.expiresAt !== undefined) {
            const parsedExpiry = Date.parse(body.expiresAt);
            if (!Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now()) {
                return respond(
                    { error: 'bad_request', message: 'expiresAt must be a future ISO-8601 timestamp' },
                    400
                );
            }
            expiresAt = new Date(parsedExpiry).toISOString();
        }

        // ── Session scope: Redis, no embedding, no quota ──
        if (directive.scope === 'session') {
            const stored: { content: string; importance: number }[] = [];
            for (const fact of facts) {
                const redacted = await redactFact(ctx.supabase, ctx.projectId, fact.content);
                if (!redacted.blocked) stored.push({ content: redacted.content, importance: fact.importance });
            }
            const ok = await appendSessionMemories(
                ctx.organizationId,
                ctx.projectId,
                directive.scopeKey,
                stored,
                settings.sessionTtlSeconds
            );
            if (!ok) {
                return respond(
                    { error: 'memory_store_unavailable', message: 'Session memory could not be stored.' },
                    503
                );
            }
            return respond({ written: stored.length, requested: items.length, scope: 'session' }, 201);
        }

        const quota = await checkMemoryQuota(ctx.supabase, ctx.projectId, tier);
        if (!quota.allowed) {
            if (quota.error) return respond(buildQuotaCheckFailedBody(), 503);
            return respond(buildQuotaExceededBody(ctx.projectId, tier, quota.used, quota.limit), 429);
        }

        // One batch = one write op: a single embedding call + a single
        // reconciliation pass covers every item.
        const writeOps = await checkMemoryOpsQuota(ctx.projectId, tier, directive.scopeKey, 'write');
        if (!writeOps.allowed) {
            return respond(buildMemoryOpsExceededBody(ctx.projectId, tier, 'write', writeOps), 429);
        }

        const result = await writeMemories({
            supabase: ctx.supabase,
            organizationId: ctx.organizationId,
            projectId: ctx.projectId,
            tier,
            scope: directive.scope,
            scopeKey: directive.scopeKey,
            namespace: directive.namespace,
            facts,
            metadata: { ...body.metadata, extractedFrom: 'manual_batch' },
            expiresAt,
        });

        if (result.opsExceeded) {
            const ops = result.opsStatus
                ?? await checkMemoryOpsQuota(ctx.projectId, tier, directive.scopeKey, 'write');
            return respond(buildMemoryOpsExceededBody(ctx.projectId, tier, 'write', ops), 429);
        }

        await logGatewayRequest(ctx, {
            endpoint: 'memory/write',
            model: result.embeddingModel ?? 'unknown',
            provider: result.embeddingProvider ?? 'unknown',
            status: 'success',
            costUsd: result.embeddingCostUsd,
            cencoriChargeUsd: result.embeddingCostUsd,
            metadata: { scope: directive.scope, requested: items.length, written: result.written.length, batch: true },
            requestPayload: promptPayload(`${items.length} memories`, { scope: directive.scope }),
            responsePayload: textResponsePayload(
                result.written.map(m => m.content).join('\n'),
                { stored: true }
            ),
        });
        await incrementUsage(ctx, result.embeddingCostUsd);

        return respond(
            {
                written: result.written.map(m => ({
                    id: m.id,
                    content: m.content,
                    importance: m.importance,
                })),
                count: result.written.length,
                requested: items.length,
                scope: directive.scope,
                scopeKey: directive.scopeKey,
            },
            201
        );
    } catch (error) {
        console.error('[Memory] Batch write API error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return respond({ error: 'internal_error', message }, 500);
    }
}
