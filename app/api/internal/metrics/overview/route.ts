import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import {
    getAIGatewayMetrics,
    getSecurityMetrics,
    getOrganizationsMetrics,
    getProjectsMetrics,
    getApiKeysMetrics,
    getUsersMetrics,
    getBillingMetrics
} from '@/internal/analytics/lib/queries';
import type { TimePeriod } from '@/internal/analytics/lib/types';

// For development, allow all authenticated users temporarily
const ALLOW_ALL_IN_DEV = true;

// Founder emails - always have access as fallback
const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];

// Helper to check if user is an active admin
async function isActiveAdmin(userId: string): Promise<boolean> {
    const supabase = createAdminClient();
    const { data: admin } = await supabase
        .from('cencori_admins')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    return !!admin;
}

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin, founder, or in dev mode
    const isDev = process.env.NODE_ENV === 'development';
    const isFounder = FOUNDER_EMAILS.includes(user.email || '');
    const isAdmin = await isActiveAdmin(user.id);
    const isAllowed = (ALLOW_ALL_IN_DEV && isDev) || isFounder || isAdmin;

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || '7d') as TimePeriod;

    try {
        // Fetch all metrics in parallel
        const [aiGateway, security, organizations, projects, apiKeys, users, billing] = await Promise.all([
            getAIGatewayMetrics(period),
            getSecurityMetrics(period),
            getOrganizationsMetrics(period),
            getProjectsMetrics(period),
            getApiKeysMetrics(period),
            getUsersMetrics(period),
            getBillingMetrics(period),
        ]);

        return NextResponse.json({
            aiGateway,
            security,
            organizations,
            projects,
            apiKeys,
            users,
            billing,
            period,
            generatedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('[Platform Analytics] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
    }
}
