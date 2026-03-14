'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ObservabilityChartCard } from '@/components/analytics/ObservabilityChartCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface CacheAnalyticsDashboardProps {
    projectId: string;
    timeRange: string;
}

interface CacheAnalytics {
    hitRate: number;
    totalLookups: number;
    exactHits: number;
    semanticHits: number;
    misses: number;
    totalTokensSaved: number;
    totalCostSaved: number;
    activeEntries: number;
    hitRateOverTime: Array<{
        timestamp: string;
        hitRate: number;
        lookups: number;
    }>;
    topCachedPrompts: Array<{
        id: string;
        promptPreview: string;
        model: string;
        hitCount: number;
        costSaved: number;
        lastHitAt: string | null;
    }>;
}

const rangeApiMap: Record<string, string> = {
    'Last 1 Hour': '1h',
    'Last 24 Hours': '24h',
    'Last 7 Days': '7d',
    'Last 30 Days': '30d',
};

function formatTokens(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
}

function formatCost(v: number): string {
    if (v === 0) return '$0';
    if (v < 0.01) return `$${v.toFixed(4)}`;
    if (v < 1) return `$${v.toFixed(3)}`;
    return `$${v.toFixed(2)}`;
}

export function CacheAnalyticsDashboard({ projectId, timeRange }: CacheAnalyticsDashboardProps) {
    const range = rangeApiMap[timeRange] || '7d';
    const queryClient = useQueryClient();

    const { data: analytics, isLoading } = useQuery<CacheAnalytics>({
        queryKey: ['cacheAnalytics', projectId, range],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/cache/analytics?range=${range}`);
            if (!res.ok) throw new Error('Failed to fetch cache analytics');
            return res.json();
        },
        staleTime: 30 * 1000,
    });

    const invalidateMutation = useMutation({
        mutationFn: async (entryId?: string) => {
            const res = await fetch(`/api/projects/${projectId}/cache/entries`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entryId ? { cache_key: entryId } : { all: true }),
            });
            if (!res.ok) throw new Error('Failed to invalidate');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cacheAnalytics', projectId] });
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
                <Skeleton className="h-48 rounded-xl" />
            </div>
        );
    }

    if (!analytics) return null;

    const hasData = analytics.totalLookups > 0;

    return (
        <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Hit Rate</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight mt-1">
                        {hasData ? `${(analytics.hitRate * 100).toFixed(1)}%` : '--'}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        {analytics.exactHits + analytics.semanticHits} hits / {analytics.totalLookups} lookups
                    </p>
                </div>
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Tokens Saved</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight mt-1">
                        {formatTokens(analytics.totalTokensSaved)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        across {analytics.exactHits + analytics.semanticHits} cache hits
                    </p>
                </div>
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Cost Saved</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight text-emerald-500 mt-1">
                        {formatCost(analytics.totalCostSaved)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        estimated savings
                    </p>
                </div>
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <p className="text-xs text-muted-foreground">Active Entries</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight mt-1">
                        {analytics.activeEntries.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                        cached prompts
                    </p>
                </div>
            </div>

            {/* Charts */}
            {hasData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <ObservabilityChartCard
                        title="Hit Rate Over Time"
                        series={[
                            {
                                key: 'hitRate',
                                label: 'Hit Rate',
                                color: 'hsl(142, 71%, 45%)',
                                format: 'percentage',
                                data: analytics.hitRateOverTime.map(p => ({
                                    timestamp: p.timestamp,
                                    value: p.hitRate * 100,
                                })),
                            },
                        ]}
                    />
                    <ObservabilityChartCard
                        title="Cache Lookups"
                        series={[
                            {
                                key: 'lookups',
                                label: 'Lookups',
                                color: 'hsl(220, 70%, 55%)',
                                data: analytics.hitRateOverTime.map(p => ({
                                    timestamp: p.timestamp,
                                    value: p.lookups,
                                })),
                                total: analytics.totalLookups,
                            },
                        ]}
                        type="bar"
                    />
                </div>
            )}

            {/* Top cached prompts */}
            {analytics.topCachedPrompts.length > 0 && (
                <div className="rounded-xl border border-border/30 bg-card">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                        <p className="text-xs font-medium text-muted-foreground">Top Cached Prompts</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-muted-foreground/50 hover:text-destructive"
                            onClick={() => invalidateMutation.mutate(undefined)}
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Clear All
                        </Button>
                    </div>
                    <div className="divide-y divide-border/20">
                        {analytics.topCachedPrompts.map((entry) => (
                            <div key={entry.id} className="px-4 py-2.5 flex items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs text-foreground truncate">{entry.promptPreview}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className="text-[10px] text-muted-foreground/50 font-mono">{entry.model}</span>
                                        <span className="text-[10px] text-muted-foreground/50 tabular-nums">{entry.hitCount} hits</span>
                                        <span className="text-[10px] text-emerald-500/70 tabular-nums">{formatCost(entry.costSaved)} saved</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!hasData && (
                <div className="rounded-xl border border-border/30 bg-card py-12 text-center">
                    <p className="text-sm font-medium mb-1">No cache activity yet</p>
                    <p className="text-xs text-muted-foreground/60 max-w-[300px] mx-auto">
                        Enable caching in Settings, then make API requests. Cache hits will appear here.
                    </p>
                </div>
            )}
        </div>
    );
}
