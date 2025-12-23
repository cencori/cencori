// Platform Analytics Database Queries
import { createAdminClient } from '@/lib/supabaseAdmin';
import type { TimePeriod, AIGatewayMetrics, SecurityMetrics, OrganizationsMetrics, ProjectsMetrics, ApiKeysMetrics, UsersMetrics } from './types';

function getStartDate(period: TimePeriod): Date {
    const now = new Date();
    switch (period) {
        case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
        case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        case 'all': return new Date(0);
    }
}

export async function getAIGatewayMetrics(period: TimePeriod): Promise<AIGatewayMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: requests, error } = await supabase
        .from('ai_requests')
        .select('*')
        .gte('created_at', startDate.toISOString());

    if (error || !requests) {
        console.error('[Analytics] Error fetching AI requests:', error);
        return {
            totalRequests: 0,
            successfulRequests: 0,
            errorRequests: 0,
            filteredRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            avgLatency: 0,
            requestsByProvider: {},
            requestsByModel: {},
            streamingRequests: 0,
            nonStreamingRequests: 0,
            timeSeries: [],
        };
    }

    const totalRequests = requests.length;
    const successfulRequests = requests.filter(r => r.status === 'success').length;
    const errorRequests = requests.filter(r => r.status === 'error').length;
    const filteredRequests = requests.filter(r => r.status === 'filtered').length;
    const totalTokens = requests.reduce((sum, r) => sum + (r.total_tokens || 0), 0);
    const totalCost = requests.reduce((sum, r) => sum + (parseFloat(r.cost_usd) || 0), 0);
    const avgLatency = totalRequests > 0
        ? requests.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / totalRequests
        : 0;

    // Group by provider
    const requestsByProvider: Record<string, number> = {};
    requests.forEach(r => {
        const provider = r.provider || 'unknown';
        requestsByProvider[provider] = (requestsByProvider[provider] || 0) + 1;
    });

    // Group by model
    const requestsByModel: Record<string, number> = {};
    requests.forEach(r => {
        const model = r.model || 'unknown';
        requestsByModel[model] = (requestsByModel[model] || 0) + 1;
    });

    const streamingRequests = requests.filter(r => r.stream === true).length;
    const nonStreamingRequests = totalRequests - streamingRequests;

    return {
        totalRequests,
        successfulRequests,
        errorRequests,
        filteredRequests,
        totalTokens,
        totalCost,
        avgLatency: Math.round(avgLatency),
        requestsByProvider,
        requestsByModel,
        streamingRequests,
        nonStreamingRequests,
        timeSeries: [], // Will populate based on period granularity
    };
}

export async function getSecurityMetrics(period: TimePeriod): Promise<SecurityMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: incidents, error } = await supabase
        .from('security_incidents')
        .select('*')
        .gte('created_at', startDate.toISOString());

    if (error || !incidents) {
        return {
            totalIncidents: 0,
            incidentsByType: {},
            incidentsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            timeSeries: [],
        };
    }

    const totalIncidents = incidents.length;

    const incidentsByType: Record<string, number> = {};
    incidents.forEach(i => {
        const type = i.incident_type || 'unknown';
        incidentsByType[type] = (incidentsByType[type] || 0) + 1;
    });

    const incidentsBySeverity = {
        low: incidents.filter(i => i.severity === 'low').length,
        medium: incidents.filter(i => i.severity === 'medium').length,
        high: incidents.filter(i => i.severity === 'high').length,
        critical: incidents.filter(i => i.severity === 'critical').length,
    };

    return {
        totalIncidents,
        incidentsByType,
        incidentsBySeverity,
        timeSeries: [],
    };
}

export async function getOrganizationsMetrics(period: TimePeriod): Promise<OrganizationsMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: orgs } = await supabase.from('organizations').select('id, subscription_tier, created_at');
    const { data: members } = await supabase.from('organization_members').select('id');
    const { data: activeOrgs } = await supabase
        .from('ai_requests')
        .select('project_id, projects!inner(organization_id)')
        .gte('created_at', startDate.toISOString());

    const total = orgs?.length || 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeOrgIds = new Set(activeOrgs?.map((r: any) => r.projects?.organization_id).filter(Boolean));
    const active = activeOrgIds.size;

    const byTier: Record<string, number> = {};
    orgs?.forEach(o => {
        const tier = o.subscription_tier || 'free';
        byTier[tier] = (byTier[tier] || 0) + 1;
    });

    const newThisPeriod = orgs?.filter(o => new Date(o.created_at) >= startDate).length || 0;

    return {
        total,
        active,
        byTier,
        totalMembers: members?.length || 0,
        newThisPeriod,
    };
}

