import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { validateGatewayRequest, addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, withPrefix } from '@/lib/embedded/http';
import { installMarketplaceVersion } from '@/lib/embedded/marketplace';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// POST /v1/marketplace/installations — fork a public agent version into the
// caller's project and install it pinned for a tenant. Fork (not link):
// later publisher edits never move the installed copy, and all spend bills
// to the caller's project. Grants are validated like first-party installs.
export async function POST(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const validation = await validateGatewayRequest(req);
    if (!validation.success) return validation.response;
    if (validation.context.keyType !== 'secret') return addGatewayHeaders(embeddedError(403, 'secret_key_required', 'This operation requires a secret project key', { requestId }), { requestId });
    const supabase = createAdminClient();

    let body: {
        version_id?: string; tenant_id?: string;
        knowledge_base_ids?: string[]; connection_ids?: string[];
        approval_policy?: Record<string, unknown>; budget?: Record<string, unknown>; overlay_config?: Record<string, unknown>;
    };
    try {
        body = await req.json();
    } catch {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'Invalid JSON body', { requestId }), { requestId });
    }
    if (!body.version_id?.trim() || !body.tenant_id?.trim()) {
        return addGatewayHeaders(embeddedError(400, 'invalid_request_error', 'version_id and tenant_id are required', { requestId }), { requestId });
    }

    const result = await installMarketplaceVersion(supabase as never, {
        projectId: validation.context.projectId,
        tier: (validation.context.tier as import('@/lib/entitlements').SubscriptionTier) ?? 'free',
        versionId: body.version_id as string,
        tenantRef: body.tenant_id as string,
        knowledgeBaseIds: body.knowledge_base_ids,
        connectionIds: body.connection_ids,
        overlayConfig: body.overlay_config,
        approvalPolicy: body.approval_policy,
        budget: body.budget,
    });
    if (!result.ok) {
        return addGatewayHeaders(embeddedError(result.status, result.code, result.message, { requestId }), { requestId });
    }
    const row = result.installation;
    return addGatewayHeaders(
        NextResponse.json({
            id: withPrefix('ins', row.id as string),
            tenant_id: withPrefix('ten', row.tenant_id as string),
            agent_id: row.agent_id,
            agent_version_id: row.agent_version_id ?? null,
            source_version_id: result.sourceVersionId,
            status: row.status,
            update_channel: row.update_channel,
            created_at: row.created_at,
        }, { status: 201 }),
        { requestId },
    );
}
