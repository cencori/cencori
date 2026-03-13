'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, DollarSign, Clock, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModelStat {
    model: string;
    provider: string;
    request_count: number;
    total_cost_usd: number;
    avg_cost_per_token: number;
    avg_latency_ms: number;
    p95_latency_ms: number;
    success_rate: number;
    avg_completion_ratio: number;
    total_tokens: number;
    cost_score: number;
    speed_score: number;
    quality_score: number;
    efficiency_score: number;
    efficiency_rank: number;
    recommendation: string;
    potential_savings_usd: number | null;
}

interface EfficiencySummary {
    top_model: string;
    top_provider: string;
    cheapest_model: string;
    fastest_model: string;
    total_cost_analyzed: number;
    potential_savings_usd: number;
    analysis_period_days: number;
    total_requests_analyzed: number;
}

interface EfficiencyResponse {
    models: ModelStat[];
    summary: EfficiencySummary | null;
    insufficient_data: boolean;
    total_requests_analyzed?: number;
}

interface ModelEfficiencyPanelProps {
    projectId: string;
    environment: 'production' | 'test';
}

const RECOMMENDATION_STYLES: Record<string, string> = {
    'Best overall': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    'Cheapest per token': 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    'Fastest response': 'text-purple-500 bg-purple-500/10 border-purple-500/20',
    'Highest quality': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
};

function ScoreBar({ score, color }: { score: number; color: string }) {
    return (
        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
                className={cn('h-full rounded-full transition-all', color)}
                style={{ width: `${Math.round(score * 100)}%` }}
            />
        </div>
    );
}

function formatCostPerToken(v: number): string {
    if (v === 0) return '$0';
    if (v < 0.000001) return `$${(v * 1e6).toFixed(2)}µ/tok`;
    if (v < 0.001) return `$${(v * 1000).toFixed(3)}m/tok`;
    return `$${v.toFixed(6)}/tok`;
}

function formatCost(v: number): string {
    if (v < 0.01) return `$${v.toFixed(4)}`;
    if (v < 1) return `$${v.toFixed(3)}`;
    return `$${v.toFixed(2)}`;
}

