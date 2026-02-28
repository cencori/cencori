import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createServerClient } from '@/lib/supabaseServer';
import { getCreditTransactions } from '@/lib/credits';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { orgSlug } = await params;
        const supabaseAdmin = createAdminClient();
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id, owner_id, credits_balance, credits_updated_at')
            .eq('slug', orgSlug)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        let hasOrgAccess = org.owner_id === user.id;
        if (!hasOrgAccess) {
            const { data: membership, error: membershipError } = await supabaseAdmin
                .from('organization_members')
                .select('user_id')
                .eq('organization_id', org.id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (membershipError) {
                console.error('[API] Error checking organization access:', membershipError);
                return NextResponse.json({ error: 'Failed to verify organization access' }, { status: 500 });
            }

            hasOrgAccess = !!membership;
        }

        if (!hasOrgAccess) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const transactions = await getCreditTransactions(org.id, 50);

        return NextResponse.json({
            balance: parseFloat(org.credits_balance) || 0,
            lastUpdated: org.credits_updated_at,
            transactions,
        });
    } catch (error) {
        console.error('[API] Error fetching credits:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
