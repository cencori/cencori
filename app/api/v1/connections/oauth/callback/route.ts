import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { handleCorsPreFlight } from '@/lib/gateway-middleware';
import { completeOauthAuthorization, isAllowedReturnUrl, returnUrlWith } from '@/lib/embedded/oauth';
import { withPrefix } from '@/lib/embedded/http';

export async function OPTIONS() {
    return handleCorsPreFlight();
}

// GET /api/v1/connections/oauth/callback?code=&state= — browser redirect (state-verified, no auth header).
// With a `return_url` given at authorize, the browser is sent back there with
// `status=connected|error`; without one it gets JSON.
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const supabase = createAdminClient();

    if (error) {
        // The person declined, or the provider refused. Send them back to the app if we know where.
        if (state) {
            const { data: row } = await supabase.from('oauth_states').select('connection_id, metadata').eq('state', state).maybeSingle();
            const returnUrl = ((row?.metadata ?? {}) as { return_url?: unknown }).return_url;
            if (row && isAllowedReturnUrl(returnUrl)) {
                await supabase.from('oauth_states').delete().eq('state', state);
                return NextResponse.redirect(returnUrlWith(returnUrl, { status: 'error', error, connection_id: withPrefix('con', row.connection_id as string) }), 302);
            }
        }
        return NextResponse.json({ error: { message: `OAuth failed: ${error}`, code: 'oauth_failed' } }, { status: 400 });
    }
    if (!code || !state) {
        return NextResponse.json({ error: { message: 'code and state are required', code: 'invalid_request_error' } }, { status: 400 });
    }

    const done = await completeOauthAuthorization(supabase as never, { state, code });
    if (!done.ok) {
        if (done.returnUrl) {
            return NextResponse.redirect(returnUrlWith(done.returnUrl, {
                status: 'error',
                error: done.code,
                ...(done.connectionId ? { connection_id: withPrefix('con', done.connectionId) } : {}),
            }), 302);
        }
        return NextResponse.json({ error: { message: done.message, code: done.code } }, { status: done.status });
    }

    const connectionId = withPrefix('con', done.connectionId);
    try {
        const { triggerWebhooks } = await import('@/lib/webhooks/trigger');
        await triggerWebhooks(done.projectId, 'connection.active' as never, { connection_id: connectionId, connector: done.connector });
    } catch {
        // ignore
    }
    if (done.returnUrl) {
        return NextResponse.redirect(returnUrlWith(done.returnUrl, { status: 'connected', connection_id: connectionId }), 302);
    }
    return NextResponse.json({ connected: true, connection_id: connectionId });
}
