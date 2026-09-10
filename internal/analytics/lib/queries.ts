// Platform Analytics Database Queries
import { createAdminClient } from '@/lib/supabaseAdmin';
import { fetchAllRows } from '@/lib/supabase-paginate';
import type { TimePeriod, AIGatewayMetrics, SecurityMetrics, OrganizationsMetrics, ProjectsMetrics, ApiKeysMetrics, UsersMetrics, ScanMetrics, PlatformEventsMetrics, CaptureMetrics } from './types';
import type { User } from '@supabase/supabase-js';

/**
 * Exact row count for a table+window, bypassing the 1000-row read ceiling.
 * Returns null when the count fails, so a timed-out query is never rendered as
 * a confident "0" — see the analytics_* RPCs in
 * supabase/migrations/20260910_140000_analytics_aggregates.sql.
 */
async function exactCount(
    table: string,
    tsColumn: string,
    startISO: string,
): Promise<number | null> {
    const supabase = createAdminClient();
    const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .gte(tsColumn, startISO);
    if (error) {
        console.error(`[Analytics] Count failed for ${table}:`, error.message);
        return null;
    }
    return count ?? 0;
}

/**
 * Call a DB-side analytics rollup. These aggregate in SQL so we never ship rows
 * to Node: an `ai_requests` row carries request/response payloads (~5.5 KB), so
 * a 30d window used to be a ~70 MB paginated walk that timed out in production
 * and silently rendered as zeros.
 *
 * Returns null if the RPC is missing (migration not applied yet) or errors, so
 * callers can fall back and/or report the section as unavailable.
 */
async function callAnalyticsRpc<T>(fn: string, startISO: string): Promise<T | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(fn, { p_start: startISO });
    if (error) {
        console.error(`[Analytics] RPC ${fn} failed:`, error.message);
        return null;
    }
    return (data ?? null) as T | null;
}

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
        default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
}

const EMPTY_GATEWAY_METRICS: AIGatewayMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    errorRequests: 0,
    filteredRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    avgLatency: 0,
    requestsByProvider: {},
    requestsByModel: {},
    streamingRequests: null,
    nonStreamingRequests: null,
    timeSeries: [],
};

type GatewayRollup = {
    total_requests: number;
    successful_requests: number;
    error_requests: number;
    filtered_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_latency: number;
    requests_by_provider: Record<string, number>;
    requests_by_model: Record<string, number>;
};

export async function getAIGatewayMetrics(period: TimePeriod): Promise<AIGatewayMetrics> {
    const startISO = getStartDate(period).toISOString();

    // The streaming split is a separate call: the flag lives on request_payload,
    // and reading that column inside the rollup detoasts every row in the window
    // (that is what timed the first version out). Its own RPC is served by a
    // partial index, and a failure there costs the split, not the whole section.
    const [rollup, streaming] = await Promise.all([
        callAnalyticsRpc<GatewayRollup>('analytics_gateway_metrics', startISO),
        callAnalyticsRpc<number>('analytics_gateway_streaming', startISO),
    ]);

    if (rollup) {
        const totalRequests = Number(rollup.total_requests) || 0;
        const streamingRequests = streaming === null ? null : Number(streaming) || 0;
        return {
            totalRequests,
            successfulRequests: Number(rollup.successful_requests) || 0,
            errorRequests: Number(rollup.error_requests) || 0,
            filteredRequests: Number(rollup.filtered_requests) || 0,
            totalTokens: Number(rollup.total_tokens) || 0,
            totalCost: Number(rollup.total_cost) || 0,
            avgLatency: Math.round(Number(rollup.avg_latency) || 0),
            requestsByProvider: rollup.requests_by_provider || {},
            requestsByModel: rollup.requests_by_model || {},
            streamingRequests,
            nonStreamingRequests: streamingRequests === null ? null : totalRequests - streamingRequests,
            timeSeries: [],
        };
    }

    // Fallback for a database that hasn't had the aggregates migration applied.
    // Explicit (narrow) column list: the payload columns are what made the old
    // select('*') walk unaffordable.
    return getAIGatewayMetricsByScan(startISO);
}

