// Platform Analytics Types

export type TimePeriod = '1h' | '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface TimeSeriesDataPoint {
    date: string;
    value: number;
}

export interface AIGatewayMetrics {
    totalRequests: number;
    successfulRequests: number;
    errorRequests: number;
    filteredRequests: number;
    totalTokens: number;
    totalCost: number;
    avgLatency: number;
    requestsByProvider: Record<string, number>;
    requestsByModel: Record<string, number>;
    streamingRequests: number;
    nonStreamingRequests: number;
    timeSeries: TimeSeriesDataPoint[];
}

export interface SecurityMetrics {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    incidentsBySeverity: {
        low: number;
        medium: number;
        high: number;
        critical: number;
    };
    timeSeries: TimeSeriesDataPoint[];
}

export interface OrganizationsMetrics {
    total: number;
    active: number;
    byTier: Record<string, number>;
    totalMembers: number;
    newThisPeriod: number;
}

export interface ProjectsMetrics {
    total: number;
    active: number;
    byStatus: { active: number; inactive: number };
    byVisibility: { public: number; private: number };
    newThisPeriod: number;
}

export interface ApiKeysMetrics {
    total: number;
    active: number;
    byEnvironment: { production: number; development: number };
    newThisPeriod: number;
}

export interface UsersMetrics {
    total: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
}

export interface BillingMetrics {
    activeSubscriptions: number;
    mrr: number;
    byTier: Record<string, number>;
    churnedThisPeriod: number;
}

export interface PlatformOverviewMetrics {
    aiGateway: AIGatewayMetrics;
    security: SecurityMetrics;
    organizations: OrganizationsMetrics;
    projects: ProjectsMetrics;
    apiKeys: ApiKeysMetrics;
    users: UsersMetrics;
    billing: BillingMetrics;
    period: TimePeriod;
    generatedAt: string;
}
