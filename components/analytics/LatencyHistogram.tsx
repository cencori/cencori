'use client';

import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface LatencyHistogramProps {
    data: {
        p50: number;
        p75: number;
        p90: number;
        p95: number;
        p99: number;
    };
}

const chartConfig = {
    latency: {
        label: 'Latency',
    },
} satisfies ChartConfig;

// Color gradient from green (fast) to red (slow)
const getLatencyColor = (percentile: string): string => {
    switch (percentile) {
        case 'P50': return 'hsl(142, 71%, 45%)'; // Green
        case 'P75': return 'hsl(82, 71%, 45%)';  // Yellow-green
        case 'P90': return 'hsl(48, 96%, 53%)';  // Yellow
        case 'P95': return 'hsl(24, 96%, 53%)';  // Orange
        case 'P99': return 'hsl(0, 84%, 60%)';   // Red
        default: return 'hsl(217, 91%, 60%)';
    }
};

export function LatencyHistogram({ data }: LatencyHistogramProps) {
    const chartData = [
        { name: 'P50', value: data.p50, fill: getLatencyColor('P50') },
        { name: 'P75', value: data.p75, fill: getLatencyColor('P75') },
        { name: 'P90', value: data.p90, fill: getLatencyColor('P90') },
        { name: 'P95', value: data.p95, fill: getLatencyColor('P95') },
        { name: 'P99', value: data.p99, fill: getLatencyColor('P99') },
    ];

    const hasData = chartData.some(item => item.value > 0);

    if (!hasData) {
        return (
            <div className="rounded-lg border border-border/40 bg-card p-4">
                <div className="mb-3">
                    <h3 className="text-xs font-medium">Latency Distribution</h3>
                    <p className="text-[10px] text-muted-foreground">Response time percentiles</p>
                </div>
                <div className="h-[180px] flex items-center justify-center">
                    <p className="text-xs text-muted-foreground">No data</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg border border-border/40 bg-card p-4">
            <div className="mb-3">
                <h3 className="text-xs font-medium">Latency Distribution</h3>
                <p className="text-[10px] text-muted-foreground">
                    P50: <span className="font-mono font-medium">{data.p50}ms</span>
                    {' • '}
                    P95: <span className="font-mono font-medium">{data.p95}ms</span>
                </p>
            </div>

            <div className="h-[140px]">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                        >
                            <XAxis
                                dataKey="name"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10 }}
                                width={35}
                                tickFormatter={(value) => `${value}`}
                            />
                            <ChartTooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                content={
                                    <ChartTooltipContent
                                        formatter={(value, name) => (
                                            <span className="font-mono font-medium">
                                                {name}: {value}ms
                                            </span>
                                        )}
                                    />
                                }
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>

            {/* Percentile labels */}
            <div className="mt-3 flex justify-between text-[10px]">
                {chartData.map((item, index) => (
                    <div key={index} className="text-center">
                        <div
                            className="w-2 h-2 rounded-full mx-auto mb-0.5"
                            style={{ backgroundColor: item.fill }}
                        />
                        <span className="font-mono text-muted-foreground">{item.value}ms</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
