"use client";

import React, { use } from 'react';
import { useUpgrade } from '@/components/billing/UpgradeProvider';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from "@/components/ui/skeleton";
import { cn as clsx } from "@/lib/utils";
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from '@/components/ui/toast';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Lock } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useCostFormat } from "@/hooks/useDisplayCurrency";
import {
    MetricCard,
    MetricCardFrame,
    type MetricCardConfig,
} from "@/components/dashboard/project-overview/ProjectOverviewDashboard";
import { BarBreakdownChart } from "@/components/dashboard/project-overview/ModelBreakdown";

interface Organization {
    id: string;
    name: string;
    subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
    monthly_requests_used: number;
}

interface UsageStats {
    total_requests: number;
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    total_cost: number;
    avg_latency: number;
    success_rate: number;
    model_usage: Record<string, number>;
    provider_usage: Record<string, number>;
    daily_requests: Array<{
        date: string;
        count: number;
        input_tokens: number;
        output_tokens: number;
    }>;
}

// One UTC hour from org_usage_stats; re-bucketed into the viewer's local hours/days.
type UsageHour = {
    hour: string;
    count: number;
    input_tokens: number;
    output_tokens: number;
};

type UsageRollup = Omit<UsageStats, 'success_rate' | 'daily_requests'> & {
    /** total_cost plus the provider cost of BYOK calls (0500_org_usage_total_spend.sql). */
    total_spend?: number;
    successful_requests: number;
    hourly: UsageHour[];
};

function buildRequestActivity(hours: UsageHour[], timeRange: string) {
    const isHourly = timeRange === '24h';
    const bucketCount = isHourly ? 24 : timeRange === '30d' ? 30 : 7;
    const stepMs = isHourly ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const end = new Date();

    if (isHourly) {
        end.setMinutes(0, 0, 0);
    } else {
        end.setHours(0, 0, 0, 0);
    }

    const startMs = end.getTime() - ((bucketCount - 1) * stepMs);
    const buckets = new Map<number, { count: number; inputTokens: number; outputTokens: number }>();

    for (const hour of hours) {
        const bucket = new Date(hour.hour);
        if (Number.isNaN(bucket.getTime())) continue;

        if (isHourly) {
            bucket.setMinutes(0, 0, 0);
        } else {
            bucket.setHours(0, 0, 0, 0);
        }

        const bucketTime = bucket.getTime();
        if (bucketTime < startMs || bucketTime > end.getTime()) continue;
        const current = buckets.get(bucketTime) || { count: 0, inputTokens: 0, outputTokens: 0 };
        const inputTokens = Number(hour.input_tokens || 0);
        const outputTokens = Number(hour.output_tokens || 0);

        buckets.set(bucketTime, {
            count: current.count + Number(hour.count || 0),
            inputTokens: current.inputTokens + (Number.isFinite(inputTokens) ? inputTokens : 0),
            outputTokens: current.outputTokens + (Number.isFinite(outputTokens) ? outputTokens : 0),
        });
    }

    return Array.from({ length: bucketCount }, (_, index) => {
        const bucket = new Date(startMs + (index * stepMs));
        const values = buckets.get(bucket.getTime());
        return {
            date: isHourly
                ? bucket.toLocaleTimeString('en-US', { hour: 'numeric' })
                : bucket.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: values?.count || 0,
            input_tokens: values?.inputTokens || 0,
            output_tokens: values?.outputTokens || 0,
        };
    });
}

function emptyUsageStats(timeRange: string): UsageStats {
    return {
        total_requests: 0,
        total_tokens: 0,
        input_tokens: 0,
        output_tokens: 0,
        total_cost: 0,
        avg_latency: 0,
        success_rate: 0,
        model_usage: {},
        provider_usage: {},
        daily_requests: buildRequestActivity([], timeRange),
    };
}

const PERIODS = [
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
] as const;
const PRO_ONLY_PERIODS = new Set(['30d']);
// The console page frame shared with the AI Gateway and Memory pages.
const PAGE_CLASS = 'mx-auto w-full max-w-[1180px] px-0 pb-6 pt-0 sm:px-6 sm:pt-4 lg:px-8 lg:pt-6';
const BAR_LIMIT = 6;
const REQUEST_COLOR = '#f59e0b';
const INPUT_COLOR = '#3b82f6';
const OUTPUT_COLOR = '#a855f7';
const MODEL_COLOR = '#8b5cf6';
const PROVIDER_COLOR = '#f97316';

