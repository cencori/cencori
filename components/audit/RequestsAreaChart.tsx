'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
        <div className="rounded-md border border-border/40 bg-card p-4">
            <div className="mb-3">
                <h3 className="text-xs font-medium">Requests Over Time</h3>
                <p className="text-[10px] text-muted-foreground">Traffic analysis</p>
            </div>

            <div className="h-[200px] w-full">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <AreaChart
                        data={data}
                        margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.3} />
                        <XAxis
                            dataKey="timestamp"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={formatXAxis}
                            tick={{ fontSize: 10 }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={4}
                            tickCount={4}
                            tick={{ fontSize: 10 }}
                            width={30}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Area
                            dataKey="filtered"
                            type="monotone"
                            fill="var(--color-filtered)"
                            fillOpacity={0.3}
                            stroke="var(--color-filtered)"
                            strokeWidth={1.5}
                            stackId="a"
                        />
                        <Area
                            dataKey="success"
                            type="monotone"
                            fill="var(--color-success)"
                            fillOpacity={0.3}
                            stroke="var(--color-success)"
                            strokeWidth={1.5}
                            stackId="a"
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                    </AreaChart>
                </ChartContainer>
            </div>
        </div>
    );
}
