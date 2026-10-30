/**
 * GET /api/studio/whatsapp/callback?code=&state=
 *
 * Meta's signup comes back here (Studio's redirect version). The signed state
 * says which assistant, and who started it; it must be the same person, still
 * signed in. Then the number is connected like the console's popup does it.
 *
 * Started from the mobile app (state.m), the sign-in is in the app, not this
 * browser: the code goes back to the app sealed, and the app finishes with
 * POST /api/studio/whatsapp/finish, where the same-person check happens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { readState } from '@/lib/channels/whatsapp-signup';
import { appReturn, connectFromSignup, returnPath, sealHandoff, studioCallbackUrl, studioHome } from '@/app/api/studio/whatsapp/shared';

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const state = readState(params.get('state'));
    const cancelled = !!(params.get('error') || params.get('error_reason'));
    const code = params.get('code')?.trim();

    if (state?.m === 'app') {
        // Cancelled on Meta's side: Meta sends error_reason instead of a code.
        if (cancelled) return NextResponse.redirect(appReturn('failed', 'Connecting WhatsApp was cancelled.'));
        if (!code) return NextResponse.redirect(appReturn('failed', 'That sign-up link expired. Try again.'));
        const handoff = sealHandoff({ code, state: params.get('state')!, redirectUri: studioCallbackUrl(req) });
        return NextResponse.redirect(handoff ? appReturn('handoff', handoff) : appReturn('failed', 'Connecting WhatsApp isn’t set up yet.'));
    }

    const home = studioHome(req, returnPath(state?.r));
    if (cancelled) return NextResponse.redirect(home('failed', 'Connecting WhatsApp was cancelled.'));
    if (!state || !code) return NextResponse.redirect(home('failed', 'That sign-up link expired. Try again.'));

    const access = await requireProjectAccess(state.p);
    if (!access.ok || access.userId !== state.u) return NextResponse.redirect(home('failed', 'Sign in to Studio as the person who started connecting, then try again.'));
    const saved = await connectFromSignup({ state, userId: access.userId, organizationId: access.organizationId, code, redirectUri: studioCallbackUrl(req) });
    if (!saved.ok) return NextResponse.redirect(home('failed', saved.message));
    return NextResponse.redirect(home('connected'));
}
