'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import {
    MetricCard,
    MetricCardFrame,
    type MetricCardConfig,
} from '@/components/dashboard/project-overview/ProjectOverviewDashboard';
import { BarBreakdownChart } from '@/components/dashboard/project-overview/ModelBreakdown';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Platform-wide charts in the console's usage style: the same cards, colours
// and bar charts as a project's AI Gateway overview, summed over every project.

const PERIODS = [
    { value: '1h', label: 'Last hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
    { value: 'all', label: 'All time' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

interface SeriesPoint {
    t: number;
    requests: number;
    successful: number;
    errors: number;
    filtered: number;
    cost: number;
    prompt_tokens: number;
    completion_tokens: number;
    p50: number;
    p95: number;
    p99: number;
    signups: number;
    orgs: number;
}

interface SeriesResponse {
    period: Period;
    bucket: string;
    series: SeriesPoint[];
    model_usage: Record<string, number>;
    cost_by_provider: Record<string, number>;
    latency: { p50: number; p95: number; p99: number };
    users_total: number;
    orgs_total: number;
}

const BAR_LIMIT = 6;
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function formatUsd(value: number): string {
    if (!Number.isFinite(value) || value === 0) return '$0.00';
    if (Math.abs(value) < 0.01) return `$${value.toFixed(4)}`;
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsdAxis(value: number): string {
    if (value === 0) return '$0';
    if (value >= 1000) return `$${compact.format(value)}`;
    return `$${Number(value.toPrecision(2))}`;
}

function formatLatency(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '0ms';
    return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s` : `${Math.round(ms)}ms`;
}

function bucketLabel(t: number, bucket: string): string {
    const date = new Date(t);
    return bucket.includes('minute') || bucket.includes('hour')
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function topEntries(record: Record<string, number>, limit: number) {
    const sorted = Object.entries(record)
        .map(([name, value]) => [name, Number(value)] as const)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a);
    const top = sorted.slice(0, limit).map(([name, value]) => ({ name, value }));
    const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { name: 'Other', value: rest }] : top;
}

function sum(points: SeriesPoint[], key: keyof SeriesPoint): number {
    return points.reduce((total, point) => total + Number(point[key] ?? 0), 0);
}

export default function InternalOverviewPage() {
    const [period, setPeriod] = useState<Period>('7d');
    const reduceMotion = useReducedMotion();

    const { data, isLoading, isError, error, refetch } = useQuery<SeriesResponse>({
        queryKey: ['internal-platform-series', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/series?period=${period}`);
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? 'query_failed');
            return body as SeriesResponse;
        },
        staleTime: 30_000,
        refetchInterval: 60_000,
        placeholderData: (previous) => previous,
    });

    const series = useMemo(() => data?.series ?? [], [data?.series]);
    const chartData = useMemo(
        () => series.map((point) => ({
            date: bucketLabel(point.t, data?.bucket ?? '1 day'),
            count: Number(point.requests),
            successRate: point.requests > 0 ? (point.successful / point.requests) * 100 : 0,
            cost: Number(point.cost),
            promptTokens: Number(point.prompt_tokens),
            completionTokens: Number(point.completion_tokens),
            p50: Number(point.p50),
            p95: Number(point.p95),
            p99: Number(point.p99),
            error: Number(point.errors),
            filtered: Number(point.filtered),
            signups: Number(point.signups),
            orgs: Number(point.orgs),
        })),
        [series, data?.bucket],
    );

    const loading = isLoading && !data;
    const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '7 days';
    const totalRequests = sum(series, 'requests');
    const successful = sum(series, 'successful');
    const errors = sum(series, 'errors');
    const filtered = sum(series, 'filtered');
    const totalCost = sum(series, 'cost');
    const promptTokens = sum(series, 'prompt_tokens');
    const completionTokens = sum(series, 'completion_tokens');
    const signups = sum(series, 'signups');
    const newOrgs = sum(series, 'orgs');
    const successRate = totalRequests > 0 ? (successful / totalRequests) * 100 : 0;
    const errorRate = totalRequests > 0 ? ((errors + filtered) / totalRequests) * 100 : 0;
    const hasRequests = totalRequests > 0;

    const modelRows = useMemo(() => topEntries(data?.model_usage ?? {}, BAR_LIMIT), [data?.model_usage]);
    const providerRows = useMemo(() => topEntries(data?.cost_by_provider ?? {}, BAR_LIMIT), [data?.cost_by_provider]);
    const modelCount = Object.keys(data?.model_usage ?? {}).length;
    const providerCount = providerRows.filter((row) => row.name !== 'Other').length;
    const providerSpend = Object.values(data?.cost_by_provider ?? {}).reduce((total, value) => total + Number(value), 0);

    const metrics: MetricCardConfig[] = [
        {
            title: 'Requests',
            detail: `${successful.toLocaleString()} successful`,
            series: [{ key: 'count', label: 'Requests', color: '#f59e0b', value: totalRequests.toLocaleString() }],
            formatValue: (value) => value.toLocaleString(),
            formatAxis: (value) => compact.format(value),
        },
        {
            title: 'Success rate',
            detail: `${errors.toLocaleString()} errors`,
            series: [{ key: 'successRate', label: 'Success rate', color: '#22c55e', value: `${successRate.toFixed(1)}%` }],
            formatValue: (value) => `${value.toFixed(1)}%`,
            formatAxis: (value) => `${value.toFixed(0)}%`,
            domainMax: 100,
        },
        {
            title: 'Spend',
            detail: `${periodLabel.toLowerCase()} total`,
            series: [{ key: 'cost', label: 'Spend', color: '#f97316', value: formatUsd(totalCost) }],
            formatValue: formatUsd,
            formatAxis: formatUsdAxis,
        },
        {
            title: 'Tokens',
            detail: compact.format(promptTokens + completionTokens),
            series: [
                { key: 'promptTokens', label: 'Input', color: '#3b82f6', value: compact.format(promptTokens) },
                { key: 'completionTokens', label: 'Output', color: '#a855f7', value: compact.format(completionTokens) },
            ],
            formatValue: (value) => compact.format(value),
            formatAxis: (value) => compact.format(value),
        },
    ];

    const latencyConfig: MetricCardConfig = {
        title: 'Latency',
        detail: formatLatency(data?.latency?.p50 ?? 0),
        series: [
            { key: 'p50', label: 'P50', color: '#22c55e', value: formatLatency(data?.latency?.p50 ?? 0) },
            { key: 'p95', label: 'P95', color: '#f59e0b', value: formatLatency(data?.latency?.p95 ?? 0) },
            { key: 'p99', label: 'P99', color: '#ef4444', value: formatLatency(data?.latency?.p99 ?? 0) },
        ],
        formatValue: formatLatency,
        formatAxis: formatLatency,
    };
    const errorsConfig: MetricCardConfig = {
        title: 'Errors',
        detail: `${errorRate.toFixed(1)}%`,
        series: [
            { key: 'error', label: 'Errors', color: '#ef4444', value: errors.toLocaleString() },
            { key: 'filtered', label: 'Filtered', color: '#f59e0b', value: filtered.toLocaleString() },
        ],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const modelConfig: MetricCardConfig = {
        title: 'Model usage',
        detail: `${modelCount} ${modelCount === 1 ? 'model' : 'models'}`,
        series: [{ key: 'value', label: 'Requests', color: '#8b5cf6', value: totalRequests.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const providerConfig: MetricCardConfig = {
        title: 'Cost by provider',
        detail: `${providerCount} ${providerCount === 1 ? 'provider' : 'providers'}`,
        series: [{ key: 'value', label: 'Spend', color: '#f97316', value: formatUsd(providerSpend) }],
        formatValue: formatUsd,
        formatAxis: formatUsdAxis,
    };
    const signupsConfig: MetricCardConfig = {
        title: 'Signups',
        detail: `${(data?.users_total ?? 0).toLocaleString()} users total`,
        series: [{ key: 'signups', label: 'Signups', color: '#06b6d4', value: signups.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const orgsConfig: MetricCardConfig = {
        title: 'New organizations',
        detail: `${(data?.orgs_total ?? 0).toLocaleString()} total`,
        series: [{ key: 'orgs', label: 'Organizations', color: '#ec4899', value: newOrgs.toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };

    const errorMessage = isError
        ? (error as Error)?.message === 'not_installed'
            ? 'This database doesn’t have the platform charts function yet (database/brimble/0600_analytics_platform_series.sql). It’s applied on the next deploy.'
            : 'We couldn’t load platform usage.'
        : null;

    return (
        <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mb-4 flex items-center justify-between gap-4">
                <h1 className="text-sm font-medium tracking-[-0.02em]">Platform usage</h1>
                <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                    <SelectTrigger
                        aria-label="Select usage period"
                        className="h-8 w-[8.5rem] rounded-md border-border/45 bg-muted/20 px-3 text-[11px] shadow-none"
                    >
                        <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent align="end">
                        {PERIODS.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="text-xs">
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {errorMessage && !data && (
                <div className="mb-3 flex items-center justify-between gap-4 rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px]">
                    <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
                    <button
                        type="button"
                        onClick={() => void refetch()}
                        className="shrink-0 font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
                    >
                        Try again
                    </button>
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
                {metrics.map((metric) => (
                    <MetricCard
                        key={metric.title}
                        config={metric}
                        data={chartData}
                        loading={loading}
                        hasData={hasRequests}
                        reduceMotion={reduceMotion}
                    />
                ))}

                <MetricCardFrame config={modelConfig} loading={loading}>
                    <BarBreakdownChart
                        rows={modelRows}
                        color="#8b5cf6"
                        label="Requests"
                        formatValue={(value) => compact.format(value)}
                        reduceMotion={reduceMotion}
                        labelKind="model"
                    />
                </MetricCardFrame>
                <MetricCardFrame config={providerConfig} loading={loading}>
                    <BarBreakdownChart
                        rows={providerRows}
                        color="#f97316"
                        label="Spend"
                        formatValue={formatUsd}
                        reduceMotion={reduceMotion}
                        labelKind="provider"
                    />
                </MetricCardFrame>

                <MetricCard
                    config={latencyConfig}
                    data={chartData}
                    loading={loading}
                    hasData={series.some((point) => point.p50 > 0)}
                    reduceMotion={reduceMotion}
                />
                <MetricCard
                    config={errorsConfig}
                    data={chartData}
                    loading={loading}
                    hasData={hasRequests}
                    reduceMotion={reduceMotion}
                />

                <MetricCard
                    config={signupsConfig}
                    data={chartData}
                    loading={loading}
                    hasData={signups > 0}
                    reduceMotion={reduceMotion}
                />
                <MetricCard
                    config={orgsConfig}
                    data={chartData}
                    loading={loading}
                    hasData={newOrgs > 0}
                    reduceMotion={reduceMotion}
                />
            </div>
        </section>
    );
}
