import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

const FOUNDER_EMAILS = process.env.FOUNDER_EMAILS.split(',');

const ALLOW_ALL_IN_DEV = process.env.ALLOW_ALL_IN_DEV === 'true';

async function getSuperAdminStatus(userId: string) {
    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id, role')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('role', 'super_admin')
        .single();
    return admin;
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = FOUNDER_EMAILS.includes(user.email);
    const admin = await getSuperAdminStatus(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || isFounder || !!admin;

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    const { data: targetAdmin } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, role, user_id')
        .eq('id', id)
        .single();

    if (!targetAdmin) {
        return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (targetAdmin.user_id === user.id) {
        return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }
    const { error: deleteError } = await supabaseAdmin
        .from('cencori_admins')
        .update({ status: 'revoked' })
        .eq('id', id);

    if (deleteError) {
        console.error('[Admins] Error removing admin:', deleteError);
        return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Admin access revoked' });
