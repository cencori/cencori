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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
        <div className="w-full max-w-5xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-base font-medium">Usage</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Monitor your AI usage and consumption</p>
                </div>
                <div className="flex gap-1">
                    {['24h', '7d', '30d'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${timeRange === range
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                }`}
                        >
                            {range}
                        </button>
                    ))}
                </div>
            </div>

            {/* Monthly Quota */}
            <div className="rounded-md border border-border/40 bg-card p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h3 className="text-xs font-medium">Monthly Quota</h3>
                        <p className="text-[10px] text-muted-foreground">
                            {org.monthly_requests_used.toLocaleString()} / {org.monthly_request_limit.toLocaleString()} requests
                        </p>
                    </div>
                    <Badge variant={isAtLimit ? 'destructive' : 'outline'} className="text-[10px] h-5 uppercase">
                        {org.subscription_tier}
                    </Badge>
                </div>
                <Progress value={percentage} className="h-2 mb-2" />
                <div className="text-[10px] text-muted-foreground">
                    {isAtLimit ? (
                        <span className="flex items-center gap-1 text-red-500">
                            <AlertTriangle className="h-3 w-3" />
                            Limit reached. Upgrade to continue.
                        </span>
                    ) : isNearLimit ? (
                        <span className="text-amber-500">{Math.round(100 - percentage)}% remaining</span>
                    ) : (
                        <span>{Math.round(percentage)}% used • Resets monthly</span>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <div className="rounded-md border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                            <Activity className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">Requests</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono">{(stats?.total_requests || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Last {timeRange}</p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                            <Zap className="h-3.5 w-3.5 text-purple-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">Tokens</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono">
                        {stats?.total_tokens && stats.total_tokens >= 1000000
                            ? `${(stats.total_tokens / 1000000).toFixed(1)}M`
                            : stats?.total_tokens && stats.total_tokens >= 1000
                                ? `${(stats.total_tokens / 1000).toFixed(1)}K`
                                : (stats?.total_tokens || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Total consumed</p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">Cost</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono">${(stats?.total_cost || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">AI spending</p>
                </div>

                <div className="rounded-md border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-md bg-amber-500/10 flex items-center justify-center">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">Avg Latency</span>
                    </div>
                    <p className="text-2xl font-semibold font-mono">{stats?.avg_latency || 0}ms</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Response time</p>
                </div>
            </div>

            {/* Success Rate Banner */}
            {stats && stats.total_requests > 0 && (
                <div className="rounded-md border border-border/40 bg-card p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-emerald-500/10 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-xs font-medium">Success Rate</h3>
                                <p className="text-[10px] text-muted-foreground">API reliability</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-semibold font-mono text-emerald-500">
                                {stats.success_rate.toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Breakdowns */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Model Usage */}
                <div className="rounded-md border border-border/40 bg-card p-4">
                    <h3 className="text-xs font-medium mb-3">Top Models</h3>
                    {topModels.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
                    ) : (
                        <div className="space-y-2">
                            {topModels.map(([model, count]) => {
                                const pct = stats?.total_requests ? (count / stats.total_requests) * 100 : 0;
                                return (
                                    <div key={model}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="truncate max-w-[150px]">{model}</span>
                                            <span className="font-mono text-muted-foreground">{count.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Provider Usage */}
                <div className="rounded-md border border-border/40 bg-card p-4">
                    <h3 className="text-xs font-medium mb-3">By Provider</h3>
                    {topProviders.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">No data</p>
                    ) : (
                        <div className="space-y-2">
                            {topProviders.map(([provider, count]) => {
                                const pct = stats?.total_requests ? (count / stats.total_requests) * 100 : 0;
                                const colorClass = PROVIDER_COLORS[provider.toLowerCase()] || 'bg-gray-500';
                                return (
                                    <div key={provider}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                                                <span className="capitalize">{provider}</span>
                                            </div>
                                            <span className="font-mono text-muted-foreground">{pct.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${colorClass}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
