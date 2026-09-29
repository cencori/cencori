import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { addGatewayHeaders, handleCorsPreFlight } from '@/lib/gateway-middleware';
import { embeddedError } from '@/lib/embedded/http';
import crypto from 'crypto';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

function encodeCursor(createdAt: string, id: string): string {
    return Buffer.from(JSON.stringify({ c: createdAt, i: id }), 'utf8').toString('base64url');
}

function parseCursor(raw: string | null): { createdAt: string; id: string } | { error: string } | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as { c?: unknown; i?: unknown };
        if (parsed && typeof parsed.c === 'string' && parsed.c && typeof parsed.i === 'string' && parsed.i) {
            return { createdAt: parsed.c, id: parsed.i };
        }
    } catch {
        // Fall through to invalid below.
    }
    return { error: 'Invalid cursor' };
}

// GET /v1/marketplace/agents — anonymous cross-project discovery.
// Only published versions explicitly marked public. Unlisted versions are
// addressable by id (detail route) but never listed.
export async function GET(req: NextRequest) {
    const requestId = crypto.randomUUID();
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
    const parsedCursor = parseCursor(url.searchParams.get('cursor'));
    if (parsedCursor && 'error' in parsedCursor) return addGatewayHeaders(embeddedError(400, 'invalid_request_error', parsedCursor.error, { requestId }), { requestId });
    let query = supabase
        .from('agent_versions')
        .select('id, agent_id, version, visibility, requirements_json, published_at, created_at')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
    if (parsedCursor && 'createdAt' in parsedCursor) {
        query = query.or(`created_at.lt.${parsedCursor.createdAt},and(created_at.eq.${parsedCursor.createdAt},id.lt.${parsedCursor.id})`);
    }
    const { data, error } = await query;
    if (error) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', error.message, { requestId }), { requestId });
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    // Two queries, never an embedded join: agent_versions links agents twice
    // (agent_id + agents.stable_version_id back-reference), which PostgREST
    // rejects as ambiguous.
    const agentIds = [...new Set(rows.map((v) => v.agent_id as string).filter(Boolean))];
    let agentsById = new Map<string, Record<string, unknown>>();
    if (agentIds.length > 0) {
        const { data: agentRows, error: agentError } = await supabase.from('agents').select('id, name, description').in('id', agentIds);
        if (agentError) return addGatewayHeaders(embeddedError(500, 'invalid_request_error', agentError.message, { requestId }), { requestId });
        agentsById = new Map(((agentRows ?? []) as Array<Record<string, unknown>>).map((a) => [a.id as string, a]));
    }
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    return addGatewayHeaders(
        NextResponse.json({
            data: page.map((v) => {
                const agent = agentsById.get(v.agent_id as string) ?? {};
                return {
                    version_id: v.id,
                    agent_id: v.agent_id,
                    version: v.version,
                    name: (agent.name as string | null) ?? null,
                    description: (agent.description as string | null) ?? null,
                    requirements: v.requirements_json ?? {},
                    published_at: v.published_at ?? null,
                };
            }),
            next_cursor: hasMore && last ? encodeCursor(last.created_at as string, last.id as string) : null,
        }),
        { requestId },
    );
}
