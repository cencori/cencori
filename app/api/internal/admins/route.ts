import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

const ALLOW_ALL_IN_DEV = true;

const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];

async function getAdminStatus(userId: string) {
    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id, role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    return admin;
}

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = FOUNDER_EMAILS.includes(user.email || '');
    const admin = await getAdminStatus(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || isFounder || !!admin;

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: admins, error } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, email, role, status, created_at, accepted_at, invited_by')
        .neq('status', 'revoked')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Admins] Error fetching admins:', error);
        return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
    }

    const currentUserRole = admin?.role || (isDev ? 'super_admin' : null);

    return NextResponse.json({ admins, currentUserRole });
}
