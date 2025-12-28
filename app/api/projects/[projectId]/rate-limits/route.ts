import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';

// Rate limit tiers (requests per month)
const TIER_LIMITS = {
    free: { monthly: 1000, perMinute: 60, tokensPerDay: 100000, concurrent: 10 },
    pro: { monthly: 50000, perMinute: 500, tokensPerDay: 1000000, concurrent: 50 },
    team: { monthly: 250000, perMinute: 1000, tokensPerDay: 5000000, concurrent: 100 },
    enterprise: { monthly: 999999999, perMinute: 10000, tokensPerDay: 999999999, concurrent: 1000 },
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;
    const supabase = await createServerClient();
    const supabaseAdmin = createAdminClient();

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Get project with organization
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select('id, organization_id, organizations!inner(id, subscription_tier, monthly_requests_used, monthly_request_limit)')
            .eq('id', projectId)
            .single();

        if (projectError || !project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orgData = project.organizations as any;
        const org = {
            id: orgData?.id || '',
            subscription_tier: orgData?.subscription_tier || 'free',
            monthly_requests_used: orgData?.monthly_requests_used || 0,
            monthly_request_limit: orgData?.monthly_request_limit || 1000,
        };

        const tier = org.subscription_tier as keyof typeof TIER_LIMITS;
        const tierLimits = TIER_LIMITS[tier] || TIER_LIMITS.free;

        // Check for custom project settings that override tier limits
        const { data: projectSettings } = await supabaseAdmin
            .from('project_settings')
            .select('requests_per_minute, tokens_per_day, concurrent_requests')
            .eq('project_id', projectId)
            .single();

        // Use project settings if available, otherwise fall back to tier limits
        const limits = {
            perMinute: projectSettings?.requests_per_minute ?? tierLimits.perMinute,
            tokensPerDay: projectSettings?.tokens_per_day ?? tierLimits.tokensPerDay,
            concurrent: projectSettings?.concurrent_requests ?? tierLimits.concurrent,
            monthly: tierLimits.monthly,
        };

        // Get requests in the last minute (for requests/min)
        const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
        const { count: requestsLastMinute } = await supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', oneMinuteAgo);

        // Get tokens used today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const { data: tokenData } = await supabaseAdmin
            .from('ai_requests')
            .select('total_tokens')
            .eq('project_id', projectId)
            .gte('created_at', startOfDay.toISOString());

        const tokensToday = tokenData?.reduce((sum, r) => sum + (r.total_tokens || 0), 0) || 0;

        // Get concurrent requests (requests in the last 30 seconds that are still "processing")
        // For now, we estimate based on requests in the last 5 seconds
        const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
        const { count: concurrentEstimate } = await supabaseAdmin
            .from('ai_requests')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .gte('created_at', fiveSecondsAgo);

        return NextResponse.json({
            tier,
            customLimits: !!projectSettings, // Indicates if using custom settings
            usage: {
                requestsPerMinute: {
                    used: requestsLastMinute || 0,
                    limit: limits.perMinute,
                    percentage: Math.min(100, Math.round(((requestsLastMinute || 0) / limits.perMinute) * 100)),
                },
                tokensPerDay: {
                    used: tokensToday,
                    limit: limits.tokensPerDay,
                    percentage: Math.min(100, Math.round((tokensToday / limits.tokensPerDay) * 100)),
                },
                concurrentRequests: {
                    used: concurrentEstimate || 0,
                    limit: limits.concurrent,
                    percentage: Math.min(100, Math.round(((concurrentEstimate || 0) / limits.concurrent) * 100)),
                },
                monthlyRequests: {
                    used: org.monthly_requests_used || 0,
                    limit: org.monthly_request_limit || limits.monthly,
                    percentage: Math.min(100, Math.round(((org.monthly_requests_used || 0) / (org.monthly_request_limit || limits.monthly)) * 100)),
                },
            },
        });
    } catch (error) {
        console.error('Error fetching rate limits:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

