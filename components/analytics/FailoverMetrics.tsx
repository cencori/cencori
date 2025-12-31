'use client';

import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface FailoverMetricsProps {
    projectId: string;
    environment: 'production' | 'test';
    timeRange: string;
}

interface FailoverStats {
    total_fallbacks: number;
    fallback_rate: number;
    by_provider: Record<string, {
        original: string;
        fallback: string;
        count: number;
    }[]>;
    top_reasons: Array<{
        reason: string;
        count: number;
    }>;
}

export function FailoverMetrics({ projectId, environment, timeRange }: FailoverMetricsProps) {
    const { data: stats, isLoading } = useQuery<FailoverStats>({
        queryKey: ['failoverStats', projectId, environment, timeRange],
        queryFn: async () => {
            const response = await fetch(
                `/api/projects/${projectId}/analytics/failover?environment=${environment}&time_range=${timeRange}`
            );
            if (!response.ok) throw new Error('Failed to fetch failover stats');
            return response.json();
        },
        staleTime: 60 * 1000,
    });

    if (isLoading) {
        return (
            <Card className="border-border/40">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Failover Metrics</span>
                    </div>
                    <div className="h-20 flex items-center justify-center">
                        <div className="animate-pulse flex space-x-4">
                            <div className="h-8 w-16 bg-secondary rounded"></div>
                            <div className="h-8 w-24 bg-secondary rounded"></div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!stats || stats.total_fallbacks === 0) {
        return (
            <Card className="border-border/40">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <RefreshCw className="h-4 w-4 text-emerald-500" />
                        <span className="text-sm font-medium">Failover Metrics</span>
                    </div>
                    <div className="text-center py-4">
                        <p className="text-2xl font-semibold text-emerald-500">0</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            No fallbacks triggered • All providers stable
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/40">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-amber-500" />
                        <span className="text-sm font-medium">Failover Metrics</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeRange}</span>
                </div>

                {/* Main stats */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-2xl font-semibold">{stats.total_fallbacks}</p>
                        <p className="text-xs text-muted-foreground">Fallbacks triggered</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <p className="text-2xl font-semibold">{stats.fallback_rate.toFixed(1)}%</p>
                            {stats.fallback_rate > 5 ? (
                                <TrendingUp className="h-4 w-4 text-red-500" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-emerald-500" />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">of all requests</p>
                    </div>
                </div>

                {/* Provider flows */}
                {Object.entries(stats.by_provider).length > 0 && (
                    <div className="border-t border-border/40 pt-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                            Failover Routes
                        </p>
                        <div className="space-y-2">
                            {Object.entries(stats.by_provider)
                                .flatMap(([, flows]) => flows)
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 3)
                                .map((flow, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">{flow.original}</span>
                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-foreground">{flow.fallback}</span>
                                        </div>
                                        <span className="text-muted-foreground">{flow.count}x</span>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Top reasons */}
                {stats.top_reasons.length > 0 && (
                    <div className="border-t border-border/40 pt-3 mt-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                            Common Reasons
                        </p>
                        <div className="space-y-1.5">
                            {stats.top_reasons.slice(0, 3).map((reason, i) => (
                                <div key={i} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground truncate max-w-[160px]">
                                        {reason.reason}
                                    </span>
                                    <span className="text-muted-foreground">{reason.count}x</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
