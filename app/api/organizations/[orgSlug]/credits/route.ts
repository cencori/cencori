import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getCreditsBalance, getCreditTransactions } from '@/lib/credits';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    if (!req.headers.get('authorization')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = createAdminClient();
    const orgSlug = await params.then(p => p.orgSlug);
    if (!orgSlug) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
    try {
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, credits_balance, credits_updated_at')
            .eq('slug', orgSlug)
            .single();
        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
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