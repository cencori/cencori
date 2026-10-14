/**
 * Cencori's OAuth client for "Sign in with CostGraph", as a Client ID Metadata Document.
 *
 * CostGraph fetches this URL — which is also our client_id — when someone signs in, and shows the
 * name, logo and links on its consent screen. Public by design: it holds no secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { clientMetadataDocument, costgraphOAuthEnabled } from '@/lib/finops/costgraph-oauth';

export async function GET(req: NextRequest) {
    if (!costgraphOAuthEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const origin = resolveConsoleBaseUrl(resolvePublicOrigin(req));
    return NextResponse.json(clientMetadataDocument(origin), {
        headers: { 'Cache-Control': 'public, max-age=3600' },
    });
}
