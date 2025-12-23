import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
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

// Admin emails - add your email here
const ADMIN_EMAILS = [
    'admin@cencori.com',
    'founder@cencori.com',
    'omogbolahanng@gmail.com',
    // Add your email below
];

// For development, allow all authenticated users
const ALLOW_ALL_IN_DEV = true;

export async function GET(req: NextRequest) {
    const supabase = await createServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (or allow all in dev mode)
    const isDev = process.env.NODE_ENV === 'development';
    const isAllowed = ALLOW_ALL_IN_DEV && isDev ? true : ADMIN_EMAILS.includes(user.email || '');

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
