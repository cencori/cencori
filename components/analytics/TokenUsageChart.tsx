'use client';

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface TokenData {
    timestamp: string;
    tokens: number;
}

interface TokenUsageChartProps {
    data: TokenData[];
    groupBy: 'hour' | 'day';
}

const chartConfig = {
    tokens: {
        label: 'Tokens',
        color: 'hsl(262, 83%, 58%)',
    },
} satisfies ChartConfig;

export function TokenUsageChart({ data, groupBy }: TokenUsageChartProps) {
    const formatXAxis = (timestamp: string) => {
        // For 10-minute intervals (format: "HH:MM")
        if (timestamp.match(/^\d{2}:\d{2}$/)) {
            return timestamp;
        }
        // For hourly (format: "YYYY-MM-DD HH:00")
        if (timestamp.includes(' ')) {
            return timestamp.split(' ')[1];
        }
        // For daily (format: "YYYY-MM-DD")
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;
        return date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
        });
    };

    const totalTokens = data.reduce((sum, d) => sum + d.tokens, 0);

    return (
        <div className="rounded-lg border border-border/40 bg-card p-5">
            <div className="mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Token Usage</h3>
                    <span className="text-xs font-mono text-muted-foreground">
                        {totalTokens.toLocaleString()} total
                    </span>
                </div>
                <p className="text-[11px] text-muted-foreground">Tokens consumed over time</p>
            </div>

            <div className="h-[200px] w-full">
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
                            width={45}
                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                        />
                        <ChartTooltip
                            cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                            content={<ChartTooltipContent />}
                        />
                        <Line
                            dataKey="tokens"
                            type="linear"
                            stroke="var(--color-tokens)"
                            strokeWidth={2}
                            dot={{
                                r: 4,
                                fill: 'var(--color-tokens)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                            activeDot={{
                                r: 6,
                                fill: 'var(--color-tokens)',
                                stroke: 'hsl(var(--card))',
                                strokeWidth: 2,
                            }}
                        />
                    </LineChart>
                </ChartContainer>
            </div>
        </div>
    );
}
