'use client';

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface TrendData {
    timestamp: string;
    total: number;
    success: number;
    filtered: number;
    blocked_output: number;
    error: number;
}

interface RequestsAreaChartProps {
    data: TrendData[];
    groupBy: 'hour' | 'day';
}

const chartConfig = {
    success: {
        label: 'Successful',
        color: 'hsl(142, 71%, 45%)',
    },
    filtered: {
        label: 'Filtered',
        color: 'hsl(0, 84%, 60%)',
    },
} satisfies ChartConfig;

export function RequestsAreaChart({ data, groupBy }: RequestsAreaChartProps) {
    const formatXAxis = (timestamp: string) => {
        if (groupBy === 'hour') {
            return timestamp.split(' ')[1] || timestamp;
        }
        return new Date(timestamp).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    };

    return (
        <div className="rounded-lg border border-border/40 bg-card p-5">
            <div className="mb-4">
                <h3 className="text-sm font-medium">Requests Over Time</h3>
                <p className="text-[11px] text-muted-foreground">Traffic analysis</p>
            </div>

            <div className="h-[280px] w-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <LineChart
                        data={data}
                        margin={{ left: 0, right: 12, top: 12, bottom: 0 }}
                    >
                        <CartesianGrid
                            horizontal={true}
                            vertical={false}
                            strokeDasharray="0"
                            strokeOpacity={0.15}
                            stroke="hsl(var(--muted-foreground))"
                        />
                        <XAxis
                            dataKey="timestamp"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={12}
                            tickFormatter={formatXAxis}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickCount={4}
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            width={35}
                        />
                        <ChartTooltip
                            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Line
                            dataKey="success"
                            type="linear"
                            stroke="var(--color-success)"
                            strokeWidth={2}
                            dot={{
                                r: 4,
                                fill: 'var(--color-success)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                            activeDot={{
                                r: 6,
                                fill: 'var(--color-success)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                        />
                        <Line
                            dataKey="filtered"
                            type="linear"
                            stroke="var(--color-filtered)"
                            strokeWidth={2}
                            strokeDasharray="6 4"
                            dot={{
                                r: 4,
                                fill: 'var(--color-filtered)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                            activeDot={{
                                r: 6,
                                fill: 'var(--color-filtered)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </LineChart>
                </ChartContainer>
            </div>
        </div>
    );
}
