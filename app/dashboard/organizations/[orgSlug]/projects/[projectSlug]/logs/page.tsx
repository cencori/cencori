"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { RequestLogsResponse } from "@/lib/types/audit";
import { RequestLogsTable } from "@/components/audit/RequestLogsTable";
import { RequestFilters } from "@/components/audit/RequestFilters";
import { ExportButton } from "@/components/audit/ExportButton";
import { MetricCard } from "@/components/audit/MetricCard";
import { ClippedAreaChart } from "@/components/charts/ClippedAreaChart";
import { MonochromeBarChart } from "@/components/charts/MonochromeBarChart";
import {
    Activity,
    CheckCircle2,
    Clock,
    DollarSign
} from "lucide-react";
import { DateRange } from "react-day-picker";
import { TimeRangeOption } from "@/components/audit/TimeRangeSelector";

export default function RequestLogsPage() {
    const params = useParams();
    const projectId = params.projectSlug as string;

    // State
    const [data, setData] = useState<RequestLogsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");
    const [model, setModel] = useState("all");
    const [timeRange, setTimeRange] = useState<TimeRangeOption>("30d");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [page, setPage] = useState(1);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams({
                status,
                model,
                timeRange,
                page: page.toString(),
                perPage: "50",
            });

            if (search) params.set("search", search);
            if (timeRange === "custom" && dateRange?.from) {
                params.set("startDate", dateRange.from.toISOString());
                if (dateRange.to) {
                    params.set("endDate", dateRange.to.toISOString());
                }
            }

            try {
                const res = await fetch(`/api/projects/${projectId}/logs?${params}`);
                const json = await res.json();
                setData(json);
            } catch (error) {
                console.error("Failed to fetch logs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId, status, model, timeRange, dateRange, page, search]);

    // Export handlers
    const handleExport = (format: 'csv' | 'json') => {
        if (!data) return;

        if (format === 'csv') {
            const csv = [
                ['ID', 'Time', 'Status', 'Model', 'Tokens', 'Cost', 'Latency'].join(','),
                ...data.requests.map(r => [
                    r.id,
                    r.created_at,
                    r.status,
                    r.model,
                    r.total_tokens,
                    r.cost_usd,
                    r.latency_ms
                ].join(','))
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `requests-${new Date().toISOString()}.csv`;
            a.click();
        } else {
            const json = JSON.stringify(data.requests, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `requests-${new Date().toISOString()}.json`;
            a.click();
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
                    <p className="text-muted-foreground mt-1">
                        Monitor and debug all AI requests for this project
                    </p>
                </div>
                <ExportButton onExport={handleExport} disabled={!data || data.requests.length === 0} />
            </div>

            {/* Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Total Requests"
                    value={data?.summary.totalRequests.toLocaleString() || "0"}
                    icon={Activity}
                    loading={loading}
                />
                <MetricCard
                    title="Success Rate"
                    value={data ? `${data.summary.successRate.toFixed(1)}%` : "0%"}
                    icon={CheckCircle2}
                    trend={{
                        value: 5.2,
                        label: "vs. last period",
                        direction: "up"
                    }}
                    loading={loading}
                />
                <MetricCard
                    title="Avg Latency"
                    value={data ? `${Math.round(data.summary.avgLatency)}ms` : "0ms"}
                    icon={Clock}
                    loading={loading}
                />
                <MetricCard
                    title="Total Cost"
                    value={data ? `$${data.summary.totalCost.toFixed(4)}` : "$0.00"}
                    icon={DollarSign}
                    loading={loading}
                />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Note: For the logs page, we'd ideally fetch time-series data */}
                {/* For now showing placeholder - you could add a separate endpoint or aggregate client-side */}
                <ClippedAreaChart />
                <MonochromeBarChart />
            </div>

            {/* Filters */}
            <RequestFilters
                search={search}
                onSearchChange={setSearch}
                status={status}
                onStatusChange={setStatus}
                model={model}
                onModelChange={setModel}
                timeRange={timeRange}
                onTimeRangeChange={(range, dates) => {
                    setTimeRange(range);
                    setDateRange(dates);
                }}
                dateRange={dateRange}
            />

            {/* Table */}
            <RequestLogsTable
                logs={data?.requests || []}
                isLoading={loading}
                pagination={data?.pagination || { page: 1, perPage: 50, total: 0, totalPages: 0 }}
                onPageChange={setPage}
                projectId={projectId}
            />
        </div>
    );
}
