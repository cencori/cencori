/**
 * GET  /api/studio/workspace?organization_id=        the business Studio shows, as JSON
 * POST /api/studio/workspace  { organization_id }    show this business in Studio
 *
 * The web app's pick is remembered in a cookie on this device, which the next
 * page load reads. The mobile app keeps its own pick and passes it to GET
 * (without one, GET falls back to the cookie, then the default business).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { STUDIO_ORG_COOKIE, loadStudioWorkspace } from '@/lib/studio/workspace';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) return fail('Sign in first.', 401);
    const asked = req.nextUrl.searchParams.get('organization_id');
    const picked = isId(asked) ? asked : req.cookies.get(STUDIO_ORG_COOKIE)?.value ?? null;
    // Null: signed in but no business with a project yet, which is what setup is for.
    const workspace = await loadStudioWorkspace(supabase, user, picked);
    return NextResponse.json({ workspace }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { organization_id?: unknown } | null;
    const organizationId = isId(body?.organization_id) ? body.organization_id : null;
    if (!organizationId) return fail('Say which business.');

    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user) return fail('Sign in first.', 401);
    // The user's own access rules: only organizations they belong to come back.
    const { data: organization } = await supabase.from('organizations').select('id').eq('id', organizationId).maybeSingle();
    if (!organization) return fail('That business isn\'t yours.', 404);

    const response = NextResponse.json({ ok: true });
    response.cookies.set(STUDIO_ORG_COOKIE, organizationId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
    });
    return response;
}
