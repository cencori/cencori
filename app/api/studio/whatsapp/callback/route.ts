/**
 * GET /api/studio/whatsapp/callback?code=&state=
 *
 * Meta's signup comes back here (Studio's redirect version). The signed state
 * says which assistant, and who started it; it must be the same person, still
 * signed in. Then the number is connected like the console's popup does it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import type { SubscriptionTier } from '@/lib/entitlements';
import { finishSignup, readState } from '@/lib/channels/whatsapp-signup';
import { returnPath, studioCallbackUrl, studioHome } from '@/app/api/studio/whatsapp/shared';

export async function GET(req: NextRequest) {
    const params = req.nextUrl.searchParams;
    const state = readState(params.get('state'));
    const home = studioHome(req, returnPath(state?.r));
    // Cancelled on Meta's side: Meta sends error_reason instead of a code.
    if (params.get('error') || params.get('error_reason')) return NextResponse.redirect(home('failed', 'Connecting WhatsApp was cancelled.'));
    const code = params.get('code')?.trim();
    if (!state || !code) return NextResponse.redirect(home('failed', 'That sign-up link expired. Try again.'));

    const access = await requireProjectAccess(state.p);
    if (!access.ok || access.userId !== state.u) return NextResponse.redirect(home('failed', 'Sign in to Studio as the person who started connecting, then try again.'));
    const db = createAdminClient();
    const [{ data: agent }, { data: organization }, { data: membership }] = await Promise.all([
        db.from('agents').select('id, name').eq('project_id', state.p).eq('id', state.a).maybeSingle(),
        db.from('organizations').select('owner_id, subscription_tier').eq('id', access.organizationId).maybeSingle(),
        db.from('organization_members').select('role').eq('organization_id', access.organizationId).eq('user_id', access.userId).maybeSingle(),
    ]);
    if (!agent) return NextResponse.redirect(home('failed', 'That assistant isn’t in this business any more.'));
    const canManage = organization?.owner_id === access.userId || ['owner', 'admin'].includes((membership?.role as string) ?? '');
    if (!canManage) return NextResponse.redirect(home('failed', 'Only owners and admins can connect WhatsApp.'));

    const saved = await finishSignup(db, {
        projectId: state.p,
        organizationId: access.organizationId,
        agentId: state.a,
        agentName: agent.name as string,
        tier: ((organization?.subscription_tier as string) || 'free') as SubscriptionTier,
        code,
        coexistence: state.c,
        redirectUri: studioCallbackUrl(req),
    });
    if (!saved.ok) return NextResponse.redirect(home('failed', saved.message));
    return NextResponse.redirect(home('connected'));
}
