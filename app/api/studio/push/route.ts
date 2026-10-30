/**
 * POST   /api/studio/push  { project_id, subscription }  turn notifications on for this browser
 * POST   /api/studio/push  { project_id, expo_token }    turn them on for this phone (the mobile app)
 * DELETE /api/studio/push  { project_id, endpoint }      turn them off (endpoint, or the Expo token)
 *
 * The subscription is the browser's PushSubscription (endpoint + keys); the
 * Expo token is the app's ExponentPushToken[…].
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { requireProjectAccess } from '@/lib/require-project-access';
import { addExpoPushDevice, addPushDevice, isExpoPushToken, pushConfigured, removePushDevice } from '@/lib/studio/push';
import { isPublicHttpsUrl } from '@/lib/studio/push-endpoint';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function read(req: NextRequest) {
    const body = await req.json().catch(() => null) as { project_id?: unknown; subscription?: unknown; expo_token?: unknown; endpoint?: unknown } | null;
    const projectId = typeof body?.project_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.project_id) ? body.project_id : null;
    return { body, projectId };
}

export async function POST(req: NextRequest) {
    const { body, projectId } = await read(req);
    if (!projectId) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (body?.expo_token !== undefined) {
        if (!isExpoPushToken(body.expo_token)) return fail('That isn\'t a valid notification token.');
        await addExpoPushDevice(createAdminClient(), projectId, access.userId, body.expo_token);
        return NextResponse.json({ ok: true });
    }
    if (!pushConfigured()) return fail('Notifications aren\'t set up on this server yet.', 503);
    const subscription = body?.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
    const endpoint = typeof subscription?.endpoint === 'string' ? subscription.endpoint : '';
    const p256dh = typeof subscription?.keys?.p256dh === 'string' ? subscription.keys.p256dh : '';
    const auth = typeof subscription?.keys?.auth === 'string' ? subscription.keys.auth : '';
    // Push services are public HTTPS hosts; anything else is refused so we never post to a private address.
    if (!isPublicHttpsUrl(endpoint) || !p256dh || !auth || endpoint.length > 1000) return fail('That isn\'t a valid notification subscription.');
    await addPushDevice(createAdminClient(), projectId, access.userId, { endpoint, keys: { p256dh, auth } });
    return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
    const { body, projectId } = await read(req);
    if (!projectId) return fail('Say which project.');
    const access = await requireProjectAccess(projectId);
    if (!access.ok) return access.response;
    if (typeof body?.endpoint !== 'string') return fail('Say which device.');
    await removePushDevice(createAdminClient(), projectId, body.endpoint);
    return NextResponse.json({ ok: true });
}