const compactNumber = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function formatLatency(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '0ms';
    return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s` : `${Math.round(ms)}ms`;
}

/** Top entries by value, with the remainder rolled into "Other". */
function topEntries(record: Record<string, number>, limit: number) {
    // Requests that failed before routing are stored with an empty model/provider.
    const merged: Record<string, number> = {};
    for (const [name, value] of Object.entries(record)) {
        const key = name.trim() && name !== 'unknown' ? name : 'Unknown';
        merged[key] = (merged[key] || 0) + value;
    }
    const sorted = Object.entries(merged)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a);
    const top = sorted.slice(0, limit).map(([name, value]) => ({ name, value }));
    const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { name: 'Other', value: rest }] : top;
}

function SummaryStat({ label, value, detail, loading, className }: {
    label: string;
    value: string;
    detail: string;
    loading: boolean;
    className?: string;
}) {
    return (
        <div className={clsx('min-w-0 border-border/40 px-5 py-4', className)}>
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
                <>
                    <Skeleton className="mt-2 h-6 w-24 rounded-sm" />
                    <Skeleton className="mt-2 h-3 w-28 rounded-sm" />
                </>
            ) : (
                <>
                    <p className="mt-1.5 truncate font-mono text-xl font-medium leading-tight tracking-[-0.03em] tabular-nums">{value}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
                </>
            )}
        </div>
    );
}

interface PageProps {
    params: Promise<{ orgSlug: string }>;
}

// Hook to fetch org data
function useOrganization(orgSlug: string) {
    return useQuery({
        queryKey: ["organizationUsage", orgSlug],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, subscription_tier, monthly_requests_used')
                .eq('slug', orgSlug)
                .single();

            if (error || !data) throw new Error("Organization not found");

            const subscriptionTier: Organization['subscription_tier'] = (
                data.subscription_tier === 'pro'
                || data.subscription_tier === 'team'
                || data.subscription_tier === 'enterprise'
            ) ? data.subscription_tier : 'free';
            const requestsUsed = Number(data.monthly_requests_used ?? 0);

            const organization: Organization = {
                id: data.id,
                name: data.name,
                subscription_tier: subscriptionTier,
                monthly_requests_used: Number.isFinite(requestsUsed) && requestsUsed >= 0
                    ? requestsUsed
                    : 0,
            };

            return organization;
        },
        staleTime: 30 * 1000,
    });
}

// Hook to fetch usage stats across all org projects. Aggregated server-side:
// ai_requests rows carry full request payloads, so pulling them here timed out.
function useUsageStats(orgSlug: string, timeRange: string) {
    return useQuery({
        queryKey: ["usageStats", orgSlug, timeRange],
        queryFn: async () => {
            const response = await fetch(`/api/organizations/${orgSlug}/usage?range=${timeRange}`);
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to load usage');
            }

            const { rollup } = await response.json() as { rollup: UsageRollup | null };
            if (!rollup || rollup.total_requests === 0) {
                return emptyUsageStats(timeRange);
            }

            return {
                total_requests: Number(rollup.total_requests),
                total_tokens: Number(rollup.total_tokens),
                input_tokens: Number(rollup.input_tokens),
                output_tokens: Number(rollup.output_tokens),
                // Same figure as the console home's spend: falls back to total_cost
                // until the total_spend migration is applied.
                total_cost: Number(rollup.total_spend ?? rollup.total_cost),
                avg_latency: Number(rollup.avg_latency),
                success_rate: (Number(rollup.successful_requests) / Number(rollup.total_requests)) * 100,
                model_usage: rollup.model_usage,
                provider_usage: rollup.provider_usage,
                daily_requests: buildRequestActivity(rollup.hourly, timeRange),
            } as UsageStats;
        },
        staleTime: 60 * 1000,
        placeholderData: (previous) => previous,
    });
}

export default function UsagePage({ params }: PageProps) {
    const { orgSlug } = use(params);
    const upgrade = useUpgrade();
    const [timeRange, setTimeRange] = React.useState('7d');
    const [isExporting, setIsExporting] = React.useState(false);

    const handleExport = async (format: 'csv' | 'json') => {
        setIsExporting(true);
        try {
            const now = new Date();
            let from: string | undefined;
            switch (timeRange) {
                case '24h':
                    from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
                    break;
                case '7d':
                    from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                    break;
                case '30d':
                    from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
                    break;
            }

            let url = `/api/organizations/${orgSlug}/export?format=${format}`;
            if (from) url += `&from=${from}`;

            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Export failed');
            }

            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `usage-export.${format}`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            toast.success(`Usage data exported as ${format.toUpperCase()}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const { data: org, isLoading: orgLoading } = useOrganization(orgSlug);
    const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useUsageStats(orgSlug, timeRange);
    const { formatCost } = useCostFormat();
    const reduceMotion = useReducedMotion();

    const isLoading = orgLoading || statsLoading;

    const monthlyRequestsUsed = org && Number.isFinite(org.monthly_requests_used) && org.monthly_requests_used >= 0
        ? org.monthly_requests_used
        : 0;

    const totalRequests = stats?.total_requests || 0;
    const totalInputTokens = stats?.input_tokens || 0;
    const totalOutputTokens = stats?.output_tokens || 0;
    const totalTokens = stats?.total_tokens || totalInputTokens + totalOutputTokens;
    const totalCost = stats?.total_cost || 0;
    const successRate = stats?.success_rate || 0;
    const averageLatency = stats?.avg_latency || 0;
    const successfulRequests = Math.round(totalRequests * (successRate / 100));
    const failedRequests = Math.max(totalRequests - successfulRequests, 0);
    const activity = stats?.daily_requests || buildRequestActivity([], timeRange);
    const hasActivity = activity.some((point) => point.count > 0);
    const modelRows = topEntries(stats?.model_usage || {}, BAR_LIMIT);
    const providerRows = topEntries(stats?.provider_usage || {}, BAR_LIMIT);
    const modelCount = Object.keys(stats?.model_usage || {}).length;
    const providerCount = Object.values(stats?.provider_usage || {}).filter((value) => value > 0).length;
    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1, 1);
    nextReset.setHours(0, 0, 0, 0);
    const periodLabel = PERIODS.find((option) => option.value === timeRange)?.label ?? '7 days';
    const planLabel = org?.subscription_tier
        ? `${org.subscription_tier.charAt(0).toUpperCase()}${org.subscription_tier.slice(1)}`
        : 'Free';

    const periodLocked = (value: string) => upgrade.canUpgrade && PRO_ONLY_PERIODS.has(value);
    const choosePeriod = (value: string) => {
        if (periodLocked(value)) upgrade.openUpgrade("history");
        else setTimeRange(value);
    };

    const requestsConfig: MetricCardConfig = {
        title: 'Requests',
        detail: `${successfulRequests.toLocaleString()} successful`,
        series: [{ key: 'count', label: 'Requests', color: REQUEST_COLOR, value: totalRequests.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compactNumber.format(value),
    };
    const tokensConfig: MetricCardConfig = {
        title: 'Tokens',
        detail: compactNumber.format(totalTokens),
        series: [
            { key: 'input_tokens', label: 'Input', color: INPUT_COLOR, value: compactNumber.format(totalInputTokens) },
            { key: 'output_tokens', label: 'Output', color: OUTPUT_COLOR, value: compactNumber.format(totalOutputTokens) },
        ],
        formatValue: (value) => compactNumber.format(value),
        formatAxis: (value) => compactNumber.format(value),
    };
    const modelConfig: MetricCardConfig = {
        title: 'Model usage',
        detail: `${modelCount} ${modelCount === 1 ? 'model' : 'models'}`,
        series: [{ key: 'value', label: 'Requests', color: MODEL_COLOR, value: totalRequests.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compactNumber.format(value),
    };
    const providerConfig: MetricCardConfig = {
        title: 'Requests by provider',
        detail: `${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`,
        series: [{ key: 'value', label: 'Requests', color: PROVIDER_COLOR, value: totalRequests.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compactNumber.format(value),
    };

    if (!orgLoading && !org) {
        return (
            <main className={PAGE_CLASS}>
                <p className="py-16 text-center text-sm text-muted-foreground">Organization not found.</p>
            </main>
        );
    }

    return (
        <main className={PAGE_CLASS}>
            <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-base font-medium">Usage</h1>
                    <p className="mt-0.5 max-w-[60ch] text-xs text-muted-foreground">
                        Requests, tokens, and spend across every project in {org?.name ?? 'your organization'}.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-md border-border/45 bg-muted/20 px-3 text-[11px] shadow-none"
                                disabled={isExporting}
                            >
                                {isExporting && <Spinner className="mr-1 size-3 animate-spin" />}
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-xs" onClick={() => handleExport('csv')}>Export CSV</DropdownMenuItem>
                            <DropdownMenuItem className="text-xs" onClick={() => handleExport('json')}>Export JSON</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Select value={timeRange} onValueChange={choosePeriod} onOpenChange={(open) => { if (open) upgrade.preloadUpgrade(); }}>
                        <SelectTrigger
                            aria-label="Select usage period"
                            className="h-8 w-[8.5rem] rounded-md border-border/45 bg-muted/20 px-3 text-[11px] shadow-none"
                        >
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {PERIODS.map((option) => (
                                <SelectItem key={option.value} value={option.value} className="text-xs">
                                    <span className="flex w-full items-center gap-2">
                                        {option.label}
                                        {periodLocked(option.value) && <Lock className="ml-auto h-3 w-3 text-muted-foreground" aria-label="Pro" />}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {statsError && (
                <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px]">
                    <p className="text-red-600 dark:text-red-400">
                        We couldn&apos;t load usage for this period. The figures below are not your real usage.
                    </p>
                    <button
                        type="button"
                        onClick={() => void refetchStats()}
                        className="shrink-0 font-medium underline decoration-border underline-offset-4 hover:decoration-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                        Try again
                    </button>
                </div>
            )}

            <section
                aria-label="Usage summary"
                className="mb-4 grid overflow-hidden rounded-lg border border-border/40 bg-muted/30 sm:grid-cols-2 lg:grid-cols-4"
            >
                <SummaryStat
                    loading={isLoading}
                    label="This month"
                    value={monthlyRequestsUsed.toLocaleString()}
                    detail={`${planLabel} plan · resets ${nextReset.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                />
                <SummaryStat
                    loading={isLoading}
                    label="Success rate"
                    value={`${successRate.toFixed(1)}%`}
                    detail={`${failedRequests.toLocaleString()} failed`}
                    className="border-t sm:border-l sm:border-t-0"
                />
                <SummaryStat
                    loading={isLoading}
                    label="Spend"
                    value={formatCost(totalCost)}
                    detail={totalRequests ? `${formatCost(totalCost / totalRequests)} / request` : `${periodLabel.toLowerCase()} total`}
                    className="border-t lg:border-l lg:border-t-0"
                />
                <SummaryStat
                    loading={isLoading}
                    label="Latency"
                    value={formatLatency(averageLatency)}
                    detail="mean response time"
                    className="border-t sm:border-l lg:border-t-0"
                />
            </section>

            <section aria-label="Usage charts" className="grid gap-4 lg:grid-cols-2">
                <MetricCard
                    config={requestsConfig}
                    data={activity}
                    loading={isLoading}
                    hasData={hasActivity}
                    reduceMotion={reduceMotion}
                />
                <MetricCard
                    config={tokensConfig}
                    data={activity}
                    loading={isLoading}
                    hasData={hasActivity}
                    reduceMotion={reduceMotion}
                />
                <MetricCardFrame config={modelConfig} loading={isLoading}>
                    <BarBreakdownChart
                        rows={modelRows}
                        color={MODEL_COLOR}
                        label="Requests"
                        formatValue={(value) => compactNumber.format(value)}
                        reduceMotion={reduceMotion}
                        labelKind="model"
                    />
                </MetricCardFrame>
                <MetricCardFrame config={providerConfig} loading={isLoading}>
                    <BarBreakdownChart
                        rows={providerRows}
                        color={PROVIDER_COLOR}
                        label="Requests"
                        formatValue={(value) => compactNumber.format(value)}
                        reduceMotion={reduceMotion}
                        labelKind="provider"
                    />
                </MetricCardFrame>
            </section>

            <p className="mt-4 text-[11px] text-muted-foreground">
                Covers every project and environment in {org?.name ?? 'your organization'}.
            </p>
        </main>
    );
}
