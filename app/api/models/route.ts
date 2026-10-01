import { NextRequest, NextResponse } from 'next/server';
import { buildPublicCatalog, filterPublicCatalog } from '@/lib/catalog/public-catalog';

/**
 * GET /api/models — public model catalog.
 *
 * No auth. Ships the same data rendered on https://cencori.com/ai-gateway/models
 * (providers, models, context windows, capabilities, display pricing).
 *
 * This is the *marketing* catalog: static, cacheable, no per-project
 * availability. Authenticated callers needing per-key availability, DB-backed
 * pricing and BYOK/custom rows should use `GET /api/v1/models` instead.
 *
 * Query params (all optional, combinable):
 *   ?provider=openai        provider id (case-insensitive)
 *   ?type=reasoning         model type (chat, reasoning, code, search, vision, image)
 *   ?search=gpt            substring match on name, id, provider, description
 *   ?capability=tools       repeatable or comma-separated:
 *                           reasoning, vision, code, search, image, tools,
 *                           structuredOutput, fileInput, videoInput,
 *                           audioInput, caching
 */

export const dynamic = 'force-static';
export const revalidate = 3600;

const PUBLIC_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: PUBLIC_HEADERS });
}

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider');
    const type = url.searchParams.get('type');
    const search = url.searchParams.get('search');
    const capabilities = url.searchParams.getAll('capability').flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

    // Absolute logo URLs must work when hotlinked from a third-party product,
    // so derive the base from the request host (proxies included) instead of
    // hardcoding the canonical domain.
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || req.headers.get('host');
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = host ? `${proto}://${host}` : 'https://cencori.com';

    const catalog = buildPublicCatalog(baseUrl);
    const filtered = filterPublicCatalog(catalog, {
        provider,
        type,
        search,
        capabilities,
    });

    const distinctModelIds = new Set(filtered.models.map((m) => m.id)).size;

    return NextResponse.json(
        {
            object: 'list',
            data: filtered.models,
            providers: filtered.providers,
            total: filtered.models.length,
            distinct_model_ids: distinctModelIds,
            updated_at: new Date().toISOString(),
        },
        { headers: PUBLIC_HEADERS },
    );
}
