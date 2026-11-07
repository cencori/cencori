'use client';

import { useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useGatewayLatency, usePlatformMetrics } from '../hooks/useMetrics';
import type { CaptureMetrics, LatencyByCountry, LatencyWindow, PlatformOverviewMetrics, TimePeriod } from '../lib/types';
import {
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatCard } from '../components/StatCard';

// Platform analytics in the console's card style (same chrome as the project
// usage charts): stat cards for snapshot numbers, bar charts for breakdowns.
// The time series live on the internal Overview.

const PERIODS: Array<{ value: TimePeriod; label: string }> = [
    { value: '1h', label: 'Last hour' },
    { value: '24h', label: '24 hours' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' },
    { value: 'all', label: 'All time' },
];

// A metric whose query failed reads as "—". A zero here would claim "no
// traffic", which is exactly how a timed-out query used to look.
const UNAVAILABLE = '—';

const BAR_LIMIT = 6;
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const COLORS = {
    amber: '#f59e0b',
    green: '#22c55e',
    orange: '#f97316',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    red: '#ef4444',
    cyan: '#06b6d4',
    pink: '#ec4899',
};

function n(value: number | null | undefined): string {
    return value === null || value === undefined ? UNAVAILABLE : value.toLocaleString();
}

function plural(count: number, word: string): string {
    return `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;
}

function usd(value: number): string {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Governed share of gateway traffic; null when either side is unreadable. */
function governedShare(capture: CaptureMetrics): number | null {
    const { gatewayRequests, governanceDecisions } = capture;
    if (gatewayRequests === null || governanceDecisions === null) return null;
    if (gatewayRequests === 0) return 0;
    return Math.min(100, (governanceDecisions / gatewayRequests) * 100);
}

function topEntries(record: Record<string, number>, limit = BAR_LIMIT) {
    const sorted = Object.entries(record)
        .filter(([, value]) => value > 0)
        .sort(([, a], [, b]) => b - a);
    const top = sorted.slice(0, limit).map(([name, value]) => ({ name, value }));
    const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
    return rest > 0 ? [...top, { name: 'Other', value: rest }] : top;
}

function frameConfig(title: string, detail: string, color: string, value: string): MetricCardConfig {
    return {
        title,
        detail,
        series: [{ key: 'value', label: title, color, value }],
        formatValue: (v) => v.toLocaleString(),
        formatAxis: (v) => compact.format(v),
    };
}

export function AdminDashboard() {
    const [period, setPeriod] = useState<TimePeriod>('7d');
    const { data, isLoading, error } = usePlatformMetrics(period);
    const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? '7 days';

    return (
        <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mb-8 flex items-center justify-between gap-4">
                <h1 className="text-sm font-medium tracking-[-0.02em]">Analytics</h1>
                <Select value={period} onValueChange={(value) => setPeriod(value as TimePeriod)}>
                    <SelectTrigger
                        aria-label="Select analytics period"
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

            {error ? (
                <div className="rounded-md border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-[11px] text-red-600 dark:text-red-400">
                    We couldn&apos;t load platform analytics. {(error as Error).message}
                </div>
            ) : isLoading || !data ? (
                <LoadingSkeleton />
            ) : (
                <Dashboard data={data} periodLabel={periodLabel} />
            )}

            {data && (
                <p className="mt-8 text-center text-[10px] text-muted-foreground">
                    Last updated {new Date(data.generatedAt).toLocaleString()}
                </p>
            )}
        </section>
    );
}

function Dashboard({ data, periodLabel }: { data: PlatformOverviewMetrics; periodLabel: string }) {
    const reduceMotion = useReducedMotion();
    const gateway = data.aiGateway;
    const gatewayDown = Boolean(gateway.unavailable);
    const security = data.security;
    const securityDown = Boolean(security.unavailable);
    const share = governedShare(data.capture);
    const errorRate = gateway.totalRequests > 0 ? (gateway.errorRequests / gateway.totalRequests) * 100 : 0;
    const period = periodLabel.toLowerCase();

    const providerRows = useMemo(() => topEntries(gateway.requestsByProvider), [gateway.requestsByProvider]);
    const modelRows = useMemo(() => topEntries(gateway.requestsByModel), [gateway.requestsByModel]);
    const severityRows = [
        { name: 'Critical', value: security.incidentsBySeverity.critical },
        { name: 'High', value: security.incidentsBySeverity.high },
        { name: 'Medium', value: security.incidentsBySeverity.medium },
        { name: 'Low', value: security.incidentsBySeverity.low },
    ].filter((row) => row.value > 0);
    const incidentTypeRows = useMemo(() => topEntries(security.incidentsByType), [security.incidentsByType]);
    const heardAboutRows = data.users.heardAbout.map((row) => ({ name: row.label, value: row.count }));
    const productRows = useMemo(() => topEntries(data.platformEvents.eventsByProduct), [data.platformEvents.eventsByProduct]);
    const eventTypeRows = useMemo(() => topEntries(data.platformEvents.eventsByType), [data.platformEvents.eventsByType]);
    const scoreRows = (['A', 'B', 'C', 'D', 'F'] as const)
        .map((tier) => ({ name: `${tier}-Tier`, value: data.scan.scoreBreakdown[tier] }))
        .filter((row) => row.value > 0);
    const scanPlatformRows = [
        { name: 'macOS', value: data.scan.platformBreakdown.darwin },
        { name: 'Linux', value: data.scan.platformBreakdown.linux },
        { name: 'Windows', value: data.scan.platformBreakdown.win32 },
        { name: 'Other', value: data.scan.platformBreakdown.other },
    ].filter((row) => row.value > 0);

    return (
        <div className="space-y-10">
            <Section title="Throughput">
                <StatCard
                    title="AI throughput"
                    detail={period}
                    stats={[
                        { label: 'Tokens processed', value: gatewayDown ? UNAVAILABLE : gateway.totalTokens.toLocaleString(), color: COLORS.blue, large: true },
                        { label: 'Requests', value: gatewayDown ? UNAVAILABLE : gateway.totalRequests.toLocaleString(), color: COLORS.amber },
                        { label: 'Cost', value: gatewayDown ? UNAVAILABLE : usd(gateway.totalCost), color: COLORS.orange },
                        { label: 'Governed', value: share === null ? UNAVAILABLE : `${share.toFixed(0)}%`, color: COLORS.violet },
                    ]}
                    note={gatewayDown ? 'Gateway query failed. This is not zero traffic.' : undefined}
                />
            </Section>

            <Section title="Capture by product">
                <StatCard
                    title="Workloads captured"
                    detail={period}
                    stats={[
                        { label: 'Gateway requests', value: n(data.capture.gatewayRequests), color: COLORS.amber },
                        { label: 'Governed events', value: n(data.capture.governanceDecisions), color: COLORS.violet },
                        { label: 'Memories', value: n(data.capture.memories), color: COLORS.cyan },
                        { label: 'Agent sessions', value: n(data.capture.agentSessions), color: COLORS.pink },
                    ]}
                />
            </Section>

            <Section title="AI Gateway">
                <StatCard
                    title="Requests"
                    detail={gatewayDown ? 'query failed, not zero' : `${gateway.successfulRequests.toLocaleString()} successful`}
                    stats={[
                        { label: 'Total requests', value: gatewayDown ? UNAVAILABLE : gateway.totalRequests.toLocaleString(), color: COLORS.amber },
                        { label: 'Avg latency', value: gatewayDown ? UNAVAILABLE : `${gateway.avgLatency.toLocaleString()}ms`, color: COLORS.green },
                        { label: 'Streaming', value: gatewayDown ? UNAVAILABLE : n(gateway.streamingRequests), color: COLORS.blue },
                        {
                            label: 'Error rate',
                            value: gatewayDown ? UNAVAILABLE : `${errorRate.toFixed(1)}%`,
                            color: COLORS.red,
                            hint: gatewayDown ? undefined : `${gateway.errorRequests.toLocaleString()} errors, ${gateway.filteredRequests.toLocaleString()} filtered`,
                        },
                    ]}
                />
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <MetricCardFrame
                        config={frameConfig('Requests by provider', plural(Object.keys(gateway.requestsByProvider).length, 'provider'), COLORS.orange, gatewayDown ? UNAVAILABLE : gateway.totalRequests.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={providerRows} color={COLORS.orange} label="Requests" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="provider" />
                    </MetricCardFrame>
                    <MetricCardFrame
                        config={frameConfig('Requests by model', plural(Object.keys(gateway.requestsByModel).length, 'model'), COLORS.violet, gatewayDown ? UNAVAILABLE : gateway.totalRequests.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={modelRows} color={COLORS.violet} label="Requests" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="model" />
                    </MetricCardFrame>
                </div>
            </Section>

            <Section title="Latency by country">
                <LatencyComparison />
            </Section>

            <Section title="Security">
                <div className="grid gap-4 lg:grid-cols-2">
                    <MetricCardFrame
                        config={frameConfig('Incidents by severity', securityDown ? 'query failed, not zero' : `${security.incidentsBySeverity.critical} critical`, COLORS.red, securityDown ? UNAVAILABLE : security.totalIncidents.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={severityRows} color={COLORS.red} label="Incidents" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCardFrame
                        config={frameConfig('Incidents by type', plural(Object.keys(security.incidentsByType).length, 'type'), COLORS.amber, securityDown ? UNAVAILABLE : security.totalIncidents.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={incidentTypeRows} color={COLORS.amber} label="Incidents" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                </div>
            </Section>

            <Section title="Organizations & projects">
                <StatCard
                    title="Adoption"
                    detail={`active in ${period}`}
                    stats={[
                        { label: 'Organizations', value: data.organizations.total.toLocaleString(), color: COLORS.pink, hint: `${data.organizations.active.toLocaleString()} active` },
                        { label: 'Projects', value: data.projects.total.toLocaleString(), color: COLORS.blue, hint: `${data.projects.active.toLocaleString()} active` },
                        { label: 'API keys', value: data.apiKeys.total.toLocaleString(), color: COLORS.amber, hint: `${data.apiKeys.active.toLocaleString()} active` },
                        { label: 'Team members', value: data.organizations.totalMembers.toLocaleString(), color: COLORS.green },
                    ]}
                />
            </Section>

            <Section title="Users">
                <StatCard
                    title="Signups"
                    detail={`${data.users.active.toLocaleString()} active in ${period}`}
                    stats={[
                        { label: 'Total users', value: data.users.total.toLocaleString(), color: COLORS.cyan },
                        { label: `New in ${period}`, value: data.users.newThisPeriod.toLocaleString(), color: COLORS.green },
                        { label: 'New this week', value: data.users.newThisWeek.toLocaleString(), color: COLORS.blue },
                        { label: 'New this month', value: data.users.newThisMonth.toLocaleString(), color: COLORS.violet },
                    ]}
                />
                <div className="mt-4">
                    <MetricCardFrame
                        config={frameConfig('How people heard about us', `${data.users.heardAboutAnswered} of ${data.users.newThisPeriod} new users answered`, COLORS.cyan, data.users.heardAboutAnswered.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={heardAboutRows} color={COLORS.cyan} label="Users" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                </div>
            </Section>

            <Section title="Billing & revenue">
                <StatCard
                    title="Subscriptions"
                    detail={`${data.billing.activeSubscriptions} paid`}
                    stats={[
                        { label: 'Plan MRR (estimate)', value: `$${data.billing.mrr.toLocaleString()}`, color: COLORS.green, hint: 'list prices; real money is on Revenue' },
                        { label: 'Active subscriptions', value: data.billing.activeSubscriptions.toLocaleString(), color: COLORS.blue },
                        { label: `Churned in ${period}`, value: data.billing.churnedThisPeriod.toLocaleString(), color: COLORS.red },
                        {
                            label: 'Avg revenue / sub',
                            value: data.billing.activeSubscriptions > 0 ? `$${(data.billing.mrr / data.billing.activeSubscriptions).toFixed(0)}` : '$0',
                            color: COLORS.orange,
                        },
                    ]}
                />
            </Section>

            <Section title="Platform events">
                <StatCard
                    title="Events"
                    detail={`${data.platformEvents.eventsToday.toLocaleString()} today`}
                    stats={[
                        { label: 'Total events', value: data.platformEvents.totalEvents.toLocaleString(), color: COLORS.violet },
                        { label: 'Products', value: Object.keys(data.platformEvents.eventsByProduct).length.toLocaleString(), color: COLORS.blue },
                        { label: 'Event types', value: Object.keys(data.platformEvents.eventsByType).length.toLocaleString(), color: COLORS.amber },
                        { label: 'Today', value: data.platformEvents.eventsToday.toLocaleString(), color: COLORS.green },
                    ]}
                />
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <MetricCardFrame
                        config={frameConfig('Events by product', plural(Object.keys(data.platformEvents.eventsByProduct).length, 'product'), COLORS.blue, data.platformEvents.totalEvents.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={productRows} color={COLORS.blue} label="Events" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCardFrame
                        config={frameConfig('Events by type', plural(Object.keys(data.platformEvents.eventsByType).length, 'type'), COLORS.violet, data.platformEvents.totalEvents.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={eventTypeRows} color={COLORS.violet} label="Events" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                </div>
            </Section>

            <Section title="Cencori Scan">
                <StatCard
                    title="CLI scans"
                    detail={`${data.scan.authenticatedScans.toLocaleString()} with an API key`}
                    stats={[
                        { label: 'Total scans', value: data.scan.totalScans.toLocaleString(), color: COLORS.green },
                        { label: 'Conversion rate', value: `${data.scan.conversionRate}%`, color: COLORS.blue, hint: `${data.scan.anonymousScans.toLocaleString()} anonymous` },
                        { label: 'Files scanned', value: data.scan.totalFilesScanned.toLocaleString(), color: COLORS.violet, hint: `${data.scan.avgIssuesPerScan} avg issues per scan` },
                        { label: 'Issues found', value: data.scan.totalIssuesFound.toLocaleString(), color: COLORS.red },
                    ]}
                />
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <MetricCardFrame
                        config={frameConfig('Scans by score', '5 tiers', COLORS.green, data.scan.totalScans.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={scoreRows} color={COLORS.green} label="Scans" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                    <MetricCardFrame
                        config={frameConfig('Scans by platform', plural(scanPlatformRows.length, 'platform'), COLORS.blue, data.scan.totalScans.toLocaleString())}
                        loading={false}
                    >
                        <BarBreakdownChart rows={scanPlatformRows} color={COLORS.blue} label="Scans" formatValue={(v) => compact.format(v)} reduceMotion={reduceMotion} labelKind="plain" />
                    </MetricCardFrame>
                </div>
            </Section>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section>
            <h2 className="mb-4 text-sm font-medium tracking-[-0.02em]">{title}</h2>
            {children}
        </section>
    );
}

const LATENCY_COUNTRIES = 8;

function ms(value: number | null | undefined): string {
    if (value === null || value === undefined) return UNAVAILABLE;
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

function LatencyComparison() {
    const { data, isLoading, error } = useGatewayLatency();

    const frame = (body: React.ReactNode) => (
        <article className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-muted/30">
            <header className="flex items-center justify-between gap-4 border-b border-border/40 px-5 py-3.5">
                <p className="text-sm font-medium tracking-[-0.01em] text-foreground">Median time to first token and to completion</p>
                <span className="text-xs text-muted-foreground">
                    {data ? `${data.before?.label ?? 'Vercel'} vs ${data.after?.label ?? 'Lagos'}` : 'before vs after the move'}
                </span>
            </header>
            {body}
        </article>
    );

    if (isLoading) return frame(<div className="p-5"><Skeleton className="h-48 w-full rounded-sm" /></div>);
    if (error || !data) return frame(<p className="px-5 py-6 text-xs text-red-600 dark:text-red-400">We couldn&apos;t load latency.</p>);

    const before = new Map((data.before?.countries ?? []).map((row) => [row.country, row]));
    const after = new Map((data.after?.countries ?? []).map((row) => [row.country, row]));
    const countries = [...new Set([
        ...(data.before?.countries ?? []).map((row) => row.country),
        ...(data.after?.countries ?? []).map((row) => row.country),
    ])].slice(0, LATENCY_COUNTRIES);

    return frame(
        countries.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
                <span className="rounded-md bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">No data for this period</span>
            </div>
        ) : (
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-[11px] text-muted-foreground">
                            <th className="px-5 py-3 text-left font-normal">Country</th>
                            <th className="px-3 py-3 text-right font-normal">Requests</th>
                            <th className="px-3 py-3 text-right font-normal">Preflight</th>
                            <th className="px-3 py-3 text-right font-normal">Provider TTFT</th>
                            <th className="px-3 py-3 text-right font-normal">Client TTFT</th>
                            <th className="px-3 py-3 text-right font-normal">TTFT p90</th>
                            <th className="px-5 py-3 text-right font-normal">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {countries.map((country) => (
                            <LatencyRows
                                key={country}
                                country={country}
                                before={before.get(country)}
                                after={after.get(country)}
                                windows={[data.before, data.after]}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        ),
    );
}

function LatencyRows({ country, before, after, windows }: {
    country: string;
    before?: LatencyByCountry;
    after?: LatencyByCountry;
    windows: [LatencyWindow | null, LatencyWindow | null];
}) {
    const rows: Array<[string, LatencyByCountry | undefined, boolean]> = [
        [windows[0]?.label ?? 'Vercel', before, windows[0] === null],
        [windows[1]?.label ?? 'Lagos', after, windows[1] === null],
    ];
    return (
        <>
            {rows.map(([label, row, failed], index) => (
                <tr key={label} className={cn(index === 0 && 'border-t border-border/40')}>
                    <td className="px-5 py-1.5">
                        {index === 0 && <span className="mr-2 font-mono font-medium">{country}</span>}
                        <span className={cn('text-muted-foreground', index === 1 && 'ml-[calc(2ch+0.5rem)]')}>{label}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{failed ? UNAVAILABLE : (row?.requests ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{ms(row?.preflightP50)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{ms(row?.providerTtftP50)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-medium tabular-nums">{ms(row?.clientTtftP50)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{ms(row?.clientTtftP90)}</td>
                    <td className="px-5 py-1.5 text-right font-mono tabular-nums">{ms(row?.latencyP50)}</td>
                </tr>
            ))}
        </>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-10">
            {[0, 1, 2].map((i) => (
                <div key={i}>
                    <Skeleton className="mb-4 h-4 w-32 rounded-sm" />
                    <Skeleton className="h-36 w-full rounded-lg" />
                </div>
            ))}
        </div>
    );
}
