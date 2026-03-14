'use client';

import { useMemo, useState, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { MetricCardWithChart } from '@/components/audit/MetricCardWithChart';
import { MetricCardWithLineChart } from '@/components/audit/MetricCardWithLineChart';
import { RequestsAreaChart } from '@/components/audit/RequestsAreaChart';
import { LogsBarChart } from '@/components/audit/LogsBarChart';
import { ModelUsageChart } from '@/components/analytics/ModelUsageChart';
import { CostByProviderChart } from '@/components/analytics/CostByProviderChart';
import { LatencyHistogram } from '@/components/analytics/LatencyHistogram';
import { TokenUsageChart } from '@/components/analytics/TokenUsageChart';
import { FailoverMetrics } from '@/components/analytics/FailoverMetrics';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    ChartBarIcon,
    CurrencyDollarIcon,
    ClockIcon,
    BoltIcon,
    ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { ArrowRight } from 'lucide-react';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';
import { Skeleton } from '@/components/ui/skeleton';
import { queryKeys } from '@/lib/hooks/useQueries';
import { ExportDialog } from '@/components/dashboard/ExportDialog';
import { cn } from '@/lib/utils';

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

interface HttpTrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    error: number;
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

type ObservabilitySection = 'overview' | 'ai' | 'http' | 'reliability' | 'security';

type HttpMetricKey = 'total' | 'success' | 'filtered' | 'error';

interface SectionDefinition {
    id: ObservabilitySection;
    label: string;
}

const sections: SectionDefinition[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'ai', label: 'AI' },
    { id: 'http', label: 'HTTP' },
    { id: 'reliability', label: 'Reliability' },
    { id: 'security', label: 'Security' },
];

function isObservabilitySection(value: string | null): value is ObservabilitySection {
    return value === 'overview'
        || value === 'ai'
        || value === 'http'
        || value === 'reliability'
        || value === 'security';
}

function useProjectId(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ['projectId', orgSlug, projectSlug],
        queryFn: async () => {
            const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', orgSlug)
                .single();

            if (!orgData) throw new Error('Organization not found');

            const { data: projectData } = await supabase
                .from('projects')
                .select('id')
                .eq('slug', projectSlug)
                .eq('organization_id', orgData.id)
                .single();

            if (!projectData) throw new Error('Project not found');
            return projectData.id;
        },
        staleTime: 5 * 60 * 1000,
    });
}

