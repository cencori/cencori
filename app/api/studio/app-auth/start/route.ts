/**
 * GET /api/studio/app-auth/start?provider=google|github&challenge=…&return=…
 *
 * The mobile app's Google or GitHub sign-in starts here, in the phone's
 * browser: on to the provider, as the web's buttons go, coming back to
 * /api/studio/app-auth/return (lib/studio/app-auth.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { isBetterAuthEnabled } from '@/lib/auth/flags';
import { appAuthReturn, isAppReturn, isChallenge } from '@/lib/studio/app-auth';
import { studioOrigin } from '@/lib/studio/routing';

const PROVIDERS = new Set(['google', 'github']);

export async function GET(req: NextRequest) {
    const provider = req.nextUrl.searchParams.get('provider');
    const challenge = req.nextUrl.searchParams.get('challenge');
    const back = req.nextUrl.searchParams.get('return');
    if (!isAppReturn(back)) return NextResponse.json({ error: 'Open this from the Studio app.' }, { status: 400 });
    if (!provider || !PROVIDERS.has(provider) || !isChallenge(challenge) || !isBetterAuthEnabled()) {
        return NextResponse.redirect(appAuthReturn(back, { message: "Couldn't start signing in. Try again." }));
    }

    const done = new URL('/api/studio/app-auth/return', studioOrigin(req.headers.get('host') ?? 'studio.cencori.com'));
    done.searchParams.set('challenge', challenge);
    done.searchParams.set('return', back);
    // Better Auth answers with the provider's address and sets the state cookie the callback checks; both go on to the browser.
    const started = await auth.api.signInSocial({
        body: { provider, callbackURL: done.toString(), errorCallbackURL: done.toString(), disableRedirect: true },
        headers: req.headers,
        asResponse: true,
    }).catch(() => null);
    const body = started?.ok ? await started.clone().json().catch(() => null) as { url?: string } | null : null;
    if (!started || !body?.url) return NextResponse.redirect(appAuthReturn(back, { message: "Couldn't start signing in. Try again." }));

    const response = NextResponse.redirect(body.url);
    for (const cookie of started.headers.getSetCookie()) response.headers.append('set-cookie', cookie);
    return response;
}
