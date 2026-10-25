"use client";

import { useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { useAgentWorkspace } from "@/components/agents/AgentWorkspace";
import { useAgentRuns, useAgentStats } from "@/components/agents/useAgentStats";
import { RunsTable } from "@/components/agents/RunsTable";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard, type MetricCardConfig } from "@/components/dashboard/project-overview/ProjectOverviewDashboard";
import { agentStatus, useAgentsBasePath } from "@/components/agents/studio";

const PERIODS = [
    { value: "7", label: "Last 7 days" },
    { value: "30", label: "Last 30 days" },
    { value: "90", label: "Last 90 days" },
];
const COLORS = { completed: "#10b981", failed: "#ef4444", cost: "#8b5cf6", duration: "#f59e0b", tokens: "#3b82f6" };
const numberFormat = new Intl.NumberFormat("en-US");
const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatUsd(value: number): string {
    if (value > 0 && value < 0.01) return "<$0.01";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatDuration(ms: number | null): string {
    if (!ms) return "—";
    return ms < 1000 ? `${ms}ms` : ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60_000).toFixed(1)}m`;
}

/** "2026-10-23" → "Oct 23" (days are UTC). */
function formatDay(day: string): string {
    return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** An agent at a glance: status, activity charts and the latest runs. */
export default function AgentOverviewPage() {
    const { agent, data, projectId, versions } = useAgentWorkspace();
    const basePath = `${useAgentsBasePath()}/${encodeURIComponent(agent.id)}`;
    const reduceMotion = useReducedMotion();
    const [days, setDays] = useState("30");
    const stats = useAgentStats(projectId, agent.id, days);
    const recent = useAgentRuns(projectId, agent.id, { limit: 5 });
    const recentRuns = recent.data?.runs ?? [];
    const published = versions.find((version) => version.id === agent.stable_version_id);
    const installs = data.installations.filter((item) => item.agent_id === agent.id).length;
    const totals = stats.data?.totals;
    const loading = stats.isLoading || !stats.data;
    const periodLabel = PERIODS.find((period) => period.value === days)?.label.toLowerCase() ?? "";
    const chartData = (stats.data?.daily ?? []).map((point) => ({ ...point, date: formatDay(point.date) }));

    const summary = [
        { label: "Status", value: agentStatus(agent), detail: published ? `v${published.version} live` : "Not published yet" },
        { label: "Customers", value: numberFormat.format(installs), detail: `${numberFormat.format(totals?.customers ?? 0)} active ${periodLabel}` },
        { label: "Success rate", value: totals?.successRate == null ? "—" : `${Math.round(totals.successRate * 100)}%`, detail: totals?.failed ? `${numberFormat.format(totals.failed)} failed` : "No failures" },
        { label: "Avg duration", value: formatDuration(totals?.avgDurationMs ?? null), detail: "per run" },
    ];

    const charts: { config: MetricCardConfig; hasData: boolean }[] = [
        {
            config: {
                title: "Runs",
                detail: numberFormat.format(totals?.runs ?? 0),
                series: [
                    { key: "completed", label: "Completed", color: COLORS.completed, value: numberFormat.format((totals?.runs ?? 0) - (totals?.failed ?? 0)) },
                    { key: "failed", label: "Failed", color: COLORS.failed, value: numberFormat.format(totals?.failed ?? 0) },
                ],
                formatValue: (value) => numberFormat.format(value),
                formatAxis: (value) => compactNumber.format(value),
            },
            hasData: (totals?.runs ?? 0) > 0,
        },
        {
            config: {
                title: "Cost",
                detail: periodLabel,
                series: [{ key: "costUsd", label: "Cost", color: COLORS.cost, value: formatUsd(totals?.costUsd ?? 0) }],
                formatValue: (value) => formatUsd(value),
                formatAxis: (value) => `$${value.toFixed(value < 1 ? 2 : 0)}`,
            },
            hasData: (totals?.costUsd ?? 0) > 0,
        },
        {
            config: {
                title: "Duration",
                detail: "average per run",
                series: [{ key: "avgDurationMs", label: "Avg duration", color: COLORS.duration, value: formatDuration(totals?.avgDurationMs ?? null) }],
                formatValue: (value) => formatDuration(value),
                formatAxis: (value) => formatDuration(value),
            },
            hasData: (totals?.avgDurationMs ?? 0) > 0,
        },
        {
            config: {
                title: "Tokens",
                detail: periodLabel,
                series: [{ key: "tokens", label: "Tokens", color: COLORS.tokens, value: compactNumber.format(totals?.tokens ?? 0) }],
                formatValue: (value) => numberFormat.format(value),
                formatAxis: (value) => compactNumber.format(value),
            },
            hasData: (totals?.tokens ?? 0) > 0,
        },
    ];

    return (
        <div>
            <header className="mb-6 flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-base font-medium">Overview</h1>
                </div>
                <Select value={days} onValueChange={setDays}>
                    <SelectTrigger aria-label="Select period" className="h-7 w-[140px] text-xs shadow-none dark:shadow-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {PERIODS.map((period) => <SelectItem key={period.value} value={period.value} className="text-xs">{period.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </header>

            <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border/40 bg-muted/30 md:grid-cols-4">
                {summary.map((stat, index) => (
                    <div key={stat.label} className={`min-w-0 px-5 py-4 ${index % 2 === 0 ? "border-r border-border/40" : ""} ${index < 2 ? "border-b border-border/40 md:border-b-0" : ""} ${index === 1 || index === 2 ? "md:border-r" : ""}`}>
                        <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                        {loading && index > 1 ? <Skeleton className="mt-2 h-4 w-14" /> : <dd className="mt-1.5 truncate text-sm font-medium">{stat.value}</dd>}
                        <dd className="mt-1 truncate text-xs text-muted-foreground">{stat.detail}</dd>
                    </div>
                ))}
            </dl>

            {stats.error ? (
                <p className="mt-6 rounded-lg border border-border/40 bg-muted/30 px-5 py-10 text-center text-xs text-muted-foreground">
                    {stats.error instanceof Error ? stats.error.message : "Could not load this agent's activity."}
                </p>
            ) : (
                <>
                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {charts.map((chart) => (
                            <MetricCard key={chart.config.title} config={chart.config} data={chartData} loading={loading} hasData={chart.hasData} reduceMotion={reduceMotion} />
                        ))}
                    </div>
                    {stats.data?.truncated && <p className="mt-2 text-[11px] text-muted-foreground">Very busy period: totals cover the first 20,000 runs.</p>}

                    <section className="mt-8">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-medium">Recent runs</h2>
                            <Button asChild size="sm" className="h-7 text-xs"><Link href={`${basePath}/runs`}>View all</Link></Button>
                        </div>
                        <RunsTable runs={recentRuns} tenants={data.tenants} />
                    </section>
                </>
            )}
        </div>
    );
}
