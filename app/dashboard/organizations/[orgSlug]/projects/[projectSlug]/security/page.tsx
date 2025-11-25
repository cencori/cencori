"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { SecurityIncidentsResponse } from "@/lib/types/audit";
import { SecurityIncidentsTable } from "@/components/audit/SecurityIncidentsTable";
import { SecurityIncidentModal } from "@/components/audit/SecurityIncidentModal";
import { MetricCard } from "@/components/audit/MetricCard";
import { TimeRangeSelector, TimeRangeOption } from "@/components/audit/TimeRangeSelector";
import { GlowingRadialChart } from "@/components/charts/GlowingRadialChart";
import { ValueLineBarChart } from "@/components/charts/ValueLineBarChart";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ShieldAlert,
    AlertTriangle,
    AlertOctagon,
    Info
} from "lucide-react";
import { DateRange } from "react-day-picker";

export default function SecurityIncidentsPage() {
    const params = useParams();
    const projectId = params.projectSlug as string;

    // State
    const [data, setData] = useState<SecurityIncidentsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

    // Filters
    const [severity, setSeverity] = useState("all");
    const [type, setType] = useState("all");
    const [reviewed, setReviewed] = useState<string>("all");
    const [timeRange, setTimeRange] = useState<TimeRangeOption>("30d");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [page, setPage] = useState(1);

    // Fetch data
    const fetchData = async () => {
        setLoading(true);

        const params = new URLSearchParams({
            severity,
            type,
            timeRange,
            page: page.toString(),
            perPage: "50",
        });

        if (reviewed !== "all") {
            params.set("reviewed", reviewed);
        }

        if (timeRange === "custom" && dateRange?.from) {
            params.set("startDate", dateRange.from.toISOString());
            if (dateRange.to) {
                params.set("endDate", dateRange.to.toISOString());
            }
        }

        try {
            const res = await fetch(`/api/projects/${projectId}/security/incidents?${params}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Failed to fetch incidents:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [projectId, severity, type, reviewed, timeRange, dateRange, page]);

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Security Incidents</h1>
                    <p className="text-muted-foreground mt-1">
                        Track and review security threats and blocked content
                    </p>
                </div>
            </div>

            {/* Severity Summary */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                    title="Critical"
                    value={data?.summary?.critical?.toLocaleString() || "0"}
                    icon={AlertOctagon}
                    loading={loading}
                    className="border-red-200 dark:border-red-900/50"
                />
                <MetricCard
                    title="High"
                    value={data?.summary?.high?.toLocaleString() || "0"}
                    icon={AlertTriangle}
                    loading={loading}
                    className="border-orange-200 dark:border-orange-900/50"
                />
                <MetricCard
                    title="Medium"
                    value={data?.summary?.medium?.toLocaleString() || "0"}
                    icon={ShieldAlert}
                    loading={loading}
                    className="border-yellow-200 dark:border-yellow-900/50"
                />
                <MetricCard
                    title="Low"
                    value={data?.summary?.low?.toLocaleString() || "0"}
                    icon={Info}
                    loading={loading}
                    className="border-blue-200 dark:border-blue-900/50"
                />
            </div>

            {/* Charts */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* These charts show incident type distribution and risk trends */}
                {/* Real integration would transform the incidents data */}
                <GlowingRadialChart />
                <ValueLineBarChart />
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-1 items-center gap-2">
                    <Select value={severity} onValueChange={setSeverity}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Severities</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="jailbreak">Jailbreak</SelectItem>
                            <SelectItem value="pii_input">PII Input</SelectItem>
                            <SelectItem value="pii_output">PII Output</SelectItem>
                            <SelectItem value="harmful_content">Harmful Content</SelectItem>
                            <SelectItem value="instruction_leakage">Instruction Leakage</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={reviewed} onValueChange={setReviewed}>
                        <SelectTrigger className="w-[140px] h-9">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="false">Pending Review</SelectItem>
                            <SelectItem value="true">Reviewed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <TimeRangeSelector
                    value={timeRange}
                    onChange={(range, dates) => {
                        setTimeRange(range);
                        setDateRange(dates);
                    }}
                    dateRange={dateRange}
                />
            </div>

            {/* Table */}
            <SecurityIncidentsTable
                incidents={data?.incidents || []}
                isLoading={loading}
                pagination={data?.pagination || { page: 1, perPage: 50, total: 0, totalPages: 0 }}
                onPageChange={setPage}
                onIncidentClick={setSelectedIncidentId}
            />

            {/* Detail Modal */}
            <SecurityIncidentModal
                incidentId={selectedIncidentId}
                projectId={projectId}
                open={!!selectedIncidentId}
                onOpenChange={(open) => !open && setSelectedIncidentId(null)}
                onUpdate={fetchData}
            />
        </div>
    );
}