function formatTimestamp(timestamp: string): string {
    if (timestamp.match(/^\d{2}:\d{2}$/)) {
        const [hours, minutes] = timestamp.split(':').map(Number);
        const period = hours >= 12 ? 'pm' : 'am';
        const hour12 = hours % 12 || 12;
        const now = new Date();
        const month = now.toLocaleDateString(undefined, { month: 'short' });
        const day = now.getDate();
        return `${month} ${day}, ${hour12}:${minutes.toString().padStart(2, '0')}${period}`;
    }

    if (timestamp.includes(' ')) {
        const [datePart, timePart] = timestamp.split(' ');
        const date = new Date(datePart);
        const hours = Number.parseInt(timePart.split(':')[0], 10);
        const period = hours >= 12 ? 'pm' : 'am';
        const hour12 = hours % 12 || 12;
        return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${hour12}:00${period}`;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return timestamp;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function summarizeHttpTrends(trends: HttpTrendData[]) {
    const totals = trends.reduce(
        (acc, point) => {
            acc.total += point.total || 0;
            acc.success += point.success || 0;
            acc.filtered += point.filtered || 0;
            acc.error += point.error || 0;
            return acc;
        },
        { total: 0, success: 0, filtered: 0, error: 0 }
    );

    const successRate = totals.total > 0 ? Math.round((totals.success / totals.total) * 100) : 0;
    const errorRate = totals.total > 0 ? Math.round((totals.error / totals.total) * 100) : 0;

    return {
        ...totals,
        successRate,
        errorRate,
    };
}

function getLastUpdateTime<T extends { timestamp: string }>(
    points: T[],
    hasData: (point: T) => boolean
): string | undefined {
    if (points.length === 0) return undefined;
    const lastWithData = [...points].reverse().find(hasData);
    return lastWithData ? formatTimestamp(lastWithData.timestamp) : undefined;
}

function toHttpMetricSeries(
    trends: HttpTrendData[],
    key: HttpMetricKey
): Array<{ label: string; value: number }> {
    return trends.map((trend) => ({
        label: formatTimestamp(trend.timestamp),
        value: trend[key] || 0,
    }));
}

export default function ObservabilityPage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);
    const { environment } = useEnvironment();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [timeRange, setTimeRange] = useState('7d');

    const rawSectionParam = searchParams.get('section');
    const normalizedSectionParam = rawSectionParam === 'api' || rawSectionParam === 'web'
        ? 'http'
        : rawSectionParam;
    const section: ObservabilitySection = isObservabilitySection(normalizedSectionParam)
        ? normalizedSectionParam
        : 'overview';

    const setSection = (nextSection: ObservabilitySection) => {
        const nextParams = new URLSearchParams(searchParams.toString());

        if (nextSection === 'overview') {
            nextParams.delete('section');
        } else {
            nextParams.set('section', nextSection);
        }

        const queryString = nextParams.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    };

    const { data: projectId, isLoading: projectLoading } = useProjectId(orgSlug, projectSlug);

    const { data: overview } = useQuery<OverviewData>({
        queryKey: queryKeys.analytics(projectId || '', timeRange),
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/overview?time_range=${timeRange}&environment=${environment}`);
            if (!res.ok) throw new Error('Failed to fetch observability data');
            return res.json();
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });

    const { data: trendsData } = useQuery<{ trends: TrendData[]; group_by: 'hour' | 'day' }>({
        queryKey: ['trends', projectId, timeRange, environment],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/trends?time_range=${timeRange}&environment=${environment}`);
            if (!res.ok) throw new Error('Failed to fetch trends');
            return res.json();
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });

    const { data: httpTrendsData } = useQuery<{ trends: HttpTrendData[] }>({
        queryKey: ['gatewayTimeline', 'http', projectId, timeRange, environment],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/logs/http/timeline?time_range=${timeRange}&environment=${environment}`);
            if (!res.ok) throw new Error('Failed to fetch HTTP traffic timeline');
            return res.json();
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });

    const trends = useMemo(() => trendsData?.trends || [], [trendsData?.trends]);
    const groupBy: 'hour' | 'day' = trendsData?.group_by || 'day';

    const httpTrends = useMemo(
        () => httpTrendsData?.trends || [],
        [httpTrendsData?.trends]
    );

    const httpSummary = useMemo(
        () => summarizeHttpTrends(httpTrends),
        [httpTrends]
    );

    const aiLastUpdate = getLastUpdateTime(trends, (point) => point.total > 0);
    const httpLastUpdate = getLastUpdateTime(httpTrends, (point) => point.total > 0);

    if (projectLoading) {
        return (
            <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
                <div className="mb-8">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-3 w-52 mt-1" />
                </div>
                <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
                    <div className="mb-4 lg:mb-0">
                        <Skeleton className="h-28 w-full max-w-[180px]" />
                    </div>
                    <div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-40" />
                            ))}
                        </div>
                        <Skeleton className="h-[260px]" />
                    </div>
                </div>
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

    const emptyOverall = !overview || (
        overview.overview.total_requests === 0
        && httpSummary.total === 0
    );

    return (
        <div className="w-full max-w-[1360px] mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-base font-medium">Observability</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Real-time observability across AI and HTTP traffic</p>
                </div>
                <div className="flex items-center gap-2">
                    <ExportDialog projectId={projectId} type="analytics" environment={environment} />
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1h" className="text-xs">Last Hour</SelectItem>
                            <SelectItem value="24h" className="text-xs">24 Hours</SelectItem>
                            <SelectItem value="7d" className="text-xs">7 Days</SelectItem>
                            <SelectItem value="30d" className="text-xs">30 Days</SelectItem>
                            <SelectItem value="90d" className="text-xs">90 Days</SelectItem>
                            <SelectItem value="all" className="text-xs">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-6">
                <aside className="mb-4 lg:mb-0 lg:-ml-2">
                    <nav className="flex lg:flex-col gap-2 rounded-md">
                        {sections.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setSection(item.id)}
                                className={cn(
                                    'flex items-center gap-2 h-8 px-2.5 rounded text-xs text-left transition-colors',
                                    section === item.id
                                        ? 'bg-secondary text-foreground font-medium'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                                )}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                <div className="min-w-0">
                    {section === 'overview' && (
                        <>
                            {overview && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                    <MetricCardWithChart
                                        title="AI Edge Requests"
                                        subtitle="REST Requests"
                                        icon={<ChartBarIcon className="h-5 w-5" />}
                                        value={overview.overview.total_requests}
                                        lastUpdate={aiLastUpdate}
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.total,
                                        }))}
                                    />
                                    <MetricCardWithLineChart
                                        title="Auth"
                                        subtitle="Success Rate"
                                        icon={<BoltIcon className="h-5 w-5" />}
                                        value={overview.overview.success_rate}
                                        format="percentage"
                                        lastUpdate={aiLastUpdate}
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.total > 0 ? Math.round((point.success / point.total) * 100) : 0,
                                        }))}
                                    />
                                    <MetricCardWithLineChart
                                        title="Billing"
                                        subtitle="Total Cost"
                                        icon={<CurrencyDollarIcon className="h-5 w-5" />}
                                        value={overview.overview.total_cost}
                                        format="currency"
                                        lastUpdate={aiLastUpdate}
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.cost,
                                        }))}
                                        lineColor="hsl(217, 91%, 60%)"
                                    />
                                    <MetricCardWithLineChart
                                        title="Performance"
                                        subtitle="Avg Latency"
                                        icon={<ClockIcon className="h-5 w-5" />}
                                        value={overview.overview.avg_latency}
                                        format="ms"
                                        lastUpdate={aiLastUpdate}
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.avg_latency,
                                        }))}
                                        lineColor="hsl(24, 96%, 53%)"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <MetricCardWithChart
                                    title="HTTP Traffic"
                                    subtitle="API + web requests"
                                    icon={<ChartBarIcon className="h-5 w-5" />}
                                    value={httpSummary.total}
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'total')}
                                />
                                <MetricCardWithLineChart
                                    title="HTTP Health"
                                    subtitle="Success rate"
                                    icon={<BoltIcon className="h-5 w-5" />}
                                    value={httpSummary.successRate}
                                    format="percentage"
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'success')}
                                    lineColor="hsl(142, 71%, 45%)"
                                />
                            </div>

                            {trends.length > 0 && (
                                <div className="mb-6">
                                    <RequestsAreaChart data={trends} groupBy={groupBy} />
                                </div>
                            )}

                            {trends.length > 0 && (
                                <div className="mb-6">
                                    <TokenUsageChart data={trends} groupBy={groupBy} />
                                </div>
                            )}

                            {emptyOverall && (
                                <div className="text-center py-16 flex flex-col items-center rounded-lg border border-border/40 bg-card mt-6">
                                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
                                        <BoltIcon className="h-6 w-6 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium mb-1">No data yet</p>
                                    <p className="text-xs text-muted-foreground max-w-[320px]">
                                        Make AI or HTTP requests to populate observability metrics.
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    {section === 'ai' && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-sm font-medium">AI</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Model traffic, token usage, provider cost, and latency.</p>
                                </div>
                                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                    <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/logs`}>
                                        Open AI Logs
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                    </Link>
                                </Button>
                            </div>

                            {trends.length > 0 && (
                                <div className="mb-6">
                                    <RequestsAreaChart data={trends} groupBy={groupBy} />
                                </div>
                            )}

                            {trends.length > 0 && (
                                <div className="mb-6">
                                    <TokenUsageChart data={trends} groupBy={groupBy} />
                                </div>
                            )}

                            {overview && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <ModelUsageChart data={overview.breakdown.model_usage} />
                                    <CostByProviderChart data={overview.breakdown.cost_by_provider} />
                                    <LatencyHistogram data={overview.breakdown.latency_percentiles} />
                                </div>
                            )}
                        </>
                    )}

                    {section === 'http' && (
                        <>
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-sm font-medium">HTTP</h2>
                                    <p className="text-xs text-muted-foreground mt-0.5">Unified API and web request health, status mix, and request volume.</p>
                                </div>
                                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                    <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/logs?source=http`}>
                                        Open HTTP Logs
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                    </Link>
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <MetricCardWithChart
                                    title="Requests"
                                    subtitle="Total volume"
                                    icon={<ChartBarIcon className="h-5 w-5" />}
                                    value={httpSummary.total}
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'total')}
                                />
                                <MetricCardWithLineChart
                                    title="Success"
                                    subtitle="2xx/3xx"
                                    icon={<BoltIcon className="h-5 w-5" />}
                                    value={httpSummary.successRate}
                                    format="percentage"
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'success')}
                                    lineColor="hsl(142, 71%, 45%)"
                                />
                                <MetricCardWithLineChart
                                    title="Errors"
                                    subtitle="4xx/5xx"
                                    icon={<ShieldExclamationIcon className="h-5 w-5" />}
                                    value={httpSummary.errorRate}
                                    format="percentage"
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'error')}
                                    lineColor="hsl(0, 84%, 60%)"
                                />
                                <MetricCardWithLineChart
                                    title="Rate Limited"
                                    subtitle="429 responses"
                                    icon={<ClockIcon className="h-5 w-5" />}
                                    value={httpSummary.filtered}
                                    lastUpdate={httpLastUpdate}
                                    chartData={toHttpMetricSeries(httpTrends, 'filtered')}
                                    lineColor="hsl(24, 96%, 53%)"
                                />
                            </div>

                            <LogsBarChart
                                projectId={projectId}
                                timeRange={timeRange}
                                environment={environment}
                                source="http"
                            />
                        </>
                    )}

                    {section === 'reliability' && (
                        <>
                            <div className="mb-4">
                                <h2 className="text-sm font-medium">Reliability</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Failover behavior, request error rates, and system stability signals.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <FailoverMetrics
                                    projectId={projectId}
                                    environment={environment}
                                    timeRange={timeRange}
                                />
                                <MetricCardWithLineChart
                                    title="HTTP Errors"
                                    subtitle="4xx/5xx rate"
                                    value={httpSummary.errorRate}
                                    format="percentage"
                                    chartData={toHttpMetricSeries(httpTrends, 'error')}
                                    lineColor="hsl(0, 84%, 60%)"
                                    lastUpdate={httpLastUpdate}
                                />
                                <MetricCardWithLineChart
                                    title="HTTP Throttles"
                                    subtitle="429 spikes"
                                    value={httpSummary.filtered}
                                    chartData={toHttpMetricSeries(httpTrends, 'filtered')}
                                    lineColor="hsl(24, 96%, 53%)"
                                    lastUpdate={httpLastUpdate}
                                />
                            </div>

                            {overview && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <MetricCardWithLineChart
                                        title="AI Success Rate"
                                        subtitle="Request reliability"
                                        value={overview.overview.success_rate}
                                        format="percentage"
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.total > 0 ? Math.round((point.success / point.total) * 100) : 0,
                                        }))}
                                        lineColor="hsl(142, 71%, 45%)"
                                        lastUpdate={aiLastUpdate}
                                    />
                                    <MetricCardWithLineChart
                                        title="Average Latency"
                                        subtitle="AI request response"
                                        value={overview.overview.avg_latency}
                                        format="ms"
                                        chartData={trends.map((point) => ({
                                            label: formatTimestamp(point.timestamp),
                                            value: point.avg_latency,
                                        }))}
                                        lineColor="hsl(24, 96%, 53%)"
                                        lastUpdate={aiLastUpdate}
                                    />
                                    <MetricCardWithLineChart
                                        title="HTTP Success Rate"
                                        subtitle="API + web"
                                        value={httpSummary.successRate}
                                        format="percentage"
                                        chartData={toHttpMetricSeries(httpTrends, 'success')}
                                        lineColor="hsl(142, 71%, 45%)"
                                        lastUpdate={httpLastUpdate}
                                    />
                                    <MetricCardWithChart
                                        title="HTTP Volume"
                                        subtitle="Traffic stability"
                                        value={httpSummary.total}
                                        chartData={toHttpMetricSeries(httpTrends, 'total')}
                                        lastUpdate={httpLastUpdate}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {section === 'security' && overview && (
                        <>
                            <div className="mb-4">
                                <h2 className="text-sm font-medium">Security</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Incident severity, filtered patterns, and safety-related request behavior.</p>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <MetricCardWithLineChart
                                    title="Security Incidents"
                                    subtitle="Total detected"
                                    value={overview.overview.total_incidents}
                                    chartData={trends.map((point) => ({
                                        label: formatTimestamp(point.timestamp),
                                        value: point.filtered + point.blocked_output,
                                    }))}
                                    lineColor="hsl(280, 65%, 60%)"
                                    lastUpdate={aiLastUpdate}
                                />
                                <MetricCardWithLineChart
                                    title="Critical"
                                    subtitle="Severity level"
                                    value={overview.breakdown.incidents_by_severity.critical}
                                    chartData={trends.map((point) => ({
                                        label: formatTimestamp(point.timestamp),
                                        value: point.error,
                                    }))}
                                    lineColor="hsl(0, 84%, 60%)"
                                    lastUpdate={aiLastUpdate}
                                />
                                <MetricCardWithLineChart
                                    title="High Priority"
                                    subtitle="Needs attention"
                                    value={overview.breakdown.incidents_by_severity.high}
                                    chartData={trends.map((point) => ({
                                        label: formatTimestamp(point.timestamp),
                                        value: point.filtered,
                                    }))}
                                    lineColor="hsl(24, 96%, 53%)"
                                    lastUpdate={aiLastUpdate}
                                />
                                <MetricCardWithLineChart
                                    title="Blocked Output"
                                    subtitle="Output protections"
                                    value={trends.reduce((sum, point) => sum + (point.blocked_output || 0), 0)}
                                    chartData={trends.map((point) => ({
                                        label: formatTimestamp(point.timestamp),
                                        value: point.blocked_output || 0,
                                    }))}
                                    lineColor="hsl(0, 84%, 60%)"
                                    lastUpdate={aiLastUpdate}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                                    <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/logs`}>
                                        Review AI Security Signals
                                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                    </Link>
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
