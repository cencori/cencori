/**
 * GET /api/studio/stores/return?provider=
 *
 * Where a store's sign-in (Composio) comes back to when it was started from
 * the mobile app: straight on to the app (`<scheme>://store?provider=`), which
 * then looks at the store again. Nothing secret comes through here; the
 * connection is already the project's, made by the signed-in POST that
 * started it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { STORES } from '@/lib/embedded/store-sync';
import { appLink } from '@/lib/studio/app-link';

export function GET(req: NextRequest) {
    const provider = req.nextUrl.searchParams.get('provider') ?? '';
    // Composio adds how the sign-in went (status=success or failed).
    const status = req.nextUrl.searchParams.get('status');
    if (!(provider in STORES)) return NextResponse.redirect(appLink('store', { outcome: 'failed' }));
    return NextResponse.redirect(appLink('store', { provider, outcome: status && status !== 'success' ? 'failed' : 'done' }));
}
