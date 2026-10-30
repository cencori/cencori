/**
 * GET /api/studio/app-auth/return?challenge=…&return=…[&error=…]
 *
 * The browser, signed in (or not), comes back here from the provider. The
 * session goes on to the app as a sealed code that only the app can open
 * (lib/studio/app-auth.ts); the browser keeps nothing it didn't have.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';
import { appAuthReturn, isAppReturn, isChallenge, sealCode } from '@/lib/studio/app-auth';

export async function GET(req: NextRequest) {
    const back = req.nextUrl.searchParams.get('return');
    const challenge = req.nextUrl.searchParams.get('challenge');
    if (!isAppReturn(back)) return NextResponse.json({ error: 'Open this from the Studio app.' }, { status: 400 });
    const fail = (message: string) => NextResponse.redirect(appAuthReturn(back, { message }));
    if (req.nextUrl.searchParams.get('error')) return fail("Couldn't sign in with that account. Try again.");
    if (!isChallenge(challenge)) return fail("Couldn't sign in. Try again.");

    // The session the provider's callback just set, checked, then its cookie as the app's bearer token.
    const context = await auth.$context;
    const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
    const token = req.cookies.get(context.authCookies.sessionToken.name)?.value;
    if (!session || !token) return fail("Couldn't sign in. Try again.");

    const code = sealCode(token, challenge);
    if (!code) return fail("Signing in isn't available right now.");
    return NextResponse.redirect(appAuthReturn(back, { code }));
}
