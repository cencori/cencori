import React from "react";
import {
    ArrowTrendingUpIcon,
    CurrencyDollarIcon,
    UserGroupIcon,
} from "@heroicons/react/24/outline";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceDot,
} from "recharts";

// Financial Projections Data (Q1 2026 - Q4 2027)
// Realistic Seed path: Pre-revenue -> Launch -> $100k MRR
const projectionData = [
    { quarter: "Q1 '26", revenue: 0, label: "Pre-Rev" }, // Current: Jan 28, 2026
    { quarter: "Q2 '26", revenue: 0, label: "Beta" },
    { quarter: "Q3 '26", revenue: 5, label: "$5K" }, // Monetization On
    { quarter: "Q4 '26", revenue: 15, label: "$15K" },
    { quarter: "Q1 '27", revenue: 35, label: "$35K" },
    { quarter: "Q2 '27", revenue: 60, label: "$60K" },
    { quarter: "Q3 '27", revenue: 85, label: "$85K" },
    { quarter: "Q4 '27", revenue: 120, label: "$120K" }, // Strong Series A Target
];

const keyMetrics = [
    {
        icon: UserGroupIcon,
        label: "Current Developers",
        value: "100+",
        subtext: "Pre-launch beta users",
    },
    {
        icon: CurrencyDollarIcon,
        label: "Proj. Q4 '27 ARR",
        value: "$1.4M",
        subtext: "Series A Milestone",
    },
    {
        icon: ArrowTrendingUpIcon,
        label: "Growth Strategy",
        value: "PLG",
        subtext: "Bottom-up developer adoption",
    },
];

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-card border border-border/50 p-2 rounded-lg shadow-xl text-xs">
                <p className="font-semibold text-foreground mb-1">{label}</p>
                <p className="text-emerald-500 font-medium">
                    MRR: ${payload[0].value}k
                </p>
            </div>
        );
    }
    return null;
};

export function TractionSlide() {
    return (
        <div className="h-full flex flex-col p-8 md:p-12">
            {/* Header */}
            <div className="mb-6">
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">
                    Traction & Projections
                </span>
                <h2 className="text-2xl md:text-3xl font-bold mt-2">
                    From <span className="text-emerald-500">Day 1</span> to Scale.
                </h2>
                <p className="text-muted-foreground text-sm mt-2 max-w-2xl">
                    Currently serving 100+ beta developers. Projecting robust PLG-driven
                    growth to $1M+ ARR within 18 months of public launch.
                </p>
            </div>

            {/* Main Content: Chart + Metrics */}
            <div className="flex-1 flex flex-col gap-6 md:gap-8 min-h-0">
                {/* Top: Key Metrics Cards */}
                <div className="grid grid-cols-3 gap-4 shrink-0">
                    {keyMetrics.map((metric, index) => (
                        <div
                            key={index}
                            className="p-4 rounded-xl border border-border/50 bg-card hover:border-emerald-500/30 transition-all"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <span className="text-xs text-muted-foreground font-medium">
                                    {metric.label}
                                </span>
                                <metric.icon className="h-4 w-4 text-emerald-500" />
                            </div>
                            <div className="text-2xl md:text-3xl font-bold mb-1">
                                {metric.value}
                            </div>
                            <div className="text-[10px] md:text-xs text-emerald-500/80 font-medium">
                                {metric.subtext}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom: Revenue Chart (Recharts) */}
                <div className="flex-1 rounded-xl border border-border/50 bg-muted/10 p-6 flex flex-col relative min-h-0">
                    {/* Chart Label */}
                    <div className="absolute top-4 left-6 z-20">
                        <h3 className="text-sm font-semibold">Projected MRR</h3>
                        <p className="text-xs text-muted-foreground">in thousands (USD)</p>
                    </div>

                    <div className="flex-1 w-full min-h-0 mt-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={projectionData}
                                margin={{ top: 20, right: 10, left: -20, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="rgba(255,255,255,0.1)"
                                />
                                <XAxis
                                    dataKey="quarter"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                                    tickFormatter={(value) => `$${value}k`}
                                />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: "#10b981", strokeWidth: 1, strokeDasharray: "4 4" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                    activeDot={{ r: 6, fill: "#10b981", stroke: "#000", strokeWidth: 2 }}
                                />
                                {/* Highlight Q4 '27 Milestone */}
                                <ReferenceDot
                                    x="Q4 '27"
                                    y={120}
                                    r={5}
                                    fill="#10b981"
                                    stroke="#fff"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
