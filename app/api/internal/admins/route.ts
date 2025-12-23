import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// For development, allow all authenticated users temporarily
const ALLOW_ALL_IN_DEV = true;

// Helper to check if user is an active admin
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

// GET /api/internal/admins - List all admins
export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Dev mode bypass or admin check
    const isDev = process.env.NODE_ENV === 'development';
    const admin = await getAdminStatus(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || !!admin;

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { data: admins, error } = await supabaseAdmin
        .from('cencori_admins')
        .select('id, email, role, status, created_at, accepted_at, invited_by')
        .neq('status', 'revoked') // Don't show revoked admins
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Admins] Error fetching admins:', error);
        return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
    }

    // In dev mode without admin, treat as super_admin for UI
    const currentUserRole = admin?.role || (isDev ? 'super_admin' : null);

    return NextResponse.json({ admins, currentUserRole });
}
