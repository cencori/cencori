/**
 * POST /api/studio/workspace  { organization_id }  show this business in Studio
 *
 * Remembered in a cookie on this device; the next page load reads it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/get-auth-user';
import { createServerClient } from '@/lib/supabaseServer';
import { STUDIO_ORG_COOKIE } from '@/lib/studio/workspace';

const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as { organization_id?: unknown } | null;
    const organizationId = typeof body?.organization_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.organization_id) ? body.organization_id : null;
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
