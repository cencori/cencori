import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError, dePrefixId } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /v1/marketplace/agents/:versionId — anonymous detail for public
// versions (unlisted addressable by id, never listed). Private and tenant
// versions are invisible here by construction.
export async function GET(req: NextRequest, ctx: { params: Promise<{ versionId: string }> }) {
    const requestId = crypto.randomUUID();
    const supabase = createAdminClient();
    const { versionId } = await ctx.params;
    const { data, error } = await supabase
        .from('agent_versions')
        .select('id, agent_id, version, visibility, status, config_json, requirements_json, published_at, created_at, agents!inner(id, name, description)')
        .eq('id', dePrefixId(versionId))
        .eq('status', 'published')
        .in('visibility', ['public', 'unlisted'])
        .maybeSingle();
    if (error || !data) return addGatewayHeaders(embeddedError(404, 'invalid_request_error', 'Agent version not found', { requestId }), { requestId });
    const v = data as Record<string, unknown>;
    return addGatewayHeaders(
        NextResponse.json({
            version_id: v.id,
            agent_id: v.agent_id,
            version: v.version,
            visibility: v.visibility,
            name: ((v.agents ?? {}) as Record<string, unknown>).name ?? null,
            description: ((v.agents ?? {}) as Record<string, unknown>).description ?? null,
            config: v.config_json ?? {},
            requirements: v.requirements_json ?? {},
            published_at: v.published_at ?? null,
        }),
        { requestId },
    );
}
