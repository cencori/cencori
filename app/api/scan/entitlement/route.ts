import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { getScanEntitlementForUser } from '@/lib/scan/entitlements';

export async function GET() {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const entitlement = await getScanEntitlementForUser(user.id);
        return NextResponse.json({ entitlement });
    } catch (error) {
        console.error('[Scan Entitlement] Failed to resolve entitlement:', error);
        return NextResponse.json({ error: 'Failed to resolve scan entitlement' }, { status: 500 });
    }
}
