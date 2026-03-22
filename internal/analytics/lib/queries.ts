// Platform Analytics Database Queries
import { createAdminClient } from '@/lib/supabaseAdmin';
import type { TimePeriod, AIGatewayMetrics, SecurityMetrics, OrganizationsMetrics, ProjectsMetrics, ApiKeysMetrics, UsersMetrics, ScanMetrics, PlatformEventsMetrics } from './types';
import type { User } from '@supabase/supabase-js';

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
    const successfulRequests = requests.filter(
        (r) => r.status === 'success' || r.status === 'success_fallback'
    ).length;
    const errorRequests = requests.filter(r => r.status === 'error').length;
    const filteredRequests = requests.filter(
        (r) => r.status === 'filtered' || r.status === 'blocked'
    ).length;
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
        timeSeries: [],
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

    const { data: orgs } = await supabase.from('organizations').select('id, owner_id, subscription_tier, created_at');
    const { data: members } = await supabase.from('organization_members').select('user_id');
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

    const memberIds = new Set<string>();
    orgs?.forEach((org) => {
        if (org.owner_id) {
            memberIds.add(org.owner_id);
        }
    });
    members?.forEach((member) => {
        if (member.user_id) {
            memberIds.add(member.user_id);
        }
    });

    const newThisPeriod = orgs?.filter(o => new Date(o.created_at) >= startDate).length || 0;

    return {
        total,
        active,
        byTier,
        totalMembers: memberIds.size,
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
    const { data: keyUsage } = await supabase
        .from('ai_requests')
        .select('api_key_id')
        .gte('created_at', startDate.toISOString());

    const total = keys?.length || 0;
    const activeKeyIds = new Set(
        (keyUsage || [])
            .map((request) => request.api_key_id)
            .filter(Boolean)
    );
    const active = activeKeyIds.size;

    const byEnvironment = {
        production: keys?.filter(k => k.environment === 'production').length || 0,
        development: keys?.filter(k => k.environment === 'development' || k.environment === 'test').length || 0,
    };

    const newThisPeriod = keys?.filter(k => new Date(k.created_at) >= startDate).length || 0;

    return { total, active, byEnvironment, newThisPeriod };
}

export async function getUsersMetrics(_period: TimePeriod): Promise<UsersMetrics> {
    const supabase = createAdminClient();
    void _period;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const listAllUsers = async (): Promise<User[] | null> => {
        const allUsers: User[] = [];
        let page = 1;
        const perPage = 200;

        while (true) {
            const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
            if (error) {
                console.error('[Analytics] Error fetching users page:', error);
                return null;
            }

            const users = data?.users ?? [];
            if (users.length === 0) break;

            allUsers.push(...users);

            if (!data?.nextPage) break;
            page = data.nextPage;
        }

        return allUsers;
    };

    // Get users from auth.users via admin API (all pages)
    const users = await listAllUsers();

    if (!users) {
        return { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0 };
    }

    // Track only real signed-up users (exclude service/system rows without email).
    const realUsers = users.filter((user) => Boolean(user.email));

    const total = realUsers.length;
    // Active users = signed in within the last 30 days (fixed window, independent from selected chart period).
    const active = realUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= activeWindowStart).length;
    const newToday = realUsers.filter((u) => new Date(u.created_at) >= today).length;
    const newThisWeek = realUsers.filter((u) => new Date(u.created_at) >= thisWeek).length;
    const newThisMonth = realUsers.filter((u) => new Date(u.created_at) >= thisMonth).length;

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

export async function getScanMetrics(period: TimePeriod): Promise<ScanMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: telemetry, error } = await supabase
        .from('scan_telemetry')
        .select('*')
        .gte('created_at', startDate.toISOString());

    if (error || !telemetry) {
        console.error('[Analytics] Error fetching scan telemetry:', error);
        return {
            totalScans: 0,
            authenticatedScans: 0,
            anonymousScans: 0,
            conversionRate: 0,
            totalFilesScanned: 0,
            totalIssuesFound: 0,
            avgIssuesPerScan: 0,
            scoreBreakdown: { A: 0, B: 0, C: 0, D: 0, F: 0 },
            issueBreakdown: { secrets: 0, pii: 0, routes: 0, config: 0, vulnerabilities: 0 },
            platformBreakdown: { darwin: 0, linux: 0, win32: 0, other: 0 },
        };
    }

    const totalScans = telemetry.length;
    const authenticatedScans = telemetry.filter(t => t.has_api_key).length;
    const anonymousScans = totalScans - authenticatedScans;
    const conversionRate = totalScans > 0 ? (authenticatedScans / totalScans) * 100 : 0;

    const totalFilesScanned = telemetry.reduce((sum, t) => sum + (t.files_scanned || 0), 0);
    const totalIssuesFound = telemetry.reduce((sum, t) => sum + (t.issues_found || 0), 0);
    const avgIssuesPerScan = totalScans > 0 ? totalIssuesFound / totalScans : 0;

    // Score breakdown
    const scoreBreakdown = {
        A: telemetry.filter(t => t.score === 'A').length,
        B: telemetry.filter(t => t.score === 'B').length,
        C: telemetry.filter(t => t.score === 'C').length,
        D: telemetry.filter(t => t.score === 'D').length,
        F: telemetry.filter(t => t.score === 'F').length,
    };

    // Issue breakdown (aggregated)
    const issueBreakdown = {
        secrets: telemetry.reduce((sum, t) => sum + (t.secrets_count || 0), 0),
        pii: telemetry.reduce((sum, t) => sum + (t.pii_count || 0), 0),
        routes: telemetry.reduce((sum, t) => sum + (t.routes_count || 0), 0),
        config: telemetry.reduce((sum, t) => sum + (t.config_count || 0), 0),
        vulnerabilities: telemetry.reduce((sum, t) => sum + (t.vulnerabilities_count || 0), 0),
    };

    // Platform breakdown
    const platformBreakdown = {
        darwin: telemetry.filter(t => t.platform === 'darwin').length,
        linux: telemetry.filter(t => t.platform === 'linux').length,
        win32: telemetry.filter(t => t.platform === 'win32').length,
        other: telemetry.filter(t => !['darwin', 'linux', 'win32'].includes(t.platform)).length,
    };

    return {
        totalScans,
        authenticatedScans,
        anonymousScans,
        conversionRate: Math.round(conversionRate * 10) / 10,
        totalFilesScanned,
        totalIssuesFound,
        avgIssuesPerScan: Math.round(avgIssuesPerScan * 10) / 10,
        scoreBreakdown,
        issueBreakdown,
        platformBreakdown,
    };
}

export async function getPlatformEventsMetrics(period: TimePeriod): Promise<PlatformEventsMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: events, error } = await supabase
        .from('platform_events')
        .select('id, event_type, product, user_id, organization_id, project_id, metadata, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

    if (error || !events) {
        console.error('[Analytics] Error fetching platform events:', error);
        return {
            totalEvents: 0,
            eventsByProduct: {},
            eventsByType: {},
            recentEvents: [],
            eventsToday: 0,
        };
    }

    const totalEvents = events.length;

    const eventsByProduct: Record<string, number> = {};
    events.forEach(e => {
        eventsByProduct[e.product] = (eventsByProduct[e.product] || 0) + 1;
    });

    const eventsByType: Record<string, number> = {};
    events.forEach(e => {
        eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventsToday = events.filter(e => new Date(e.created_at) >= today).length;

    const recentEvents = events.slice(0, 50);

    return {
        totalEvents,
        eventsByProduct,
        eventsByType,
        recentEvents,
        eventsToday,
    };
}
