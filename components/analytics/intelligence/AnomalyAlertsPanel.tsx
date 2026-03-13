'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnomalyAlert } from '@/app/api/projects/[projectId]/analytics/anomalies/route';

interface AnomalyResponse {
    alerts: AnomalyAlert[];
    summary: {
        total: number;
        critical: number;
        warning: number;
        info: number;
        has_spike: boolean;
    };
    baseline: {
        window_hours: number;
        baseline_days: number;
        sample_count: number;
        computed_at: string;
    };
    insufficient_data: boolean;
}

interface AnomalyAlertsPanelProps {
    projectId: string;
    environment: 'production' | 'test';
}

const ALERT_TYPE_ICONS: Record<AnomalyAlert['alert_type'], React.ReactNode> = {
    cost_spike: <TrendingUp className="h-3.5 w-3.5" />,
    latency_spike: <Activity className="h-3.5 w-3.5" />,
    error_rate_spike: <AlertTriangle className="h-3.5 w-3.5" />,
    request_volume_spike: <TrendingUp className="h-3.5 w-3.5" />,
    request_volume_drop: <TrendingDown className="h-3.5 w-3.5" />,
};

const SEVERITY_STYLES: Record<AnomalyAlert['severity'], string> = {
    critical: 'text-red-500 bg-red-500/10 border-red-500/20',
    warning: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    info: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
};

function formatDeviationChip(deviation: number): string {
    if (deviation < 0) return `${Math.abs(deviation)}% drop`;
    return `+${Math.round(deviation)}%`;
}

export function AnomalyAlertsPanel({ projectId, environment }: AnomalyAlertsPanelProps) {
    const { data, isLoading, isError } = useQuery<AnomalyResponse>({
        queryKey: ['anomalies', projectId, environment],
        queryFn: async () => {
            const res = await fetch(
                `/api/projects/${projectId}/analytics/anomalies?environment=${environment}&detection_hours=1&baseline_days=14`
            );
            if (!res.ok) throw new Error('Failed to fetch anomaly data');
            return res.json();
        },
        staleTime: 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
    });

    return (
        <Card className="border-border/40">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium">Anomaly Detection</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Last hour vs. 14-day baseline</p>
                    </div>
                    {data && !data.insufficient_data && data.summary.total === 0 && (
                        <div className="flex items-center gap-1.5 text-emerald-500">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span className="text-xs">Normal</span>
                        </div>
                    )}
                </div>

                {isLoading && (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-12 w-full" />
                        ))}
                    </div>
                )}

                {isError && (
                    <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5" />
                        Could not load anomaly data.
                    </div>
                )}

                {data?.insufficient_data && (
                    <div className="flex items-start gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                        <Info className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-medium text-amber-500">Not enough history yet</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                Anomaly detection requires at least 7 active hours of traffic.
                                {data.baseline.sample_count > 0 && ` ${data.baseline.sample_count} hours collected so far.`}
                            </p>
                        </div>
                    </div>
                )}

                {data && !data.insufficient_data && data.summary.total === 0 && (
                    <div className="flex items-center gap-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                            All metrics are within normal range. No anomalies detected in the last hour.
                        </p>
                    </div>
                )}

                {data && !data.insufficient_data && data.alerts.length > 0 && (
                    <div className="space-y-2">
                        {data.alerts.map(alert => (
                            <div
                                key={alert.id}
                                className={cn(
                                    'flex items-start gap-3 rounded-md border px-3 py-2.5',
                                    SEVERITY_STYLES[alert.severity]
                                )}
                            >
                                <div className="mt-0.5 shrink-0">
                                    {ALERT_TYPE_ICONS[alert.alert_type]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-medium capitalize">
                                            {alert.severity}
                                        </span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-current/30 bg-current/5">
                                            {formatDeviationChip(alert.deviation_percent)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] mt-0.5 opacity-90 leading-relaxed">
                                        {alert.message}
                                    </p>
                                </div>
                            </div>
                        ))}

                        <p className="text-[10px] text-muted-foreground/50 pt-1">
                            Baseline from {data.baseline.sample_count} hours of historical traffic over {data.baseline.baseline_days} days
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
