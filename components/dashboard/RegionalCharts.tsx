"use client";

/**
 * Regional Analytics Charts
 * 
 * Displays 4 comprehensive visualizations for geographic analytics:
 * 1. Top Countries Table
 * 2. Request Timeline (line chart)
 * 3. Provider Usage by Region (bar chart)
 * 4. Latency by Region (bar chart)
 */

import { useQuery } from "@tanstack/react-query";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

interface CountryStats {
    code: string;
    name: string;
    requests: number;
    tokens: number;
    cost: number;
    avgLatency: number;
    providers: Record<string, number>;
}

interface DailyStats {
    date: string;
    countries: Record<string, number>;
}

interface GeoAnalytics {
    countries: CountryStats[];
    timeline: DailyStats[];
    totals: {
        requests: number;
        tokens: number;
        cost: number;
        avgLatency: number;
    };
    providerTotals: Record<string, number>;
}

interface RegionalChartsProps {
    projectId: string;
}

// Color palette for charts
const COLORS = {
    orange: "#f97316",
    providers: {
        OpenAI: "#10b981",
        Anthropic: "#8b5cf6",
        Google: "#3b82f6",
        Mistral: "#f59e0b",
        Meta: "#06b6d4",
        xAI: "#ef4444",
        Other: "#6b7280",
    },
    countries: ["#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"],
};

// Format large numbers
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function RegionalCharts({ projectId }: RegionalChartsProps) {
    const { data, isLoading } = useQuery<GeoAnalytics>({
        queryKey: ["geo-analytics-full", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/geo`);
            if (!res.ok) throw new Error("Failed to fetch geo data");
            return res.json();
        },
        staleTime: 60 * 1000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-[200px] rounded-lg" />
                ))}
            </div>
        );
    }

    const countries = data?.countries || [];
    const timeline = data?.timeline || [];
    const providerTotals = data?.providerTotals || {};

    // Prepare timeline data for chart
    const timelineData = timeline.map((day) => {
        const entry: Record<string, number | string> = {
            date: new Date(day.date).toLocaleDateString("en-US", { weekday: "short" }),
        };
        // Add top 5 countries
        const topCountries = countries.slice(0, 5);
        for (const country of topCountries) {
            entry[country.name] = day.countries[country.code] || 0;
        }
        return entry;
    });

    // Prepare provider data for chart
    const providerData = Object.entries(providerTotals)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    // Prepare latency data for chart
    const latencyData = countries
        .slice(0, 8)
        .map((c) => ({
            name: c.code,
            latency: c.avgLatency,
        }));

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Top Countries Table */}
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <h3 className="text-xs font-medium">Top Countries</h3>
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="text-[10px]">
                                <TableHead className="h-8">Country</TableHead>
                                <TableHead className="h-8 text-right">Requests</TableHead>
                                <TableHead className="h-8 text-right">Tokens</TableHead>
                                <TableHead className="h-8 text-right">Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {countries.slice(0, 10).map((country) => (
                                <TableRow key={country.code} className="text-[10px]">
                                    <TableCell className="py-2 font-medium">{country.name}</TableCell>
                                    <TableCell className="py-2 text-right">{formatNumber(country.requests)}</TableCell>
                                    <TableCell className="py-2 text-right">{formatNumber(country.tokens)}</TableCell>
                                    <TableCell className="py-2 text-right">${country.cost.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                            {countries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-xs">
                                        No data available
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Request Timeline */}
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <h3 className="text-xs font-medium">Request Timeline (7 days)</h3>
                </div>
                <div className="p-4 h-[200px]">
                    {countries.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={timelineData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                        fontSize: "10px",
                                    }}
                                />
                                {countries.slice(0, 5).map((country, i) => (
                                    <Line
                                        key={country.code}
                                        type="monotone"
                                        dataKey={country.name}
                                        stroke={COLORS.countries[i] || COLORS.orange}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No timeline data available
                        </div>
                    )}
                </div>
            </div>

            {/* Provider Usage */}
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <h3 className="text-xs font-medium">Provider Usage</h3>
                </div>
                <div className="p-4 h-[200px]">
                    {providerData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={providerData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={70} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                        fontSize: "10px",
                                    }}
                                />
                                <Bar
                                    dataKey="count"
                                    fill={COLORS.orange}
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No provider data available
                        </div>
                    )}
                </div>
            </div>

            {/* Latency by Region */}
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <h3 className="text-xs font-medium">Latency by Region (ms)</h3>
                </div>
                <div className="p-4 h-[200px]">
                    {latencyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={latencyData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={30} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "hsl(var(--card))",
                                        border: "1px solid hsl(var(--border))",
                                        borderRadius: "6px",
                                        fontSize: "10px",
                                    }}
                                    formatter={(value: number) => [`${value}ms`, "Latency"]}
                                />
                                <Bar
                                    dataKey="latency"
                                    fill={COLORS.orange}
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                            No latency data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
