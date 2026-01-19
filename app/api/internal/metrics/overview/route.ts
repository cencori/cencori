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

const ALLOW_ALL_IN_DEV = true;

const FOUNDER_EMAILS = ['omogbolahanng@gmail.com'];

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
    const adminEmail = req.headers.get('X-Admin-Email');

    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    const isDev = process.env.NODE_ENV === 'development';

    if (!adminEmail && !user && !isDev) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let isAllowed = false;

    if (adminEmail) {
        isAllowed = await isAuthorizedAdmin(adminEmail);
    }

    if (!isAllowed && user?.email) {
        isAllowed = await isAuthorizedAdmin(user.email);
    }
    if (!isAllowed && ALLOW_ALL_IN_DEV && isDev) {
        isAllowed = true;
    }

    if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get('period') || '7d') as TimePeriod;

    try {
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
