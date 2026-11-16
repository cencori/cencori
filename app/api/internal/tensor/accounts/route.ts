import { getAuthUser } from '@/lib/auth/get-auth-user';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInternalAccess } from '@/lib/internal-access';

/**
 * Tensor accounts for the internal Tensor page: finding one, clearing the tasks counted in its
 * week, clearing everyone's, and putting a plan on it (database/brimble/2400).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The signed-in admin's email, or the response that turns the request away. */
async function admin(): Promise<{ email: string } | { denied: NextResponse }> {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);
    if (!user?.email) {
        return { denied: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }
    if (!(await checkInternalAccess(user.id, user.email))) {
        return { denied: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { email: user.email };
}

function failed(scope: string, error: { code?: string; message: string }): NextResponse {
    console.error(`[Tensor accounts] ${scope} failed:`, error.message);
    if (error.code === 'PGRST202') {
        return NextResponse.json({ error: 'not_installed' }, { status: 501 });
    }
    const known = ['basecode_account_missing', 'basecode_paid_plan_unavailable'].find((code) =>
        error.message.includes(code),
    );
    return NextResponse.json({ error: known ?? 'query_failed' }, { status: known ? 400 : 500 });
}

export async function GET(req: NextRequest) {
    const who = await admin();
    if ('denied' in who) return who.denied;

    const query = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 120);
    const { data, error } = await createAdminClient().rpc('basecode_admin_accounts', {
        p_query: query || null,
        p_limit: 20,
    });
    if (error) return failed('basecode_admin_accounts', error);
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const who = await admin();
    if ('denied' in who) return who.denied;

    const body = (await req.json().catch(() => null)) as
        | { action?: string; userId?: string; plan?: string; scope?: string }
        | null;
    const db = createAdminClient();

    if (body?.action === 'reset_week' && UUID.test(body.userId ?? '')) {
        const { data, error } = await db.rpc('basecode_admin_reset_week', {
            p_user_id: body.userId,
            p_admin_email: who.email,
        });
        return error ? failed('basecode_admin_reset_week', error) : NextResponse.json(data);
    }

    if (body?.action === 'reset_week_all' && (body.scope === 'paid' || body.scope === 'all')) {
        const { data, error } = await db.rpc('basecode_admin_reset_week_all', {
            p_scope: body.scope,
            p_admin_email: who.email,
        });
        return error ? failed('basecode_admin_reset_week_all', error) : NextResponse.json(data);
    }

    if (body?.action === 'set_plan' && UUID.test(body.userId ?? '') && /^[a-z]{2,20}$/.test(body.plan ?? '')) {
        const { data, error } = await db.rpc('basecode_admin_set_plan', {
            p_user_id: body.userId,
            p_plan_code: body.plan,
            p_admin_email: who.email,
        });
        return error ? failed('basecode_admin_set_plan', error) : NextResponse.json(data);
    }

    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
}