/** Pre-RPC fallback. Streaming split stays null here — it lives on request_payload. */
async function getAIGatewayMetricsByScan(startISO: string): Promise<AIGatewayMetrics> {
    const supabase = createAdminClient();

    type GatewayRow = {
        status: string | null; total_tokens: number | null; cost_usd: number | string | null;
        latency_ms: number | null; provider: string | null; model: string | null;
    };
    let requests: GatewayRow[];
    try {
        // Paginate past the 1000-row ceiling so platform totals are real.
        requests = await fetchAllRows<GatewayRow>((from, to) =>
            supabase
                .from('ai_requests')
                .select('status, total_tokens, cost_usd, latency_ms, provider, model')
                .gte('created_at', startISO)
                .order('created_at', { ascending: true })
                .range(from, to)
        );
    } catch (error) {
        console.error('[Analytics] Error fetching AI requests:', error);
        return { ...EMPTY_GATEWAY_METRICS, unavailable: true };
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
    const totalCost = requests.reduce((sum, r) => sum + (parseFloat(String(r.cost_usd)) || 0), 0);
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
        streamingRequests: null,
        nonStreamingRequests: null,
        timeSeries: [],
    };
}

type SecurityRollup = {
    total_incidents: number;
    incidents_by_type: Record<string, number>;
    incidents_by_severity: { low: number; medium: number; high: number; critical: number };
};

export async function getSecurityMetrics(period: TimePeriod): Promise<SecurityMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const rollup = await callAnalyticsRpc<SecurityRollup>(
        'analytics_security_metrics',
        startDate.toISOString(),
    );
    if (rollup) {
        return {
            totalIncidents: Number(rollup.total_incidents) || 0,
            incidentsByType: rollup.incidents_by_type || {},
            incidentsBySeverity: {
                low: Number(rollup.incidents_by_severity?.low) || 0,
                medium: Number(rollup.incidents_by_severity?.medium) || 0,
                high: Number(rollup.incidents_by_severity?.high) || 0,
                critical: Number(rollup.incidents_by_severity?.critical) || 0,
            },
            timeSeries: [],
        };
    }

    // Fallback: narrow column list — `input_text` alone runs to ~14 KB/row —
    // and paginate, so totals aren't capped at the 1000-row read ceiling.
    let incidents: { incident_type: string | null; severity: string | null }[];
    try {
        incidents = await fetchAllRows<{ incident_type: string | null; severity: string | null }>(
            (from, to) =>
                supabase
                    .from('security_incidents')
                    .select('incident_type, severity')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: true })
                    .range(from, to)
        );
    } catch (error) {
        console.error('[Analytics] Error fetching security incidents:', error);
        return {
            totalIncidents: 0,
            incidentsByType: {},
            incidentsBySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            timeSeries: [],
            unavailable: true,
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

interface ActiveEntities {
    activeOrganizations: number;
    activeProjects: number;
    activeApiKeys: number;
}

type ActiveEntitiesRollup = {
    active_organizations: number;
    active_projects: number;
    active_api_keys: number;
};

// The org/project/API-key sections each need the same distinct counts over the
// same window; memoize briefly so one dashboard load makes one DB call.
const ACTIVE_ENTITIES_TTL_MS = 10_000;
const activeEntitiesCache = new Map<TimePeriod, { at: number; value: Promise<ActiveEntities> }>();

async function getActiveEntities(period: TimePeriod): Promise<ActiveEntities> {
    const cached = activeEntitiesCache.get(period);
    if (cached && Date.now() - cached.at < ACTIVE_ENTITIES_TTL_MS) {
        return cached.value;
    }

    const value = loadActiveEntities(period);
    activeEntitiesCache.set(period, { at: Date.now(), value });
    return value;
}

async function loadActiveEntities(period: TimePeriod): Promise<ActiveEntities> {
    const startISO = getStartDate(period).toISOString();

    const rollup = await callAnalyticsRpc<ActiveEntitiesRollup>('analytics_active_entities', startISO);
    if (rollup) {
        return {
            activeOrganizations: Number(rollup.active_organizations) || 0,
            activeProjects: Number(rollup.active_projects) || 0,
            activeApiKeys: Number(rollup.active_api_keys) || 0,
        };
    }

    // Fallback: one lean scan (ids only) instead of three payload-heavy ones.
    // PostgREST types an embedded parent as an array even though it resolves to
    // at most one row, so accept either shape.
    type EmbeddedProject = { organization_id: string | null };
    type UsageRow = {
        project_id: string | null;
        api_key_id: string | null;
        projects: EmbeddedProject | EmbeddedProject[] | null;
    };
    const organizationId = (projects: UsageRow['projects']): string | null =>
        (Array.isArray(projects) ? projects[0]?.organization_id : projects?.organization_id) ?? null;
    const supabase = createAdminClient();
    const usage = await fetchAllRows<UsageRow>((from, to) =>
        supabase
            .from('ai_requests')
            .select('project_id, api_key_id, projects(organization_id)')
            .gte('created_at', startISO)
            .order('created_at', { ascending: true })
            .range(from, to)
    ).catch((error) => {
        console.error('[Analytics] Error fetching gateway usage for active entities:', error);
        return [] as UsageRow[];
    });

    const orgIds = new Set<string>();
    const projectIds = new Set<string>();
    const apiKeyIds = new Set<string>();
    usage.forEach((row) => {
        const orgId = organizationId(row.projects);
        if (orgId) orgIds.add(orgId);
        if (row.project_id) projectIds.add(row.project_id);
        if (row.api_key_id) apiKeyIds.add(row.api_key_id);
    });

    return {
        activeOrganizations: orgIds.size,
        activeProjects: projectIds.size,
        activeApiKeys: apiKeyIds.size,
    };
}

export async function getOrganizationsMetrics(period: TimePeriod): Promise<OrganizationsMetrics> {
    const supabase = createAdminClient();
    const startDate = getStartDate(period);

    const { data: orgs } = await supabase.from('organizations').select('id, owner_id, subscription_tier, created_at');
    const { data: members } = await supabase.from('organization_members').select('user_id');

    const total = orgs?.length || 0;
    const active = (await getActiveEntities(period)).activeOrganizations;

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

    const total = projects?.length || 0;
    const active = (await getActiveEntities(period)).activeProjects;

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
    const active = (await getActiveEntities(period)).activeApiKeys;

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
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
        return { total: 0, active: 0, newToday: 0, newThisWeek: 0, newThisMonth: 0, newThisPeriod: 0 };
    }

    // Track only real signed-up users (exclude service/system rows without email).
    const realUsers = users.filter((user) => Boolean(user.email));

    const total = realUsers.length;
    // Active users scoped to the selected time period (fix: was hardcoded to 30 days)
    const active = realUsers.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) >= startDate).length;
    const newToday = realUsers.filter((u) => new Date(u.created_at) >= today).length;
    const newThisWeek = realUsers.filter((u) => new Date(u.created_at) >= thisWeek).length;
    const newThisMonth = realUsers.filter((u) => new Date(u.created_at) >= thisMonth).length;
    const newThisPeriod = realUsers.filter((u) => new Date(u.created_at) >= startDate).length;

    return { total, active, newToday, newThisWeek, newThisMonth, newThisPeriod };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let telemetry: any[];
    try {
        // Paginate past the 1000-row ceiling so scan totals are real.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        telemetry = await fetchAllRows<any>((from, to) =>
            supabase
                .from('scan_telemetry')
                .select('*')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })
                .range(from, to)
        );
    } catch (error) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let eventsAsc: any[];
    try {
        // Paginate past the 1000-row ceiling; order ascending so pages are stable.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        eventsAsc = await fetchAllRows<any>((from, to) =>
            supabase
                .from('platform_events')
                .select('id, event_type, product, user_id, organization_id, project_id, metadata, created_at')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: true })
                .range(from, to)
        );
    } catch (error) {
        console.error('[Analytics] Error fetching platform events:', error);
        return {
            totalEvents: 0,
            eventsByProduct: {},
            eventsByType: {},
            recentEvents: [],
            eventsToday: 0,
        };
    }

    // Preserve the original newest-first semantics for the recent feed.
    const events = eventsAsc;
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

    const recentEvents = events.slice(-50).reverse();

    return {
        totalEvents,
        eventsByProduct,
        eventsByType,
        recentEvents,
        eventsToday,
    };
}

