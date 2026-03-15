import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { isFounderEmail } from '@/lib/internal-admin-auth';

async function isAuthorizedAdmin(email: string): Promise<boolean> {
    if (isFounderEmail(email)) return true;
    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('status', 'active')
        .single();
    return !!admin;
}

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowed = await isAuthorizedAdmin(user.email);
    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const product = searchParams.get('product');
    const eventType = searchParams.get('event_type');
    const userId = searchParams.get('user_id');
    const orgId = searchParams.get('org_id');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const admin = createAdminClient();

    let query = admin
        .from('platform_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    if (product) query = query.eq('product', product);
    if (eventType) query = query.eq('event_type', eventType);
    if (userId) query = query.eq('user_id', userId);
    if (orgId) query = query.eq('organization_id', orgId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: events, count, error } = await query;

    if (error) {
        console.error('[Events API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
    }

    return NextResponse.json({
        events: events || [],
        total: count || 0,
        page,
        limit,
    });
}
