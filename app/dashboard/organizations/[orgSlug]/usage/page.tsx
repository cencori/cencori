"use client";

import React, { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from '@/lib/supabaseClient';
import { Activity, Zap, DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface Organization {
    id: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    monthly_requests_used: number;
    monthly_request_limit: number;
}

interface UsageStats {
    total_requests: number;
    total_tokens: number;
    total_cost: number;
    avg_latency: number;
    success_rate: number;
    model_usage: Record<string, number>;
    provider_usage: Record<string, number>;
    daily_requests: Array<{ date: string; count: number }>;
}

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Hook to fetch org data
function useOrganization(orgSlug: string) {
    return useQuery({
        queryKey: ["organization", orgSlug],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_tier, monthly_requests_used, monthly_request_limit')
                .eq('slug', orgSlug)
                .single();

            if (error || !data) throw new Error("Organization not found");
            return data as Organization;
        },
        staleTime: 30 * 1000,
    });
}

// Hook to fetch usage stats across all org projects
function useUsageStats(orgId: string | undefined, timeRange: string) {
    return useQuery({
        queryKey: ["usageStats", orgId, timeRange],
        queryFn: async () => {
            if (!orgId) throw new Error("No org ID");

            // Get all projects for this org
            const { data: projects } = await supabase
                .from('projects')
                .select('id')
                .eq('organization_id', orgId);

            const projectIds = projects?.map((p: { id: string }) => p.id) || [];
            if (projectIds.length === 0) {
                return {
                    total_requests: 0,
                    total_tokens: 0,
                    total_cost: 0,
                    avg_latency: 0,
                    success_rate: 0,
                    model_usage: {},
                    provider_usage: {},
                    daily_requests: [],
                };
            }

            // Calculate time filter
            const now = new Date();
            let startTime: Date;
            switch (timeRange) {
                case '24h':
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case '7d':
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case '30d':
                    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            // Fetch all requests across all projects
            const { data: requests } = await supabase
                .from('ai_requests')
                .select('*')
                .in('project_id', projectIds)
                .gte('created_at', startTime.toISOString());

            if (!requests || requests.length === 0) {
                return {
                    total_requests: 0,
                    total_tokens: 0,
                    total_cost: 0,
                    avg_latency: 0,
                    success_rate: 0,
                    model_usage: {},
                    provider_usage: {},
                    daily_requests: [],
                };
            }

            // Calculate stats
            const totalRequests = requests.length;
            const successfulRequests = requests.filter((r: { status: string }) => r.status === 'success').length;
            const totalTokens = requests.reduce((sum: number, r: { total_tokens?: number }) => sum + (r.total_tokens || 0), 0);
            const totalCost = requests.reduce((sum: number, r: { cost_usd?: number }) => sum + (r.cost_usd || 0), 0);
            const latencies = requests.map((r: { latency_ms?: number }) => r.latency_ms).filter((l: number | null | undefined): l is number => l != null);
            const avgLatency = latencies.length > 0
                ? latencies.reduce((sum: number, l: number) => sum + l, 0) / latencies.length
                : 0;

            // Model usage breakdown
            const modelUsage: Record<string, number> = {};
            requests.forEach((r: { model?: string }) => {
                if (r.model) {
                    modelUsage[r.model] = (modelUsage[r.model] || 0) + 1;
                }
            });

            // Provider usage breakdown
            const providerUsage: Record<string, number> = {};
            requests.forEach((r: { provider?: string }) => {
                const provider = r.provider || 'unknown';
                providerUsage[provider] = (providerUsage[provider] || 0) + 1;
            });

            // Daily requests breakdown
            const dailyMap: Record<string, number> = {};
            requests.forEach((r: { created_at: string }) => {
                const date = new Date(r.created_at).toISOString().split('T')[0];
                dailyMap[date] = (dailyMap[date] || 0) + 1;
            });
            const dailyRequests = Object.entries(dailyMap)
                .map(([date, count]) => ({ date, count }))
                .sort((a, b) => a.date.localeCompare(b.date));

            return {
                total_requests: totalRequests,
                total_tokens: totalTokens,
                total_cost: totalCost,
                avg_latency: Math.round(avgLatency),
                success_rate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
                model_usage: modelUsage,
                provider_usage: providerUsage,
                daily_requests: dailyRequests,
            } as UsageStats;
        },
        enabled: !!orgId,
        staleTime: 60 * 1000,
    });
}

const PROVIDER_COLORS: Record<string, string> = {
    openai: 'bg-emerald-500',
    anthropic: 'bg-orange-500',
    google: 'bg-blue-500',
    mistral: 'bg-pink-500',
    groq: 'bg-yellow-500',
    cohere: 'bg-purple-500',
    deepseek: 'bg-cyan-500',
};

export default function UsagePage({ params }: PageProps) {
    const { orgSlug } = use(params);
    const [timeRange, setTimeRange] = React.useState('7d');

    const { data: org, isLoading: orgLoading } = useOrganization(orgSlug);
    const { data: stats, isLoading: statsLoading } = useUsageStats(org?.id, timeRange);

    const isLoading = orgLoading || statsLoading;

    if (isLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <Skeleton className="h-5 w-24 mb-6" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-64 mb-6" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        );
    }

    if (!org) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8">
                <div className="text-center py-16 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">Organization not found</p>
                </div>
            </div>
        );
    }

    const percentage = Math.min((org.monthly_requests_used / org.monthly_request_limit) * 100, 100);
    const isNearLimit = percentage >= 80;
    const isAtLimit = percentage >= 100;

    const topModels = Object.entries(stats?.model_usage || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    const topProviders = Object.entries(stats?.provider_usage || {})
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-base font-medium">Usage</h1>
                </div>
                <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/40">
                    {['24h', '7d', '30d'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1 text-[10px] font-medium rounded-md transition-all ${timeRange === range
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Monthly Quota */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium tracking-tight">Monthly Quota</h3>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            {org.monthly_requests_used.toLocaleString()} / {org.monthly_request_limit.toLocaleString()} requests used
                        </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 gap-1.5 px-2.5 font-normal uppercase tracking-wider">
                        <span className={`size-1.5 rounded-full ${isAtLimit ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        {org.subscription_tier} Plan
                    </Badge>
                </div>
                <div className="p-6">
                    <Progress value={percentage} className="h-2 mb-3" />
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Reset happens on the 1st of every month</span>
                        {isAtLimit ? (
                            <span className="flex items-center gap-1.5 text-red-500 font-medium">
                                <AlertTriangle className="h-3 w-3" />
                                Limit reached
                            </span>
                        ) : (
                            <span className={isNearLimit ? "text-amber-500 font-medium" : "text-muted-foreground"}>
                                {Math.round(100 - percentage)}% remaining
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-border/40 bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Requests</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono tracking-tight">{(stats?.total_requests || 0).toLocaleString()}</p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="h-4 w-4 text-purple-500" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tokens</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono tracking-tight">
                        {stats?.total_tokens && stats.total_tokens >= 1000000
                            ? `${(stats.total_tokens / 1000000).toFixed(1)}M`
                            : stats?.total_tokens && stats.total_tokens >= 1000
                                ? `${(stats.total_tokens / 1000).toFixed(1)}K`
                                : (stats?.total_tokens || 0).toLocaleString()}
                    </p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Cost</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono tracking-tight">${(stats?.total_cost || 0).toFixed(2)}</p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Latency</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono tracking-tight">{stats?.avg_latency || 0}ms</p>
                </div>
            </div>

            {/* Breakdowns */}
            <div className="grid gap-8 md:grid-cols-2">
                {/* Model Usage Table */}
                <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/40">
                        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Top Models</h3>
                    </div>
                    <div className="p-0">
                        {topModels.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground">No data available</div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <tbody className="divide-y divide-border/20">
                                    {topModels.map(([model, count]) => {
                                        const pct = stats?.total_requests ? (count / stats.total_requests) * 100 : 0;
                                        return (
                                            <tr key={model} className="group hover:bg-muted/20 transition-colors">
                                                <td className="px-6 py-3 font-medium">{model}</td>
                                                <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                                                    {count.toLocaleString()}
                                                    <span className="ml-2 text-[10px] opacity-70">({pct.toFixed(0)}%)</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Provider Usage Table */}
                <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                    <div className="px-6 py-4 border-b border-border/40">
                        <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">By Provider</h3>
                    </div>
                    <div className="p-0">
                        {topProviders.length === 0 ? (
                            <div className="p-8 text-center text-xs text-muted-foreground">No data available</div>
                        ) : (
                            <table className="w-full text-left text-xs">
                                <tbody className="divide-y divide-border/20">
                                    {topProviders.map(([provider, count]) => {
                                        const pct = stats?.total_requests ? (count / stats.total_requests) * 100 : 0;
                                        const colorClass = PROVIDER_COLORS[provider.toLowerCase()] || 'bg-gray-500';
                                        return (
                                            <tr key={provider} className="group hover:bg-muted/20 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`size-1.5 rounded-full ${colorClass}`} />
                                                        <span className="font-medium capitalize">{provider}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                                                    {count.toLocaleString()}
                                                    <span className="ml-2 text-[10px] opacity-70">({pct.toFixed(0)}%)</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
