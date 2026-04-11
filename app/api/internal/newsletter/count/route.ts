import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { checkInternalAccess } from '@/lib/internal-access';

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await checkInternalAccess(user.id, user.email))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const [{ count: confirmed }, { count: pending }, { count: unsubscribed }] = await Promise.all([
        admin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
        admin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        admin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'unsubscribed'),
    ]);

    return NextResponse.json({
        confirmed: confirmed || 0,
        pending: pending || 0,
        unsubscribed: unsubscribed || 0,
    });
}
