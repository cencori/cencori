'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, ShieldCheck, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface SecurityDashboardProps {
    projectId: string;
}

interface SecurityStats {
    threatScore: number;
    blocked24h: number;
    blocked7d: number;
    pendingReviews: number;
    blockedRate: string;
    severityBreakdown: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
    typeBreakdown: Record<string, number>;
    trendData: { date: string; count: number }[];
    totalIncidents30d: number;
}

function useSecurityStats(projectId: string) {
    return useQuery({
        queryKey: ['securityStats', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/security/stats`);
            if (!response.ok) throw new Error('Failed to fetch security stats');
            const data = await response.json();
            return data.stats as SecurityStats;
        },
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // Refresh every minute
    });
}

function getThreatLevel(score: number): { label: string; color: string; bgColor: string } {
    if (score >= 80) return { label: 'Critical', color: 'text-red-500', bgColor: 'bg-red-500/10' };
    if (score >= 60) return { label: 'High', color: 'text-amber-500', bgColor: 'bg-amber-500/10' };
    if (score >= 40) return { label: 'Medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' };
    if (score >= 20) return { label: 'Low', color: 'text-blue-500', bgColor: 'bg-blue-500/10' };
    return { label: 'Secure', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' };
}

export function SecurityDashboard({ projectId }: SecurityDashboardProps) {
    const { data: stats, isLoading } = useSecurityStats(projectId);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="rounded-lg border border-border/40 bg-card p-4">
                            <Skeleton className="h-3 w-20 mb-2" />
                            <Skeleton className="h-8 w-16" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-[200px]" />
                    <Skeleton className="h-[200px]" />
                </div>
            </div>
        );
    }

    if (!stats) return null;

    const threatLevel = getThreatLevel(stats.threatScore);
    const trend = stats.trendData;
    const lastDayCount = trend[trend.length - 1]?.count || 0;
    const prevDayCount = trend[trend.length - 2]?.count || 0;
    const trendDirection = lastDayCount > prevDayCount ? 'up' : lastDayCount < prevDayCount ? 'down' : 'stable';

    return (
        <div className="space-y-4">
            {/* Main Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Threat Score */}
                <div className={`rounded-lg border border-border/40 ${threatLevel.bgColor} p-4`}>
                    <div className="flex items-center gap-2 mb-1">
                        {stats.threatScore >= 40 ? (
                            <ShieldAlert className={`h-4 w-4 ${threatLevel.color}`} />
                        ) : (
                            <ShieldCheck className={`h-4 w-4 ${threatLevel.color}`} />
                        )}
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Threat Score</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold font-mono ${threatLevel.color}`}>
                            {stats.threatScore}
                        </span>
                        <span className={`text-xs font-medium ${threatLevel.color}`}>
                            {threatLevel.label}
                        </span>
                    </div>
                </div>

                {/* Blocked 24h */}
                <div className="rounded-lg border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Blocked (24h)</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold font-mono">{stats.blocked24h}</span>
                        {trendDirection === 'up' && <TrendingUp className="h-4 w-4 text-red-500" />}
                        {trendDirection === 'down' && <TrendingDown className="h-4 w-4 text-emerald-500" />}
                    </div>
                </div>

                {/* Blocked 7d */}
                <div className="rounded-lg border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Blocked (7d)</span>
                    </div>
                    <span className="text-2xl font-bold font-mono">{stats.blocked7d}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                        ({stats.blockedRate}% of requests)
                    </span>
                </div>

                {/* Pending Reviews */}
                <div className="rounded-lg border border-border/40 bg-card p-4">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending Review</span>
                    </div>
                    <span className={`text-2xl font-bold font-mono ${stats.pendingReviews > 0 ? 'text-amber-500' : ''}`}>
                        {stats.pendingReviews}
                    </span>
                </div>
            </div>

            {/* Breakdown Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Severity Breakdown */}
                <div className="rounded-lg border border-border/40 bg-card p-4">
                    <h3 className="text-xs font-medium mb-3">Severity Breakdown (30d)</h3>
                    <div className="space-y-2">
                        {[
                            { key: 'critical', label: 'Critical', color: 'bg-red-500' },
                            { key: 'high', label: 'High', color: 'bg-amber-500' },
                            { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
                            { key: 'low', label: 'Low', color: 'bg-gray-400' },
                        ].map(({ key, label, color }) => {
                            const count = stats.severityBreakdown[key as keyof typeof stats.severityBreakdown];
                            const percent = stats.totalIncidents30d > 0
                                ? (count / stats.totalIncidents30d) * 100
                                : 0;
                            return (
                                <div key={key} className="flex items-center gap-3">
                                    <span className="text-[10px] text-muted-foreground w-14">{label}</span>
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${color} transition-all`}
                                            style={{ width: `${percent}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-mono w-8 text-right">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Threat Type Breakdown */}
                <div className="rounded-lg border border-border/40 bg-card p-4">
                    <h3 className="text-xs font-medium mb-3">Threat Types (30d)</h3>
                    <div className="space-y-2">
                        {Object.entries(stats.typeBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([type, count]) => {
                                const percent = stats.totalIncidents30d > 0
                                    ? (count / stats.totalIncidents30d) * 100
                                    : 0;
                                return (
                                    <div key={type} className="flex items-center gap-3">
                                        <span className="text-[10px] text-muted-foreground w-28 truncate capitalize">
                                            {type.replace(/_/g, ' ')}
                                        </span>
                                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary/60 transition-all"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-mono w-8 text-right">{count}</span>
                                    </div>
                                );
                            })}
                        {Object.keys(stats.typeBreakdown).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4">No threats detected</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Trend Chart - Simple bar visualization */}
            <div className="rounded-lg border border-border/40 bg-card p-4">
                <h3 className="text-xs font-medium mb-3">Daily Incidents (7d)</h3>
                <div className="flex items-end gap-1 h-20">
                    {stats.trendData.map((day, i) => {
                        const maxCount = Math.max(...stats.trendData.map(d => d.count), 1);
                        const height = (day.count / maxCount) * 100;
                        const isToday = i === stats.trendData.length - 1;
                        return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                <div
                                    className={`w-full rounded-t transition-all ${isToday ? 'bg-primary' : 'bg-primary/40'}`}
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                    title={`${day.date}: ${day.count} incidents`}
                                />
                                <span className="text-[8px] text-muted-foreground">
                                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
