'use client';

import { useState, use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { MetricCardWithChart } from '@/components/audit/MetricCardWithChart';
import { MetricCardWithLineChart } from '@/components/audit/MetricCardWithLineChart';
import { RequestsAreaChart } from '@/components/audit/RequestsAreaChart';
import { ModelUsageChart } from '@/components/analytics/ModelUsageChart';
import { CostByProviderChart } from '@/components/analytics/CostByProviderChart';
import { LatencyHistogram } from '@/components/analytics/LatencyHistogram';
import { TokenUsageChart } from '@/components/analytics/TokenUsageChart';
import { FailoverMetrics } from '@/components/analytics/FailoverMetrics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartBarIcon, ShieldExclamationIcon, CurrencyDollarIcon, ClockIcon, BoltIcon } from '@heroicons/react/24/outline';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/hooks/useQueries';
import { ExportDialog } from '@/components/dashboard/ExportDialog';

interface TrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    blocked_output: number;
    error: number;
    cost: number;
    tokens: number;
    avg_latency: number;
}

interface OverviewData {
    overview: {
        total_requests: number;
        success_rate: number;
        total_cost: number;
        avg_latency: number;
        total_tokens: number;
        total_incidents: number;
        critical_incidents: number;
    };
    breakdown: {
        model_usage: Record<string, number>;
        incidents_by_severity: {
            critical: number;
            high: number;
            medium: number;
            low: number;
        };
        cost_by_provider: Record<string, number>;
        requests_by_provider: Record<string, number>;
        latency_percentiles: {
            p50: number;
            p75: number;
            p90: number;
            p95: number;
            p99: number;
        };
        requests_by_country: Record<string, number>;
    };
}

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