export function ModelEfficiencyPanel({ projectId, environment }: ModelEfficiencyPanelProps) {
    const [timeRange, setTimeRange] = useState('30d');

    const { data, isLoading, isError } = useQuery<EfficiencyResponse>({
        queryKey: ['modelEfficiency', projectId, environment, timeRange],
        queryFn: async () => {
            const res = await fetch(
                `/api/projects/${projectId}/analytics/model-efficiency?environment=${environment}&time_range=${timeRange}&min_requests=1`
            );
            if (!res.ok) throw new Error('Failed to fetch model efficiency data');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    return (
        <Card className="border-border/40">
            <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <p className="text-sm font-medium">Model Efficiency</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Ranked by cost, speed, and quality for your actual workload
                        </p>
                    </div>
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="w-[120px] h-7 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7d" className="text-xs">7 days</SelectItem>
                            <SelectItem value="30d" className="text-xs">30 days</SelectItem>
                            <SelectItem value="90d" className="text-xs">90 days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {isLoading && (
                    <div className="space-y-2">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                )}

                {isError && (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                        Could not load model efficiency data.
                    </p>
                )}

                {data?.insufficient_data && (
                    <div className="text-center py-6">
                        <Zap className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs font-medium text-muted-foreground">Not enough data yet</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1 max-w-[260px] mx-auto">
                            Make at least one AI request to see model rankings.
                            {data.total_requests_analyzed != null && data.total_requests_analyzed > 0 &&
                                ` ${data.total_requests_analyzed} requests analyzed so far.`
                            }
                        </p>
                    </div>
                )}

                {data && !data.insufficient_data && data.summary && data.models.length > 0 && (
                    <>
                        {/* Summary strip */}
                        <div className="flex items-center gap-4 mb-4 p-3 rounded-md bg-secondary/50 flex-wrap">
                            <div className="flex items-center gap-1.5">
                                <Award className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-[11px] text-muted-foreground">Best overall:</span>
                                <span className="text-[11px] font-medium">{data.summary.top_model}</span>
                            </div>
                            {data.summary.potential_savings_usd > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-[11px] text-muted-foreground">Potential savings:</span>
                                    <span className="text-[11px] font-medium text-blue-500">
                                        {formatCost(data.summary.potential_savings_usd)}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 ml-auto">
                                <span className="text-[10px] text-muted-foreground/60">
                                    {data.summary.total_requests_analyzed.toLocaleString()} requests · {data.summary.analysis_period_days}d
                                </span>
                            </div>
                        </div>

                        {/* Column headers */}
                        <div className="grid grid-cols-[1.5rem_1fr_6rem_6rem_6rem_6rem] gap-x-3 items-center mb-2 px-1">
                            <span />
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Model</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">Cost/tok</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">Latency</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">Success</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">Score</span>
                        </div>

                        {/* Model rows */}
                        <div className="space-y-1">
                            {data.models.map(m => (
                                <div
                                    key={`${m.model}||${m.provider}`}
                                    className={cn(
                                        'grid grid-cols-[1.5rem_1fr_6rem_6rem_6rem_6rem] gap-x-3 items-center rounded-md px-1 py-2',
                                        m.efficiency_rank === 1 ? 'bg-emerald-500/5' : 'hover:bg-secondary/40'
                                    )}
                                >
                                    {/* Rank */}
                                    <span className={cn(
                                        'text-[11px] font-mono font-medium w-5 text-center',
                                        m.efficiency_rank === 1 ? 'text-emerald-500' : 'text-muted-foreground/50'
                                    )}>
                                        {m.efficiency_rank}
                                    </span>

                                    {/* Model name + tags */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-xs font-medium truncate">{m.model}</span>
                                            {m.recommendation && (
                                                <span className={cn(
                                                    'text-[9px] font-medium px-1.5 py-0.5 rounded border shrink-0',
                                                    RECOMMENDATION_STYLES[m.recommendation] || 'text-muted-foreground bg-secondary border-border/40'
                                                )}>
                                                    {m.recommendation}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] text-muted-foreground/60">{m.provider}</span>
                                            <span className="text-[10px] text-muted-foreground/40">·</span>
                                            <span className="text-[10px] text-muted-foreground/60">
                                                {m.request_count.toLocaleString()} req
                                            </span>
                                            {m.potential_savings_usd != null && m.potential_savings_usd > 0 && (
                                                <>
                                                    <span className="text-[10px] text-muted-foreground/40">·</span>
                                                    <span className="text-[10px] text-blue-500/70">
                                                        save {formatCost(m.potential_savings_usd)} vs #1
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cost per token */}
                                    <div className="w-full">
                                        <p className="text-[11px] font-mono text-muted-foreground text-right truncate">
                                            {formatCostPerToken(m.avg_cost_per_token)}
                                        </p>
                                        <div className="flex justify-end mt-0.5">
                                            <ScoreBar score={m.cost_score} color="bg-blue-500" />
                                        </div>
                                    </div>

                                    {/* Latency */}
                                    <div className="w-full">
                                        <p className="text-[11px] font-mono text-muted-foreground text-right">
                                            {m.avg_latency_ms}ms
                                        </p>
                                        <div className="flex justify-end mt-0.5">
                                            <ScoreBar score={m.speed_score} color="bg-purple-500" />
                                        </div>
                                    </div>

                                    {/* Success rate */}
                                    <div className="w-full">
                                        <p className={cn(
                                            'text-[11px] font-mono text-right',
                                            m.success_rate >= 0.99 ? 'text-emerald-500' :
                                            m.success_rate >= 0.95 ? 'text-muted-foreground' : 'text-amber-500'
                                        )}>
                                            {(m.success_rate * 100).toFixed(1)}%
                                        </p>
                                        <div className="flex justify-end mt-0.5">
                                            <ScoreBar score={m.quality_score} color="bg-amber-500" />
                                        </div>
                                    </div>

                                    {/* Efficiency score */}
                                    <div className="w-full">
                                        <p className={cn(
                                            'text-[11px] font-mono font-medium text-right',
                                            m.efficiency_rank === 1 ? 'text-emerald-500' : 'text-muted-foreground'
                                        )}>
                                            {Math.round(m.efficiency_score * 100)}
                                        </p>
                                        <div className="flex justify-end mt-0.5">
                                            <ScoreBar score={m.efficiency_score} color="bg-emerald-500" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Score legend */}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                            <p className="text-[10px] text-muted-foreground/50">Score bars:</p>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1.5 rounded-full bg-blue-500" />
                                <span className="text-[10px] text-muted-foreground/50">Cost</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1.5 rounded-full bg-purple-500" />
                                <span className="text-[10px] text-muted-foreground/50">Speed</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1.5 rounded-full bg-amber-500" />
                                <span className="text-[10px] text-muted-foreground/50">Quality</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] text-muted-foreground/50">Overall</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