export async function getProjectsMetrics(period: TimePeriod): Promise<ProjectsMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: projects } = await supabase.from('projects').select('id, status, visibility, created_at');
    const { data: activeProjects } = await supabase
        .from('ai_requests')
        .select('project_id')
        .gte('created_at', startDate.toISOString());

    const total = projects?.length || 0;
    const activeProjectIds = new Set(activeProjects?.map(r => r.project_id));
    const active = activeProjectIds.size;

    const byStatus = {
        active: projects?.filter(p => p.status === 'active').length || 0,
        inactive: projects?.filter(p => p.status === 'inactive').length || 0,
    };

    const byVisibility = {
        public: projects?.filter(p => p.visibility === 'public').length || 0,
        private: projects?.filter(p => p.visibility === 'private').length || 0,
    };

    const newThisPeriod = projects?.filter(p => new Date(p.created_at) >= startDate).length || 0;

    return { total, active, byStatus, byVisibility, newThisPeriod };
}

export async function getApiKeysMetrics(period: TimePeriod): Promise<ApiKeysMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: keys } = await supabase.from('api_keys').select('id, environment, created_at, last_used_at');

    const total = keys?.length || 0;
    const active = keys?.filter(k => k.last_used_at && new Date(k.last_used_at) >= startDate).length || 0;

    const byEnvironment = {
        production: keys?.filter(k => k.environment === 'production').length || 0,
        development: keys?.filter(k => k.environment === 'development' || k.environment === 'test').length || 0,
    };

    const newThisPeriod = keys?.filter(k => new Date(k.created_at) >= startDate).length || 0;

    return { total, active, byEnvironment, newThisPeriod };
}

export async function getUsersMetrics(period: TimePeriod): Promise<UsersMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get users from auth.users via admin API
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error || !users) {
        return { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0 };
    }

    const total = users.length;
    // Active users = signed in within the selected period
    const active = users.filter(u => u.last_sign_in_at && new Date(u.last_sign_in_at) >= startDate).length;
    const newToday = users.filter(u => new Date(u.created_at) >= today).length;
    const newThisWeek = users.filter(u => new Date(u.created_at) >= thisWeek).length;
    const newThisMonth = users.filter(u => new Date(u.created_at) >= thisMonth).length;

    return { total, active, newToday, newThisWeek, newThisMonth };
}

// Tier pricing (monthly prices in USD) - from components/landing/Pricing.tsx
const TIER_PRICES: Record<string, number> = {
    free: 0,
    pro: 49,
    team: 149,
    enterprise: 0, // Custom pricing, tracked separately
};

export interface BillingMetrics {
    activeSubscriptions: number;
    mrr: number;
    byTier: Record<string, number>;
    churnedThisPeriod: number;
}

export async function getBillingMetrics(period: TimePeriod): Promise<BillingMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: orgs } = await supabase
        .from('organizations')
        .select('id, subscription_tier, subscription_status, created_at, updated_at');

    if (!orgs) {
        return { activeSubscriptions: 0, mrr: 0, byTier: {}, churnedThisPeriod: 0 };
    }

    // Count active paid subscriptions
    const paidOrgs = orgs.filter(o =>
        o.subscription_tier &&
        o.subscription_tier !== 'free' &&
        o.subscription_status === 'active'
    );

    const activeSubscriptions = paidOrgs.length;

    // Calculate MRR
    let mrr = 0;
    const byTier: Record<string, number> = {};

    paidOrgs.forEach(org => {
        const tier = org.subscription_tier || 'free';
        const price = TIER_PRICES[tier] || 0;
        mrr += price;
        byTier[tier] = (byTier[tier] || 0) + 1;
    });

    // Count churned (canceled) in period
    const churnedThisPeriod = orgs.filter(o =>
        o.subscription_status === 'canceled' &&
        new Date(o.updated_at) >= startDate
    ).length;

    return { activeSubscriptions, mrr, byTier, churnedThisPeriod };
}
