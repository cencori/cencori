/**
 * Start "Connect CostGraph": send an organization owner or admin to CostGraph to sign in.
 *
 * GET /api/integrations/costgraph/oauth/start?org=<orgSlug>&returnTo=<console path>
 */

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { requireOrgOwnerOrAdmin } from '@/lib/org-admin-access';
import {
    COSTGRAPH_OAUTH_STATE_COOKIE,
    buildAuthorizeUrl,
    callbackUrl,
    costgraphOAuthEnabled,
    costgraphOAuthScopes,
    createPkce,
    oauthClientId,
    safeReturnTo,
    sealOAuthState,
} from '@/lib/finops/costgraph-oauth';

function back(origin: string, returnTo: string, params: Record<string, string>) {
    const url = new URL(returnTo, origin);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
    const origin = resolveConsoleBaseUrl(resolvePublicOrigin(req));
    const url = new URL(req.url);
    const orgSlug = url.searchParams.get('org') ?? '';
    const returnTo = safeReturnTo(url.searchParams.get('returnTo'), '/home');

    if (!costgraphOAuthEnabled()) return back(origin, returnTo, { costgraph: 'error', reason: 'unavailable' });

    const access = await requireOrgOwnerOrAdmin(orgSlug);
    if (!access.ok) return back(origin, returnTo, { costgraph: 'error', reason: access.status === 401 ? 'signed_out' : 'forbidden' });

    const { verifier, challenge } = createPkce();
    const state = crypto.randomBytes(16).toString('base64url');
    const nonce = crypto.randomBytes(16).toString('base64url');

    const response = NextResponse.redirect(buildAuthorizeUrl({
        clientId: oauthClientId(origin),
        redirectUri: callbackUrl(origin),
        scopes: costgraphOAuthScopes(),
        state,
        nonce,
        codeChallenge: challenge,
    }));
    response.cookies.set(COSTGRAPH_OAUTH_STATE_COOKIE, sealOAuthState({
        state,
        nonce,
        verifier,
        organizationId: access.orgId,
        orgSlug,
        userId: access.userId,
        returnTo,
        issuedAt: Date.now(),
    }), {
        httpOnly: true,
        secure: origin.startsWith('https://'),
        sameSite: 'lax',
        path: '/api/integrations/costgraph/oauth',
        maxAge: 15 * 60,
    });
    return response;
}
