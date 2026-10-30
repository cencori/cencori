/**
 * POST /api/studio/whatsapp/finish  { handoff }
 *
 * The mobile app's last step of connecting WhatsApp: the handoff the callback
 * sent back to the app. It only connects for the person who started, signed
 * in to the app now; someone sent a stranger's signup link gets nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectAccess } from '@/lib/require-project-access';
import { readState } from '@/lib/channels/whatsapp-signup';
import { connectFromSignup, openHandoff } from '@/app/api/studio/whatsapp/shared';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { handoff?: unknown } | null;
    const handoff = openHandoff(body?.handoff);
    const state = handoff ? readState(handoff.state) : null;
    if (!handoff || !state || state.m !== 'app') return fail('That sign-up link expired. Try again.');

    const access = await requireProjectAccess(state.p);
    if (!access.ok) return access.response;
    if (access.userId !== state.u) return fail('Sign in to Studio as the person who started connecting, then try again.', 403);

    const saved = await connectFromSignup({ state, userId: access.userId, organizationId: access.organizationId, code: handoff.code, redirectUri: handoff.redirectUri });
    if (!saved.ok) return fail(saved.message, 409);
    return NextResponse.json({ ok: true });
}
