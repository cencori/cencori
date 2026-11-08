'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useReducedMotion } from 'framer-motion';
import {
    MetricCard,
    MetricCardFrame,
    type MetricCardConfig,
} from '@/components/dashboard/project-overview/ProjectOverviewDashboard';
import { BarBreakdownChart } from '@/components/dashboard/project-overview/ModelBreakdown';
import { StatCard } from '@/internal/analytics/components/StatCard';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Cencori's own revenue, from the payments ledger the Bachs and CoinCircuit
// webhooks write (database/brimble/0700_payments_ledger.sql). Naira payments
// count at the rate credit packs were sold at when they were paid.

const PERIODS = [
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
    { value: 'all', label: 'All time' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

const PRODUCT_LABELS: Record<string, string> = {
    credits_topup: 'Credit packs',
    credits_topup_ngn: 'Naira top-ups',
    subscription: 'Subscriptions',
    business_pass: 'Business pass',
    basecode_subscription: 'Tensor subscription',
    basecode_prepaid: 'Tensor prepaid',
    other: 'Other',
};

interface RevenuePoint {
    t: number;
    payments: number;
    revenue: number;
    credits: number;
    subscriptions: number;
    other: number;
    ngn_usd: number;
    usd: number;
    paying_orgs: number;
}

interface RevenueResponse {
    bucket: string;
    series: RevenuePoint[];
    totals: { payments: number; revenue: number; fees: number; ngn_paid: number; usd_paid: number; paying_orgs: number };
    by_product: Record<string, number>;
    by_provider: Record<string, number>;
    top_orgs: Array<{ name: string; value: number }>;
    mrr: number;
    active_subscriptions: number;
    last_payment_at: string | null;
}

interface SyncResult {
    bachs: { listed: number | null; recorded_charges: number; checked: number; unreadable: number; recorded: number };
    coincircuit: { recorded: number };
    total: number;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function usd(value: number): string {
    return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usdAxis(value: number): string {
    if (value === 0) return '$0';
    return value >= 1000 ? `$${compact.format(value)}` : `$${Number(value.toPrecision(2))}`;
}

function bucketLabel(t: number, bucket: string): string {
    const date = new Date(t);
    return bucket.includes('hour')
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InternalRevenuePage() {
    const [period, setPeriod] = useState<Period>('30d');
    const reduceMotion = useReducedMotion();
    const queryClient = useQueryClient();

    const { data, isLoading, isError, error, refetch } = useQuery<RevenueResponse>({
        queryKey: ['internal-revenue', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/revenue?period=${period}`);
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? 'query_failed');
            return body as RevenueResponse;
        },
        staleTime: 30_000,
        placeholderData: (previous) => previous,
    });

    const sync = useMutation<SyncResult, Error>({
        mutationFn: async () => {
            const response = await fetch('/api/internal/billing/sync-payments', { method: 'POST' });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? 'Sync failed');
            return body as SyncResult;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['internal-revenue'] }),
    });

    const series = useMemo(() => data?.series ?? [], [data?.series]);
    const chartData = useMemo(
        () => series.map((point) => ({
            date: bucketLabel(point.t, data?.bucket ?? '1 day'),
            revenue: Number(point.revenue),
            credits: Number(point.credits),
            subscriptions: Number(point.subscriptions),
            other: Number(point.other),
            usd: Number(point.usd),
            ngn: Number(point.ngn_usd),
            payments: Number(point.payments),
            payingOrgs: Number(point.paying_orgs),
        })),
        [series, data?.bucket],
    );

    const loading = isLoading && !data;
    const totals = data?.totals;
    const revenue = Number(totals?.revenue ?? 0);
    const fees = Number(totals?.fees ?? 0);
    const hasPayments = Number(totals?.payments ?? 0) > 0;
    const periodLabel = PERIODS.find((option) => option.value === period)?.label.toLowerCase() ?? '30 days';
    const sum = (key: keyof RevenuePoint) => series.reduce((total, point) => total + Number(point[key] ?? 0), 0);

    const productRows = useMemo(
        () => Object.entries(data?.by_product ?? {})
            .map(([name, value]) => ({ name: PRODUCT_LABELS[name] ?? name, value: Number(value) }))
            .filter((row) => row.value > 0)
            .sort((a, b) => b.value - a.value),
        [data?.by_product],
    );
    const orgRows = useMemo(
        () => (data?.top_orgs ?? []).map((row) => ({ name: row.name, value: Number(row.value) })),
        [data?.top_orgs],
    );

    const revenueConfig: MetricCardConfig = {
        title: 'Revenue',
        detail: `${periodLabel} total`,
        series: [
            { key: 'credits', label: 'Credits', color: '#22c55e', value: usd(sum('credits')) },
            { key: 'subscriptions', label: 'Subscriptions', color: '#3b82f6', value: usd(sum('subscriptions')) },
            { key: 'other', label: 'Other', color: '#a855f7', value: usd(sum('other')) },
        ],
        formatValue: usd,
        formatAxis: usdAxis,
    };
    const currencyConfig: MetricCardConfig = {
        title: 'By currency',
        detail: `₦${Number(totals?.ngn_paid ?? 0).toLocaleString()} paid in naira`,
        series: [
            { key: 'usd', label: 'Dollars', color: '#f59e0b', value: usd(sum('usd')) },
            { key: 'ngn', label: 'Naira', color: '#10b981', value: usd(sum('ngn_usd')) },
        ],
        formatValue: usd,
        formatAxis: usdAxis,
    };
    const paymentsConfig: MetricCardConfig = {
        title: 'Payments',
        detail: `${Number(totals?.paying_orgs ?? 0).toLocaleString()} paying organizations`,
        series: [{ key: 'payments', label: 'Payments', color: '#f97316', value: Number(totals?.payments ?? 0).toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const payingConfig: MetricCardConfig = {
        title: 'Paying organizations',
        detail: 'per bucket',
        series: [{ key: 'payingOrgs', label: 'Organizations', color: '#ec4899', value: Number(totals?.paying_orgs ?? 0).toLocaleString() }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const productConfig: MetricCardConfig = {
        title: 'Revenue by product',
        detail: `${productRows.length} ${productRows.length === 1 ? 'product' : 'products'}`,
        series: [{ key: 'value', label: 'Revenue', color: '#22c55e', value: usd(revenue) }],
        formatValue: usd,
        formatAxis: usdAxis,
    };
    const orgsConfig: MetricCardConfig = {
        title: 'Top organizations',
        detail: `top ${orgRows.length}`,
        series: [{ key: 'value', label: 'Revenue', color: '#8b5cf6', value: usd(orgRows.reduce((total, row) => total + row.value, 0)) }],
        formatValue: usd,
        formatAxis: usdAxis,
    };

    const errorMessage = isError
        ? (error as Error)?.message === 'not_installed'
            ? 'This database doesn’t have the payments ledger yet (database/brimble/0700_payments_ledger.sql). It’s applied on the next deploy.'
            : 'We couldn’t load revenue.'
        : null;

    return (
        <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-sm font-medium tracking-[-0.02em]">Revenue</h1>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => sync.mutate()}
                        disabled={sync.isPending}
                        className="h-8 rounded-md border border-border/45 bg-muted/20 px-3 text-[11px] font-medium hover:bg-muted/50 disabled:opacity-60"
                    >
                        {sync.isPending ? 'Syncing with Bachs…' : 'Sync from Bachs'}
                    </button>
                    <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                        <SelectTrigger
                            aria-label="Select revenue period"
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
            </div>

            {sync.isSuccess && (
                <div className="mb-4 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-[11px] text-emerald-700 dark:text-emerald-400">
                    Synced {sync.data.total.toLocaleString()} payments: {sync.data.bachs.recorded.toLocaleString()} from Bachs
                    ({sync.data.bachs.checked.toLocaleString()} charges checked
                    {sync.data.bachs.unreadable ? `, ${sync.data.bachs.unreadable.toLocaleString()} unreadable` : ''}
                    {sync.data.bachs.listed === null ? ', payins listing unavailable' : ''}) and{' '}
                    {sync.data.coincircuit.recorded.toLocaleString()} crypto top-ups.
                </div>
            )}
            {sync.isError && (
                <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px] text-red-600 dark:text-red-400">
                    Sync failed: {sync.error.message}
                </div>
            )}
            {errorMessage && !data && (
                <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px]">
                    <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
                    <button type="button" onClick={() => void refetch()} className="shrink-0 font-medium underline underline-offset-4">
                        Try again
                    </button>
                </div>
            )}
            {data && !data.last_payment_at && (
                <div className="mb-4 rounded-md border border-border/40 bg-muted/30 px-4 py-3 text-[11px] text-muted-foreground">
                    No payments recorded yet. New payments are recorded as they come in; use Sync from Bachs to bring in past ones.
                </div>
            )}

            <div className="space-y-4">
                <StatCard
                    title="Summary"
                    detail={data?.last_payment_at ? `last payment ${new Date(data.last_payment_at).toLocaleString()}` : periodLabel}
                    stats={[
                        { label: `Revenue, ${periodLabel}`, value: usd(revenue), color: '#22c55e', large: true, hint: `${usd(Math.max(0, revenue - fees))} after fees` },
                        { label: 'MRR', value: usd(Number(data?.mrr ?? 0)), color: '#3b82f6', hint: `${Number(data?.active_subscriptions ?? 0)} active subscriptions` },
                        { label: 'Payments', value: Number(totals?.payments ?? 0).toLocaleString(), color: '#f97316' },
                        { label: 'Payment fees', value: usd(fees), color: '#ef4444' },
                    ]}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                    <MetricCard config={revenueConfig} data={chartData} loading={loading} hasData={hasPayments} reduceMotion={reduceMotion} />
                    <MetricCard config={currencyConfig} data={chartData} loading={loading} hasData={hasPayments} reduceMotion={reduceMotion} />
                    <MetricCardFrame config={productConfig} loading={loading}>
                        <BarBreakdownChart rows={productRows} color="#22c55e" label="Revenue" formatValue={usd} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCardFrame config={orgsConfig} loading={loading}>
                        <BarBreakdownChart rows={orgRows} color="#8b5cf6" label="Revenue" formatValue={usd} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCard config={paymentsConfig} data={chartData} loading={loading} hasData={hasPayments} reduceMotion={reduceMotion} />
                    <MetricCard config={payingConfig} data={chartData} loading={loading} hasData={hasPayments} reduceMotion={reduceMotion} />
                </div>
            </div>
        </section>
    );
}