type CaptureRollup = {
    gateway_requests: number;
    governance_decisions: number;
    memories: number;
    agent_sessions: number;
};

/**
 * Workload capture per product — the numerator behind "% of global AI on
 * Cencori". One DB-side call; falls back to four exact COUNTs (which never hit
 * the 1000-row ceiling) if the aggregates migration isn't applied. A field is
 * null when its count failed, so an unreadable table renders as "—" rather than
 * as a confident zero.
 */
export async function getCaptureMetrics(period: TimePeriod): Promise<CaptureMetrics> {
    const startISO = getStartDate(period).toISOString();

    const rollup = await callAnalyticsRpc<CaptureRollup>('analytics_capture_metrics', startISO);
    if (rollup) {
        return {
            gatewayRequests: Number(rollup.gateway_requests) || 0,
            governanceDecisions: Number(rollup.governance_decisions) || 0,
            memories: Number(rollup.memories) || 0,
            agentSessions: Number(rollup.agent_sessions) || 0,
        };
    }

    const [gatewayRequests, governanceDecisions, memories, agentSessions] = await Promise.all([
        exactCount('ai_requests', 'created_at', startISO),            // model traffic
        exactCount('governance_audit_ledger', 'ts', startISO),        // governed enterprise usage
        exactCount('gateway_memories', 'created_at', startISO),       // state
        exactCount('sessions', 'created_at', startISO),               // agent workloads
    ]);

    return { gatewayRequests, governanceDecisions, memories, agentSessions };
}
