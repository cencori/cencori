/**
 * GET /api/studio/whatsapp/start?project_id=&agent_id=&coexistence=1&return=/setup
 *
 * Studio's "Connect WhatsApp": off to Meta's signup as a full page, not the
 * console's popup (an app installed on a phone can't be reported back to by a
 * popup). Meta comes back to /api/studio/whatsapp/callback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { signState, signupDialogUrl } from '@/lib/channels/whatsapp-signup';
import { returnPath, studioCallbackUrl, studioHome } from '@/app/api/studio/whatsapp/shared';

export async function GET(req: NextRequest) {
    const projectId = req.nextUrl.searchParams.get('project_id') ?? '';
    const agentId = req.nextUrl.searchParams.get('agent_id') ?? '';
    const back = returnPath(req.nextUrl.searchParams.get('return'));
    const home = studioHome(req, back);
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(agentId)) return NextResponse.redirect(home('failed', 'Say which assistant.'));
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return NextResponse.redirect(home('failed', 'Sign in to Studio first.'));
    const db = createAdminClient();
    const { data: agent } = await db.from('agents').select('id').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    if (!agent) return NextResponse.redirect(home('failed', 'That assistant isn’t in this business.'));

    const url = signupDialogUrl({
        redirectUri: studioCallbackUrl(req),
        state: signState({ p: projectId, a: agentId, u: access.userId, c: req.nextUrl.searchParams.get('coexistence') !== '0', r: back }),
        coexistence: req.nextUrl.searchParams.get('coexistence') !== '0',
    });
    if (!url) return NextResponse.redirect(home('failed', 'Connecting WhatsApp isn’t set up yet.'));
    return NextResponse.redirect(url);
}
