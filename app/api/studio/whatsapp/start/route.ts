/**
 * GET /api/studio/whatsapp/start?project_id=&agent_id=&coexistence=1&return=/setup
 *
 * Studio's "Connect WhatsApp" through Cencori's own Meta app: off to Meta's
 * signup as a full page, not the console's popup (an app installed on a phone
 * can't be reported back to by a popup). Meta comes back to
 * /api/studio/whatsapp/callback. Only for those META_SIGNUP_ALLOWLIST lets in
 * until App Review approves it; everyone else connects through Kapso.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { signState, signupAllowed, signupDialogUrl } from '@/lib/channels/whatsapp-signup';
import { returnPath, studioCallbackUrl, studioHome } from '@/app/api/studio/whatsapp/shared';

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

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
    // Our own Meta signup is only open to some, until Meta's App Review approves it (META_SIGNUP_ALLOWLIST).
    if (!await signupAllowed()) return NextResponse.redirect(home('failed', 'Connect WhatsApp with the other option for now.'));

    const url = signupDialogUrl({
        redirectUri: studioCallbackUrl(req),
        state: signState({ p: projectId, a: agentId, u: access.userId, c: req.nextUrl.searchParams.get('coexistence') !== '0', r: back }),
        coexistence: req.nextUrl.searchParams.get('coexistence') !== '0',
    });
    if (!url) return NextResponse.redirect(home('failed', 'Connecting WhatsApp isn’t set up yet.'));
    return NextResponse.redirect(url);
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; agent_id?: unknown; coexistence?: unknown } | null;
    if (!isId(body?.project_id) || !isId(body?.agent_id)) return fail('Say which assistant.');
    const projectId = body.project_id;
    const agentId = body.agent_id;
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    const db = createAdminClient();
    const { data: agent } = await db.from('agents').select('id').eq('project_id', projectId).eq('id', agentId).maybeSingle();
    if (!agent) return fail('That assistant isn’t in this business.', 404);
    if (!await signupAllowed()) return fail('Connect WhatsApp with the other option for now.', 403);

    const coexistence = body.coexistence !== false;
    const url = signupDialogUrl({
        redirectUri: studioCallbackUrl(req),
        state: signState({ p: projectId, a: agentId, u: access.userId, c: coexistence, m: 'app' }),
        coexistence,
    });
    if (!url) return fail('Connecting WhatsApp isn’t set up yet.', 503);
    return NextResponse.json({ url });
}
