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
import { StatCard } from '@/internal/analytics/components/StatCard';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

// Tensor's launch numbers: who signed up, who ran a task, who paid, and what the tasks cost to
// run. Read from what Tensor already records to bill and sync accounts
// (database/brimble/1000_analytics_tensor.sql). A task is one the app started, on any device.

const PERIODS = [
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
    { value: 'all', label: 'All time' },
] as const;

type Period = (typeof PERIODS)[number]['value'];

/** Devices report the platform as the operating system names it. */
const PLATFORM_LABELS: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

interface TensorPoint {
    t: number;
    signups: number;
    activated: number;
    tasks: number;
    active: number;
    cost: number;
    payments: number;
    revenue: number;
    usd: number;
    ngn_usd: number;
    new_payers: number;
}

interface TensorResponse {
    bucket: string;
    series: TensorPoint[];
    totals: {
        signups: number;
        signups_activated: number;
        signups_paid: number;
        tasks: number;
        tasks_unfinished: number;
        active_accounts: number;
        cost: number;
        payments: number;
        revenue: number;
        ngn_paid: number;
        usd_paid: number;
        paying_accounts: number;
        new_payers: number;
        new_devices: number;
    };
    now: {
        accounts: number;
        ever_ran_a_task: number;
        ever_paid: number;
        paying: number;
        monthly_value: number;
        renewing: number;
        cancelling: number;
        past_due: number;
        ending_soon: number;
        active_1d: number;
        active_7d: number;
        active_30d: number;
        trial_used_up: number;
        paid_used_up: number;
        devices: number;
        last_task_at: string | null;
        last_payment_at: string | null;
    };
    by_plan: Array<{ code: string; name: string; accounts: number; revenue: number; cost: number; tasks: number }>;
    by_model: Array<{ name: string; value: number; cost: number }>;
    by_platform: Array<{ name: string; value: number }>;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

function count(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US');
}

function usd(value: number | undefined): string {
    return `$${Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function usdAxis(value: number): string {
    if (value === 0) return '$0';
    return value >= 1000 ? `$${compact.format(value)}` : `$${Number(value.toPrecision(2))}`;
}

/** A share as a whole percentage; a dash when there is nothing to take a share of. */
function share(part: number | undefined, whole: number | undefined): string {
    const total = Number(whole ?? 0);
    return total > 0 ? `${Math.round((Number(part ?? 0) / total) * 100)}%` : '–';
}

function bucketLabel(t: number, bucket: string): string {
    const date = new Date(t);
    return bucket.includes('hour')
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function InternalTensorPage() {
    const [period, setPeriod] = useState<Period>('7d');
    const reduceMotion = useReducedMotion();

    const { data, isLoading, isError, error, refetch } = useQuery<TensorResponse>({
        queryKey: ['internal-tensor', period],
        queryFn: async () => {
            const response = await fetch(`/api/internal/metrics/tensor?period=${period}`);
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body?.error ?? 'query_failed');
            return body as TensorResponse;
        },
        staleTime: 30_000,
        // Launch day is watched live.
        refetchInterval: 60_000,
        placeholderData: (previous) => previous,
    });

    const chartData = useMemo(
        () => (data?.series ?? []).map((point) => ({
            date: bucketLabel(point.t, data?.bucket ?? '1 day'),
            signups: Number(point.signups),
            activated: Number(point.activated),
            tasks: Number(point.tasks),
            active: Number(point.active),
            cost: Number(point.cost),
            revenue: Number(point.revenue),
            usd: Number(point.usd),
            ngn: Number(point.ngn_usd),
            newPayers: Number(point.new_payers),
        })),
        [data?.series, data?.bucket],
    );

    const loading = isLoading && !data;
    const totals = data?.totals;
    const now = data?.now;
    const periodLabel = PERIODS.find((option) => option.value === period)?.label.toLowerCase() ?? '7 days';
    const revenue = Number(totals?.revenue ?? 0);
    const cost = Number(totals?.cost ?? 0);

    const modelRows = useMemo(
        () => (data?.by_model ?? []).map((row) => ({ name: row.name, value: Number(row.value) })),
        [data?.by_model],
    );
    const platformRows = useMemo(
        () => (data?.by_platform ?? []).map((row) => ({ name: PLATFORM_LABELS[row.name] ?? row.name, value: Number(row.value) })),
        [data?.by_platform],
    );
    const planRows = data?.by_plan ?? [];

    const signupsConfig: MetricCardConfig = {
        title: 'Sign-ups and first tasks',
        detail: `${periodLabel}`,
        series: [
            { key: 'signups', label: 'Signed up', color: '#3b82f6', value: count(totals?.signups) },
            { key: 'activated', label: 'Ran a first task', color: '#22c55e', value: count(chartData.reduce((sum, point) => sum + point.activated, 0)) },
        ],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const tasksConfig: MetricCardConfig = {
        title: 'Tasks',
        detail: `${count(totals?.tasks_unfinished)} did not finish`,
        series: [{ key: 'tasks', label: 'Tasks', color: '#f97316', value: count(totals?.tasks) }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const activeConfig: MetricCardConfig = {
        title: 'Active accounts',
        detail: 'ran a task, per bucket',
        series: [{ key: 'active', label: 'Accounts', color: '#ec4899', value: count(totals?.active_accounts) }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const moneyConfig: MetricCardConfig = {
        title: 'Revenue and running cost',
        detail: `₦${Number(totals?.ngn_paid ?? 0).toLocaleString()} and ${usd(totals?.usd_paid)} paid`,
        series: [
            { key: 'revenue', label: 'Revenue', color: '#22c55e', value: usd(revenue) },
            { key: 'cost', label: 'Model cost', color: '#ef4444', value: usd(cost) },
        ],
        formatValue: usd,
        formatAxis: usdAxis,
    };
    const payersConfig: MetricCardConfig = {
        title: 'First payments',
        detail: 'accounts paying for the first time',
        series: [{ key: 'newPayers', label: 'New payers', color: '#8b5cf6', value: count(totals?.new_payers) }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const modelConfig: MetricCardConfig = {
        title: 'Tasks by model',
        detail: `top ${modelRows.length}`,
        series: [{ key: 'value', label: 'Tasks', color: '#f97316', value: count(totals?.tasks) }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };
    const platformConfig: MetricCardConfig = {
        title: 'Devices by platform',
        detail: 'all time',
        series: [{ key: 'value', label: 'Devices', color: '#06b6d4', value: count(now?.devices) }],
        formatValue: (value) => value.toLocaleString(),
        formatAxis: (value) => compact.format(value),
    };

    const errorMessage = isError
        ? (error as Error)?.message === 'not_installed'
            ? 'This database doesn’t have the Tensor metrics yet (database/brimble/1000_analytics_tensor.sql). It’s applied on the next deploy.'
            : 'We couldn’t load Tensor’s numbers.'
        : null;

    return (
        <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-sm font-medium tracking-[-0.02em]">Tensor</h1>
                <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                    <SelectTrigger
                        aria-label="Select period"
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
                <div className="mb-4 flex items-center justify-between gap-4 rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px]">
                    <p className="text-red-600 dark:text-red-400">{errorMessage}</p>
                    <button type="button" onClick={() => void refetch()} className="shrink-0 font-medium underline underline-offset-4">
                        Try again
                    </button>
                </div>
            )}

            <div className="space-y-4">
                <StatCard
                    title="Right now"
                    detail={now?.last_task_at ? `last task ${new Date(now.last_task_at).toLocaleString()}` : 'no tasks yet'}
                    stats={[
                        { label: 'Active today', value: count(now?.active_1d), color: '#ec4899', large: true, hint: `${count(now?.active_7d)} this week · ${count(now?.active_30d)} this month` },
                        { label: 'Accounts', value: count(now?.accounts), color: '#3b82f6', hint: `${share(now?.ever_ran_a_task, now?.accounts)} have run a task` },
                        { label: 'On a paid plan', value: count(now?.paying), color: '#22c55e', hint: `${usd(now?.monthly_value)} a month at list price` },
                        { label: 'Ever paid', value: count(now?.ever_paid), color: '#8b5cf6', hint: `${share(now?.ever_paid, now?.accounts)} of accounts` },
                    ]}
                />
                <StatCard
                    title="New accounts"
                    detail={`created in the last ${periodLabel}`}
                    stats={[
                        { label: 'Signed up', value: count(totals?.signups), color: '#3b82f6', large: true, hint: `${count(totals?.new_devices)} new devices` },
                        { label: 'Ran a task', value: count(totals?.signups_activated), color: '#22c55e', hint: `${share(totals?.signups_activated, totals?.signups)} of sign-ups` },
                        { label: 'Paid', value: count(totals?.signups_paid), color: '#8b5cf6', hint: `${share(totals?.signups_paid, totals?.signups)} of sign-ups` },
                        { label: 'Trials used up', value: count(now?.trial_used_up), color: '#f59e0b', hint: 'all accounts, now' },
                    ]}
                />
                <StatCard
                    title="Money"
                    detail={now?.last_payment_at ? `last payment ${new Date(now.last_payment_at).toLocaleString()}` : 'no payments yet'}
                    stats={[
                        { label: `Revenue, ${periodLabel}`, value: usd(revenue), color: '#22c55e', large: true, hint: `${count(totals?.payments)} payments from ${count(totals?.paying_accounts)} accounts` },
                        { label: 'Model cost', value: usd(cost), color: '#ef4444', hint: revenue > 0 ? `${share(cost, revenue)} of revenue` : `${count(totals?.tasks)} tasks` },
                        { label: 'Renewing by card', value: count(now?.renewing), color: '#3b82f6', hint: `${count(now?.cancelling)} cancelling · ${count(now?.past_due)} past due` },
                        { label: 'Ending within 7 days', value: count(now?.ending_soon), color: '#f59e0b', hint: `not set to renew · ${count(now?.paid_used_up)} paid at their limit` },
                    ]}
                />

                <div className="grid gap-4 lg:grid-cols-2">
                    <MetricCard config={signupsConfig} data={chartData} loading={loading} hasData={Number(now?.accounts ?? 0) > 0} reduceMotion={reduceMotion} />
                    <MetricCard config={activeConfig} data={chartData} loading={loading} hasData={Number(totals?.tasks ?? 0) > 0} reduceMotion={reduceMotion} />
                    <MetricCard config={tasksConfig} data={chartData} loading={loading} hasData={Number(totals?.tasks ?? 0) > 0} reduceMotion={reduceMotion} />
                    <MetricCard config={moneyConfig} data={chartData} loading={loading} hasData={revenue > 0 || cost > 0} reduceMotion={reduceMotion} />
                    <MetricCard config={payersConfig} data={chartData} loading={loading} hasData={Number(totals?.new_payers ?? 0) > 0} reduceMotion={reduceMotion} />
                    <MetricCardFrame config={modelConfig} loading={loading}>
                        <BarBreakdownChart rows={modelRows} color="#f97316" label="Tasks" formatValue={(value) => value.toLocaleString()} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCardFrame config={platformConfig} loading={loading}>
                        <BarBreakdownChart rows={platformRows} color="#06b6d4" label="Devices" formatValue={(value) => value.toLocaleString()} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                </div>

                <article className="overflow-hidden rounded-lg border border-border/40 bg-muted/30">
                    <header className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3.5">
                        <p className="text-sm font-medium tracking-[-0.01em] text-foreground">Plans</p>
                        <span className="text-xs text-muted-foreground">revenue, cost and tasks in the last {periodLabel}</span>
                    </header>
                    {planRows.length === 0 ? (
                        <p className="px-5 py-6 text-xs text-muted-foreground">{loading ? 'Loading…' : 'Nothing yet.'}</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="text-muted-foreground">
                                    <tr className="border-b border-border/40">
                                        <th className="px-5 py-2.5 font-normal">Plan</th>
                                        <th className="px-5 py-2.5 text-right font-normal">On it now</th>
                                        <th className="px-5 py-2.5 text-right font-normal">Tasks</th>
                                        <th className="px-5 py-2.5 text-right font-normal">Revenue</th>
                                        <th className="px-5 py-2.5 text-right font-normal">Model cost</th>
                                        <th className="px-5 py-2.5 text-right font-normal">Left over</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono tabular-nums">
                                    {planRows.map((plan) => {
                                        const left = Number(plan.revenue) - Number(plan.cost);
                                        return (
                                            <tr key={plan.code} className="border-b border-border/40 last:border-b-0">
                                                <td className="px-5 py-2.5 font-sans">{plan.name}</td>
                                                <td className="px-5 py-2.5 text-right">{plan.code === 'free' ? '–' : count(plan.accounts)}</td>
                                                <td className="px-5 py-2.5 text-right">{count(plan.tasks)}</td>
                                                <td className="px-5 py-2.5 text-right">{usd(plan.revenue)}</td>
                                                <td className="px-5 py-2.5 text-right">{usd(plan.cost)}</td>
                                                <td className={`px-5 py-2.5 text-right ${left < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                                    {left < 0 ? `-${usd(-left)}` : usd(left)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </article>
            </div>
        </section>
    );
}
