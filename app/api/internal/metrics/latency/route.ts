import { getAuthUser } from "@/lib/auth/get-auth-user";
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getGatewayLatencyBenchmark } from '@/internal/analytics/lib/latency';
import { isFounderEmail } from '@/lib/internal-admin-auth';

async function isAuthorizedAdmin(email: string): Promise<boolean> {
    if (isFounderEmail(email)) {
        return true;
    }

    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('email', email.toLowerCase())
        .eq('status', 'active')
        .single();
    return !!admin;
}

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user } } = await getAuthUser(supabase);

    if (!user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!(await isAuthorizedAdmin(user.email))) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    try {
        return NextResponse.json(await getGatewayLatencyBenchmark());
    } catch (error) {
        console.error('[Gateway Latency] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch latency' }, { status: 500 });
    }
}
