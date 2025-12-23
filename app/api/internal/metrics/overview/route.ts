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

// Helper to check if email is an authorized admin
async function isAuthorizedAdmin(email: string): Promise<boolean> {
    if (FOUNDER_EMAILS.includes(email.toLowerCase())) {
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

export async function GET(req: NextRequest) {
    // Check for admin email header (from frontend gate)
    const adminEmail = req.headers.get('X-Admin-Email');

    // Must have some form of authentication
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // In production, require either admin email header or logged-in user
    const isDev = process.env.NODE_ENV === 'development';

    if (!adminEmail && !user && !isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check authorization
    let isAllowed = false;

    // Check admin email from header first
    if (adminEmail) {
        isAllowed = await isAuthorizedAdmin(adminEmail);
    }

    // Fall back to logged-in user email
    if (!isAllowed && user?.email) {
        isAllowed = await isAuthorizedAdmin(user.email);
    }

    // Dev mode bypass
    if (!isAllowed && ALLOW_ALL_IN_DEV && isDev) {
        isAllowed = true;
    }

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
