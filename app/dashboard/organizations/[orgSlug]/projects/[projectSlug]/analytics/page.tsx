'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { MetricCard } from '@/components/audit/MetricCard';
import { MetricCardWithChart } from '@/components/audit/MetricCardWithChart';
import { MetricCardWithLineChart } from '@/components/audit/MetricCardWithLineChart';
import { RequestsAreaChart } from '@/components/audit/RequestsAreaChart';
import { ModelUsageBarChart } from '@/components/audit/ModelUsageBarChart';
import { SecurityBreakdownDonutChart } from '@/components/audit/SecurityBreakdownDonutChart';
import { TimeRangeSelector } from '@/components/audit/TimeRangeSelector';
import { Activity, CheckCircle, DollarSign, Clock, ShieldAlert, Loader2 } from 'lucide-react';
import { useEnvironment } from '@/lib/contexts/EnvironmentContext';

interface TrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    blocked_output: number;
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

    // Fetch project ID
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

    // Fetch analytics data
    useEffect(() => {
        if (!projectId) return;

        const fetchAnalytics = async () => {
            try {
                // Fetch overview
                const overviewRes = await fetch(`/api/projects/${projectId}/analytics/overview?time_range=${timeRange}&environment=${environment}`);
                const overviewData = await overviewRes.json();
                setOverview(overviewData);

                // Fetch trends
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <p className="text-lg font-medium text-muted-foreground">Project not found</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
            {/* Header with time range selector */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
                    <p className="text-muted-foreground">
                        Insights and metrics for your AI requests
                    </p>
                </div>
                <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
            </div>

            {/* Metric Cards */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCardWithChart
                        title="Total Requests"
                        value={overview.overview.total_requests}
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.total
                        }))}
                        trend={(() => {
                            if (!trends || trends.length < 2) return 0;
                            const mid = Math.floor(trends.length / 2);
                            const firstHalf = trends.slice(0, mid);
                            const secondHalf = trends.slice(mid);

                            const avgFirst = firstHalf.reduce((acc, curr) => acc + curr.total, 0) / firstHalf.length;
                            const avgSecond = secondHalf.reduce((acc, curr) => acc + curr.total, 0) / secondHalf.length;

                            if (avgFirst === 0) return 0;
                            return ((avgSecond - avgFirst) / avgFirst) * 100;
                        })()}
                    />
                    <MetricCardWithLineChart
                        title="Success Rate"
                        value={overview.overview.success_rate}
                        format="percentage"
                        chartData={trends.map(t => ({
                            label: new Date(t.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                            value: t.total > 0 ? Math.round((t.success / t.total) * 100) : 0
                        }))}
                        trend={(() => {
                            if (!trends || trends.length < 2) return 0;
                            const mid = Math.floor(trends.length / 2);
                            const firstHalf = trends.slice(0, mid);
                            const secondHalf = trends.slice(mid);
                            
                            const getRate = (t: TrendData) => t.total > 0 ? (t.success / t.total) * 100 : 0;
                            
                            const avgFirst = firstHalf.reduce((acc, curr) => acc + getRate(curr), 0) / firstHalf.length;
                            const avgSecond = secondHalf.reduce((acc, curr) => acc + getRate(curr), 0) / secondHalf.length;
                            
                            if (avgFirst === 0) return 0;
                            return ((avgSecond - avgFirst) / avgFirst) * 100;
                        })()}
                    />
                    <MetricCard
                        title="Total Cost"
                        value={overview.overview.total_cost}
                        format="currency"
                    />
                    <MetricCard
                        title="Avg Latency"
                        value={overview.overview.avg_latency}
                        format="ms"
                    />
                </div>
            )}

            {/* Secondary Metrics */}
            {overview && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <MetricCard
                        title="Total Tokens"
                        value={overview.overview.total_tokens}
                    />
                    <MetricCard
                        title="Security Incidents"
                        value={overview.overview.total_incidents}
                        icon={<ShieldAlert className="h-4 w-4" />}
                    />
                    <MetricCard
                        title="Critical Incidents"
                        value={overview.overview.critical_incidents}
                        icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
                    />
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Requests over time */}
                {trends.length > 0 && (
                    <div className="lg:col-span-2">
                        <RequestsAreaChart data={trends} groupBy={groupBy} />
                    </div>
                )}

                {/* Model usage */}
                {overview?.breakdown?.model_usage && Object.keys(overview.breakdown.model_usage).length > 0 && (
                    <ModelUsageBarChart data={overview.breakdown.model_usage} />
                )}

                {/* Security breakdown */}
                {overview?.breakdown?.incidents_by_severity && (
                    <SecurityBreakdownDonutChart data={overview.breakdown.incidents_by_severity} />
                )}
            </div>

            {/* Empty state */}
            {overview && overview.overview.total_requests === 0 && (
                <div className="flex flex-col items-center justify-center py-12 border rounded-lg">
                    <p className="text-lg font-medium text-muted-foreground">No data yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Make some AI requests to see analytics
                    </p>
                </div>
            )}
        </div>
    );
}