// Hook to get projectId from slugs (with caching)
function useProjectId(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ["projectId", orgSlug, projectSlug],
        queryFn: async () => {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single();

            if (!orgData) throw new Error("Organization not found");

            const { data: projectData } = await supabase
                .from('projects')
                .select('id')
                .eq('slug', projectSlug)
                .eq('organization_id', orgData.id)
                .single();

            if (!projectData) throw new Error("Project not found");
            return projectData.id;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export default function AnalyticsPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const { environment } = useEnvironment();
    const [timeRange, setTimeRange] = useState('7d');

    // Get projectId with caching
    const { data: projectId, isLoading: projectLoading } = useProjectId(orgSlug, projectSlug);

    // Fetch analytics overview with caching
    const { data: overview } = useQuery<OverviewData>({
        queryKey: queryKeys.analytics(projectId || '', timeRange),
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/overview?time_range=${timeRange}&environment=${environment}`);
            if (!res.ok) throw new Error("Failed to fetch analytics");
            return res.json();
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });

    // Fetch trends data with caching
    const { data: trendsData } = useQuery({
        queryKey: ["trends", projectId, timeRange, environment],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/trends?time_range=${timeRange}&environment=${environment}`);
            if (!res.ok) throw new Error("Failed to fetch trends");
            return res.json();
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });

    const trends: TrendData[] = trendsData?.trends || [];
    const groupBy: 'hour' | 'day' = trendsData?.group_by || 'day';

    const calculateTrend = (dataPoints: TrendData[], getValue: (t: TrendData) => number) => {
        if (!dataPoints || dataPoints.length < 2) return 0;
        const mid = Math.floor(dataPoints.length / 2);
        const firstHalf = dataPoints.slice(0, mid);
        const secondHalf = dataPoints.slice(mid);

        const avgFirst = firstHalf.reduce((acc, curr) => acc + getValue(curr), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((acc, curr) => acc + getValue(curr), 0) / secondHalf.length;

        if (avgFirst === 0) return 0;
        return ((avgSecond - avgFirst) / avgFirst) * 100;
    };

    if (projectLoading) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-48 mt-1" />
                </div>
                <div className="grid grid-cols-5 gap-4 mb-6">
                    {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-[250px]" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="w-full max-w-6xl mx-auto px-6 py-8">
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <ChartBarIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Project not found</p>
                </div>
            </div>
        );
    }

    // Helper to format timestamps like "Jan 2, 4:30pm"
    const formatTimestamp = (timestamp: string) => {
        // For 10-minute intervals (format: "HH:MM") - add today's date context
        if (timestamp.match(/^\d{2}:\d{2}$/)) {
            const [hours, minutes] = timestamp.split(':').map(Number);
            const period = hours >= 12 ? 'pm' : 'am';
            const hour12 = hours % 12 || 12;
            const now = new Date();
            const month = now.toLocaleDateString(undefined, { month: 'short' });
            const day = now.getDate();
            return `${month} ${day}, ${hour12}:${minutes.toString().padStart(2, '0')}${period}`;
        }
        // For hourly (format: "YYYY-MM-DD HH:00")
        if (timestamp.includes(' ')) {
            const [datePart, timePart] = timestamp.split(' ');
            const date = new Date(datePart);
            const hours = parseInt(timePart.split(':')[0]);
            const period = hours >= 12 ? 'pm' : 'am';
            const hour12 = hours % 12 || 12;
            return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${hour12}:00${period}`;
        }
        // For daily (format: "YYYY-MM-DD")
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Get last update time from trends
    const getLastUpdateTime = () => {
        if (trends.length === 0) return undefined;
        const lastWithData = [...trends].reverse().find(t => t.total > 0);
        if (!lastWithData) return undefined;
        return formatTimestamp(lastWithData.timestamp);
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-lg font-semibold">Analytics</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time observability for your AI requests</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportDialog projectId={projectId} type="analytics" environment={environment} />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1h" className="text-xs">Last Hour</SelectItem>
                            <SelectItem value="24h" className="text-xs">Last 24 Hours</SelectItem>
                            <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                            <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                            <SelectItem value="90d" className="text-xs">Last 90 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Primary Metrics - 5 columns */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <MetricCardWithChart
                        title="Edge Requests"
                        subtitle="REST Requests"
                        icon={<ChartBarIcon className="h-5 w-5" />}
                        value={overview.overview.total_requests}
                        lastUpdate={getLastUpdateTime()}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.total
                        }))}
                    />
                    <MetricCardWithLineChart
                        title="Auth"
                        subtitle="Success Rate"
                        icon={<BoltIcon className="h-5 w-5" />}
                        value={overview.overview.success_rate}
                        format="percentage"
                        lastUpdate={getLastUpdateTime()}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.total > 0 ? Math.round((t.success / t.total) * 100) : 0
                        }))}
                    />
                    <MetricCardWithLineChart
                        title="Billing"
                        subtitle="Total Cost"
                        icon={<CurrencyDollarIcon className="h-5 w-5" />}
                        value={overview.overview.total_cost}
                        format="currency"
                        lastUpdate={getLastUpdateTime()}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.cost
                        }))}
                        lineColor="hsl(217, 91%, 60%)"
                    />
                    <MetricCardWithLineChart
                        title="Performance"
                        subtitle="Avg Latency"
                        icon={<ClockIcon className="h-5 w-5" />}
                        value={overview.overview.avg_latency}
                        format="ms"
                        lastUpdate={getLastUpdateTime()}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.avg_latency
                        }))}
                        lineColor="hsl(24, 96%, 53%)"
                    />
                </div>
            )}

            {/* Area Chart - Full Width */}
            {trends.length > 0 && (
                <div className="mb-6">
                    <RequestsAreaChart data={trends} groupBy={groupBy} />
                </div>
            )}

            {/* Token Usage Chart - Full Width */}
            {trends.length > 0 && (
                <div className="mb-6">
                    <TokenUsageChart data={trends} groupBy={groupBy} />
                </div>
            )}

            {/* Charts Row - 3 columns */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <ModelUsageChart data={overview.breakdown.model_usage} />
                    <CostByProviderChart data={overview.breakdown.cost_by_provider} />
                    <LatencyHistogram data={overview.breakdown.latency_percentiles} />
                </div>
            )}

            {/* Security & Failover Row */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricCardWithLineChart
                        title="Security Incidents"
                        subtitle="Total detected"
                        value={overview.overview.total_incidents}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.filtered + t.blocked_output
                        }))}
                        lineColor="hsl(280, 65%, 60%)"
                    />
                    <MetricCardWithLineChart
                        title="Critical"
                        subtitle="Severity level"
                        value={overview.breakdown.incidents_by_severity.critical}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.error
                        }))}
                        lineColor="hsl(0, 84%, 60%)"
                    />
                    <MetricCardWithLineChart
                        title="High Priority"
                        subtitle="Needs attention"
                        value={overview.breakdown.incidents_by_severity.high}
                        chartData={trends.map(t => ({
                            label: formatTimestamp(t.timestamp),
                            value: t.filtered
                        }))}
                        lineColor="hsl(24, 96%, 53%)"
                    />
                    <FailoverMetrics
                        projectId={projectId}
                        environment={environment}
                        timeRange={timeRange}
                    />
                </div>
            )}

            {/* Empty State */}
            {overview && overview.overview.total_requests === 0 && (
                <div className="text-center py-16 flex flex-col items-center rounded-lg border border-border/40 bg-card mt-6">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                        <BoltIcon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium mb-1">No data yet</p>
                    <p className="text-xs text-muted-foreground max-w-[280px]">
                        Make some AI requests to see your analytics come to life
                    </p>
                </div>
            )}
        </div>
    );
}
