/**
 * GET /api/studio/whatsapp/test-number?phone_number_id=&waba_id=&agent_id=
 *
 * For recording Meta's App Review only: connects a number on Cencori's own
 * Meta app (Meta's free test number on the app's API Setup page) to one of the
 * signed-in owner's employees, as our own Embedded Signup would, so a message
 * to it gets that employee's reply. Our signup can't onboard numbers until
 * review grants advanced access, which is what the recording is for.
 *
 * Opened in a browser signed in to Studio. Only for the accounts in
 * META_SIGNUP_ALLOWLIST, and owners or admins. The number must be on that
 * WhatsApp account, and the account subscribed to our app; the channel uses
 * our system user's token (META_SYSTEM_USER_TOKEN). Without agent_id, the main
 * employee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { STUDIO_ORG_COOKIE, loadStudioWorkspace } from '@/lib/studio/workspace';
import { studioStaff } from '@/lib/studio/owner-chat';
import { signupAllowed } from '@/lib/channels/whatsapp-signup';
import { META_GRAPH_VERSION, getAgentChannel, saveSignupChannel } from '@/lib/channels/whatsapp';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const isMetaId = (value: unknown): value is string => typeof value === 'string' && /^\d{6,25}$/.test(value);

export async function GET(req: NextRequest) {
    const phoneNumberId = req.nextUrl.searchParams.get('phone_number_id');
    const wabaId = req.nextUrl.searchParams.get('waba_id');
    if (!isMetaId(phoneNumberId) || !isMetaId(wabaId)) return fail('Say which number: phone_number_id and waba_id, from the API Setup page.');

    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) return fail('Sign in to Studio first.', 401);
    if (!await signupAllowed()) return fail('This is only for recording App Review.', 403);
    const picked = req.cookies.get(STUDIO_ORG_COOKIE)?.value ?? null;
    const workspace = await loadStudioWorkspace(supabase, user, isId(picked) ? picked : null);
    if (!workspace) return fail('Set up your business in Studio first.', 404);
    const access = await requireProjectAccess(workspace.project.id);
    if (!access.ok) return access.response;
    if (!['owner', 'admin'].includes(access.role)) return fail('Only owners and admins can connect WhatsApp.', 403);

    const db = createAdminClient();
    const staff = await studioStaff(db as never, workspace.project.id);
    const askedAgent = req.nextUrl.searchParams.get('agent_id');
    const employee = askedAgent ? staff.find((agent) => agent.id === askedAgent) : staff[0];
    if (!employee) return fail(askedAgent ? 'That employee isn\'t in this business.' : 'Set up an employee first.', 404);

    // The number has to be on that account, and the account subscribed to our app, or messages won't reach us.
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) return fail('The system user token isn\'t set on this server.', 503);
    const graph = async (path: string) => {
        const response = await fetch(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        return { ok: response.ok, body: await response.json().catch(() => null) as { data?: Array<Record<string, unknown>>; error?: { message?: string } } | null };
    };
    const [numbers, apps] = await Promise.all([graph(`${wabaId}/phone_numbers?fields=id,display_phone_number`), graph(`${wabaId}/subscribed_apps`)]);
    if (!numbers.ok) return fail(`Meta wouldn't show that WhatsApp account: ${numbers.body?.error?.message ?? 'unknown error'}`, 502);
    if (!numbers.body?.data?.some((number) => number.id === phoneNumberId)) return fail('That number isn\'t on that WhatsApp account.');
    const appId = process.env.META_APP_ID;
    const subscribed = apps.body?.data?.some((app) => (app.whatsapp_business_api_data as { id?: string } | undefined)?.id === appId);
    if (!subscribed) return fail('That WhatsApp account isn\'t subscribed to our app yet, so messages wouldn\'t reach us.', 409);

    const saved = await saveSignupChannel(db, {
        projectId: workspace.project.id,
        organizationId: access.organizationId,
        agentId: employee.id,
        existing: await getAgentChannel(db, workspace.project.id, employee.id),
        phoneNumberId,
        wabaId,
        accessToken: token,
        coexistence: false,
    });
    if (!saved.ok) return fail(saved.message, saved.status);
    return NextResponse.json({
        connected: true,
        employee: employee.name,
        number: saved.channel.metadata.display_phone_number ?? phoneNumberId,
        next: `Message ${saved.channel.metadata.display_phone_number ?? 'the number'} on WhatsApp from your phone: ${employee.name} answers.`,
    });
}
