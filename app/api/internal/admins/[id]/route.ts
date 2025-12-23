import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Helper to check if user is a super_admin
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

// DELETE /api/internal/admins/[id] - Remove an admin
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

    // Only super_admins can remove admins
    const admin = await getSuperAdminStatus(user.id);
    if (!admin) {
        return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();

    // Get the admin to be removed
    const { data: targetAdmin } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, role, user_id')
        .eq('id', id)
        .single();

    if (!targetAdmin) {
        return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    // Prevent removing yourself
    if (targetAdmin.user_id === user.id) {
        return NextResponse.json({ error: 'You cannot remove yourself' }, { status: 400 });
    }

    // For pending invites, delete entirely. For active admins, set to revoked.
    const { error: deleteError } = await supabaseAdmin
        .from('cencori_admins')
        .update({ status: 'revoked' })
        .eq('id', id);

    if (deleteError) {
        console.error('[Admins] Error removing admin:', deleteError);
        return NextResponse.json({ error: 'Failed to remove admin' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Admin access revoked' });
}
