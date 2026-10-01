import { NextRequest, NextResponse } from 'next/server';
import { buildPublicCatalog } from '@/lib/catalog/public-catalog';

/**
 * GET /api/providers — public provider list (no auth).
 *
 * Lightweight companion to GET /api/models for products that only need the
 * provider shelf (logos, names, model counts) without pulling all 80 models.
 * Each row carries an absolute `logo_url` safe to hotlink:
 *
 *   <img src="https://cencori.com/api/providers/openai/logo" />
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
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || req.headers.get('host');
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto || (host?.includes('localhost') ? 'http' : 'https');
    const baseUrl = host ? `${proto}://${host}` : 'https://cencori.com';

    const catalog = buildPublicCatalog(baseUrl);

    return NextResponse.json(
        {
            object: 'list',
            data: catalog.providers,
            total: catalog.providers.length,
            updated_at: new Date().toISOString(),
        },
        { headers: PUBLIC_HEADERS },
    );
}
