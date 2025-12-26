"use client";

/**
 * Regional Analytics Charts
 * 
 * Displays 4 comprehensive visualizations for geographic analytics:
 * 1. Top Countries Table
 * 2. Request Timeline (line chart)
 * 3. Provider Usage over Time (multi-line chart)
 * 4. Latency by Region (bar chart)
 */

import { useQuery } from "@tanstack/react-query";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
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
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import type { TimeRange } from "./GeoAnalyticsSection";

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

interface ProviderDailyStats {
    date: string;
    providers: Record<string, number>;
}

interface GeoAnalytics {
    countries: CountryStats[];
    timeline: DailyStats[];
    providerTimeline: ProviderDailyStats[];
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
    timeRange?: TimeRange;
}

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
    OpenAI: "hsl(142 76% 36%)",      // green
    Anthropic: "hsl(262 80% 60%)",   // purple
    Google: "hsl(24 80% 50%)",       // orange
    Mistral: "hsl(200 80% 50%)",     // blue
    Meta: "hsl(340 80% 50%)",        // pink
    xAI: "hsl(0 80% 50%)",           // red
    Qwen: "hsl(180 60% 45%)",        // teal
    DeepSeek: "hsl(45 80% 50%)",     // yellow
    Cohere: "hsl(280 60% 55%)",      // violet
    Other: "hsl(var(--muted-foreground))",
};

// Format large numbers
function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

export function RegionalCharts({ projectId, timeRange = "7d" }: RegionalChartsProps) {
    const { data, isLoading } = useQuery<GeoAnalytics>({
        queryKey: ["geo-analytics-full", projectId, timeRange],
        queryFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/analytics/geo?range=${timeRange}`);
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
    const providerTimeline = data?.providerTimeline || [];
    const providerTotals = data?.providerTotals || {};

    // Get list of all providers that have data
    const activeProviders = Object.keys(providerTotals).sort((a, b) => providerTotals[b] - providerTotals[a]);

    // Prepare timeline data for country chart
    const timelineData = timeline.map((day) => {
        const entry: Record<string, number | string> = {
            date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
        const topCountries = countries.slice(0, 5);
        for (const country of topCountries) {
            entry[country.name] = day.countries[country.code] || 0;
        }
        return entry;
    });

    // Prepare provider timeline data for multi-line chart
    const providerTimelineData = providerTimeline.map((day) => {
        const entry: Record<string, number | string> = {
            date: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        };
        for (const provider of activeProviders) {
            entry[provider] = day.providers[provider] || 0;
        }
        return entry;
    });

    // Prepare latency data for chart
    const latencyData = countries
        .filter(c => c.avgLatency > 0)
        .slice(0, 8)
        .map((c) => ({
            name: c.code,
            latency: c.avgLatency,
        }));

    // Chart configs
    const providerConfig: Record<string, { label: string; color: string }> = {};
    activeProviders.forEach((provider) => {
        providerConfig[provider] = {
            label: provider,
            color: PROVIDER_COLORS[provider] || PROVIDER_COLORS.Other,
        };
    });

    const latencyConfig = {
        latency: { label: "Latency", color: "hsl(262 80% 50%)" },
    };

    const countryConfig: Record<string, { label: string; color: string }> = {};
    const countryColors = ["hsl(24 80% 50%)", "hsl(142 76% 36%)", "hsl(262 80% 50%)", "hsl(200 80% 50%)", "hsl(340 80% 50%)"];
    countries.slice(0, 5).forEach((c, i) => {
        countryConfig[c.name] = { label: c.name, color: countryColors[i] || countryColors[0] };
    });

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Top Countries Table */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Top Countries</p>
                </div>
                <div className="max-h-[180px] overflow-y-auto">
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
                                    <TableCell className="py-2 text-right font-mono">{formatNumber(country.requests)}</TableCell>
                                    <TableCell className="py-2 text-right font-mono">{formatNumber(country.tokens)}</TableCell>
                                    <TableCell className="py-2 text-right font-mono">${country.cost.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                            {countries.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-[10px]">
                                        No data available
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Request Timeline by Country */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Requests by Country</p>
                </div>
                <div className="p-4 h-[180px]">
                    {timelineData.length > 0 && countries.length > 0 ? (
                        <ChartContainer config={countryConfig} className="h-full w-full">
                            <LineChart data={timelineData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                                    interval="preserveStartEnd"
                                />
                                <ChartTooltip
                                    cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                                    content={<ChartTooltipContent />}
                                />
                                {countries.slice(0, 5).map((country) => (
                                    <Line
                                        key={country.code}
                                        type="monotone"
                                        dataKey={country.name}
                                        stroke={countryConfig[country.name]?.color}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </LineChart>
                        </ChartContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                            No timeline data available
                        </div>
                    )}
                </div>
            </div>

            {/* Provider Usage Over Time - Multi-Line Chart */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Provider Usage</p>
                </div>
                <div className="p-4 h-[180px]">
                    {providerTimelineData.length > 0 && activeProviders.length > 0 ? (
                        <ChartContainer config={providerConfig} className="h-full w-full">
                            <LineChart data={providerTimelineData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                                    interval="preserveStartEnd"
                                />
                                <ChartTooltip
                                    cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                                    content={<ChartTooltipContent />}
                                />
                                {activeProviders.map((provider) => (
                                    <Line
                                        key={provider}
                                        type="monotone"
                                        dataKey={provider}
                                        stroke={PROVIDER_COLORS[provider] || PROVIDER_COLORS.Other}
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: PROVIDER_COLORS[provider] || PROVIDER_COLORS.Other }}
                                    />
                                ))}
                            </LineChart>
                        </ChartContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                            No provider data available
                        </div>
                    )}
                </div>
            </div>

            {/* Latency by Region */}
            <div className="rounded-md border border-border/40 bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border/40">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Latency by Region</p>
                </div>
                <div className="p-4 h-[180px]">
                    {latencyData.length > 0 ? (
                        <ChartContainer config={latencyConfig} className="h-full w-full">
                            <BarChart data={latencyData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                                <XAxis
                                    dataKey="name"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                                    interval={0}
                                />
                                <ChartTooltip
                                    cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                    content={<ChartTooltipContent hideLabel formatter={(value) => `${value}ms`} />}
                                />
                                <Bar
                                    dataKey="latency"
                                    fill="var(--color-latency)"
                                    radius={[2, 2, 0, 0]}
                                />
                            </BarChart>
                        </ChartContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground">
                            No latency data available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
