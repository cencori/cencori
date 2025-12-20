'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MetricCard } from '@/components/audit/MetricCard';
import { MetricCardWithChart } from '@/components/audit/MetricCardWithChart';
import { MetricCardWithLineChart } from '@/components/audit/MetricCardWithLineChart';
import { RequestsAreaChart } from '@/components/audit/RequestsAreaChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, Loader2, BarChart3 } from 'lucide-react';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';
import { Skeleton } from '@/components/ui/skeleton';

interface TrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    blocked_output: number;
    error: number;
    cost: number;
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
    };
}

interface PageProps {
    params: Promise<{
        orgSlug: string;
        projectSlug: string;
    }>;
}

export default function AnalyticsPage({ params }: PageProps) {
    const { environment } = useEnvironment();
    const [projectId, setProjectId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('7d');
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [trends, setTrends] = useState<TrendData[]>([]);
    const [groupBy, setGroupBy] = useState<'hour' | 'day'>('day');

    useEffect(() => {
        const fetchProjectId = async () => {
            setLoading(true);
            try {
                const { projectSlug, orgSlug } = await params;

                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('slug', orgSlug)
                    .single();

                if (!orgData) return;

                const { data: projectData } = await supabase
                    .from('projects')
                    .select('id')
                    .eq('slug', projectSlug)
                    .eq('organization_id', orgData.id)
                    .single();

                if (projectData) {
                    setProjectId(projectData.id);
                }
            } catch (error) {
                console.error('Error fetching project:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectId();
    }, [params]);

    useEffect(() => {
        if (!projectId) return;

        const fetchAnalytics = async () => {
            try {
                const overviewRes = await fetch(`/api/projects/${projectId}/analytics/overview?time_range=${timeRange}&environment=${environment}`);
                const overviewData = await overviewRes.json();
                setOverview(overviewData);

                const trendsRes = await fetch(`/api/projects/${projectId}/analytics/trends?time_range=${timeRange}&environment=${environment}`);
                const trendsData = await trendsRes.json();
                setTrends(trendsData.trends || []);
                setGroupBy(trendsData.group_by);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            }
        };

        fetchAnalytics();
    }, [projectId, environment, timeRange]);

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

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="mb-6">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-48 mt-1" />
                </div>
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
                </div>
                <Skeleton className="h-[200px]" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Project not found</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-base font-medium">Analytics</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Insights and metrics for your AI requests</p>
                </div>
                <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1h" className="text-xs">1 Hour</SelectItem>
                        <SelectItem value="24h" className="text-xs">24 Hours</SelectItem>
                        <SelectItem value="7d" className="text-xs">7 Days</SelectItem>
                        <SelectItem value="30d" className="text-xs">30 Days</SelectItem>
                        <SelectItem value="all" className="text-xs">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Primary Metrics */}
            {overview && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCardWithChart
                        title="Total Requests"
                        value={overview.overview.total_requests}
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.total
                        }))}
                        trend={calculateTrend(trends, t => t.total)}
                    />
                    <MetricCardWithLineChart
                        title="Success Rate"
                        value={overview.overview.success_rate}
                        format="percentage"
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.total > 0 ? Math.round((t.success / t.total) * 100) : 0
                        }))}
                        trend={calculateTrend(trends, t => t.total > 0 ? (t.success / t.total) * 100 : 0)}
                    />
                    <MetricCardWithLineChart
                        title="Total Cost"
                        value={overview.overview.total_cost}
                        format="currency"
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.cost
                        }))}
                        trend={calculateTrend(trends, t => t.cost)}
                        lineColor="hsl(217, 91%, 60%)"
                    />
                    <MetricCardWithLineChart
                        title="Avg Latency"
                        value={overview.overview.avg_latency}
                        format="ms"
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.avg_latency
                        }))}
                        trend={calculateTrend(trends, t => t.avg_latency)}
                        lineColor="hsl(24, 96%, 53%)"
                    />
                </div>
            )}

            {/* Secondary Metrics */}
            {overview && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <MetricCard
                        title="Total Tokens"
                        value={overview.overview.total_tokens}
                    />
                    <MetricCard
                        title="Security Incidents"
                        value={overview.overview.total_incidents}
                        icon={<ShieldAlert className="h-3 w-3" />}
                    />
                    <MetricCard
                        title="Critical Incidents"
                        value={overview.overview.critical_incidents}
                        icon={<ShieldAlert className="h-3 w-3 text-red-500" />}
                    />
                </div>
            )}

            {/* Area Chart */}
            {trends.length > 0 && (
                <RequestsAreaChart data={trends} groupBy={groupBy} />
            )}

            {/* Empty State */}
            {overview && overview.overview.total_requests === 0 && (
                <div className="text-center py-16 flex flex-col items-center rounded-md border border-border/40 bg-card">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No data yet</p>
                    <p className="text-xs text-muted-foreground">Make some AI requests to see analytics</p>
                </div>
            )}
        </div>
    );
}
