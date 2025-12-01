/**
 * Credits API Routes
 * GET - Get credits balance and transaction history
 */
/**
 * Credits API Routes
 * GET - Get credits balance and transaction history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getCreditsBalance, getCreditTransactions } from '@/lib/credits';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ orgSlug: string }> }
) {
    const supabase = createAdminClient();

    try {
        // Await params in Next.js 14+
        const { orgSlug } = await params;

        // Get organization
        const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('id, credits_balance, credits_updated_at')
            .eq('slug', orgSlug)
            .single();

        if (orgError || !org) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Get transaction history
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
