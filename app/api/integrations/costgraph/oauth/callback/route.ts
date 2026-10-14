/**
 * Finish "Connect CostGraph": CostGraph redirects here after the user signs in and approves.
 *
 * Exchanges the code (with the PKCE verifier held in our signed cookie), reads the user's CostGraph
 * tenants, and either finishes the connection (one tenant) or hands back to the console to pick a
 * tenant (several). Every outcome redirects back to where the user started, with `costgraph=…`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveConsoleBaseUrl } from '@/lib/auth-redirect';
import { resolvePublicOrigin } from '@/lib/public-origin';
import { requireOrgOwnerOrAdmin } from '@/lib/org-admin-access';
import { createAdminClient } from '@/lib/supabaseAdmin';
import {
    COSTGRAPH_OAUTH_PENDING_COOKIE,
    COSTGRAPH_OAUTH_STATE_COOKIE,
    CostGraphCapabilityMissing,
    CostGraphOAuthError,
    PENDING_MAX_AGE_MS,
    callbackUrl,
    exchangeAuthorizationCode,
    idTokenSubject,
    listTenants,
    oauthClientId,
    openOAuthState,
    revokeToken,
    sealSigned,
} from '@/lib/finops/costgraph-oauth';
import { encryptTokens, finishCostGraphConnect, type PendingConnect } from '@/lib/finops/costgraph-connect';
import { CostGraphError } from '@/lib/finops/costgraph';

const COOKIE_PATH = '/api/integrations/costgraph/oauth';

export async function GET(req: NextRequest) {
    const origin = resolveConsoleBaseUrl(resolvePublicOrigin(req));
    const url = new URL(req.url);
    const state = openOAuthState(req.cookies.get(COSTGRAPH_OAUTH_STATE_COOKIE)?.value, url.searchParams.get('state'));

    const finish = (returnTo: string, params: Record<string, string>, pending?: string) => {
        const target = new URL(returnTo, origin);
        for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
        const response = NextResponse.redirect(target);
        response.cookies.set(COSTGRAPH_OAUTH_STATE_COOKIE, '', { path: COOKIE_PATH, maxAge: 0 });
        if (pending) {
            // Read by the console's server action, so it has to reach console pages too.
            response.cookies.set(COSTGRAPH_OAUTH_PENDING_COOKIE, pending, {
                httpOnly: true,
                secure: origin.startsWith('https://'),
                sameSite: 'lax',
                path: '/',
                maxAge: PENDING_MAX_AGE_MS / 1000,
            });
        }
        return response;
    };

    if (!state) return finish('/home', { costgraph: 'error', reason: 'expired' });
    const { returnTo } = state;

    const denied = url.searchParams.get('error');
    if (denied) return finish(returnTo, { costgraph: 'error', reason: denied === 'access_denied' ? 'denied' : denied });

    const access = await requireOrgOwnerOrAdmin(state.orgSlug);
    if (!access.ok || access.userId !== state.userId || access.orgId !== state.organizationId) {
        return finish(returnTo, { costgraph: 'error', reason: 'forbidden' });
    }

    const code = url.searchParams.get('code');
    if (!code) return finish(returnTo, { costgraph: 'error', reason: 'no_code' });

    const clientId = oauthClientId(origin);
    try {
        const tokens = await exchangeAuthorizationCode({ code, verifier: state.verifier, clientId, redirectUri: callbackUrl(origin) });
        const tenants = await listTenants(tokens.accessToken);
        const subject = idTokenSubject(tokens.idToken);

        if (tenants.length === 0) {
            await revokeToken({ token: tokens.refreshToken, clientId });
            return finish(returnTo, { costgraph: 'error', reason: 'no_tenant' });
        }

        if (tenants.length > 1) {
            const pending: PendingConnect = {
                organizationId: state.organizationId,
                orgSlug: state.orgSlug,
                userId: state.userId,
                tokensEncrypted: encryptTokens(tokens, state.organizationId),
                subject,
                tenants,
                returnTo,
                issuedAt: Date.now(),
            };
            return finish(returnTo, { costgraph: 'choose_tenant' }, sealSigned(pending));
        }

        await finishCostGraphConnect({
            supabase: createAdminClient(),
            organizationId: state.organizationId,
            userId: state.userId,
            tokens,
            subject,
            tenant: tenants[0],
            clientId,
        });
        return finish(returnTo, { costgraph: 'connected' });
    } catch (error) {
        console.error('[CostGraph OAuth] callback failed:', error);
        const reason = error instanceof CostGraphCapabilityMissing ? 'unsupported'
            : error instanceof CostGraphOAuthError ? error.code
                // Creating a connection needs an owner, admin or billing admin in CostGraph.
                : error instanceof CostGraphError && error.status === 403 ? 'costgraph_role'
                    : 'failed';
        return finish(returnTo, { costgraph: 'error', reason });
    }
}
