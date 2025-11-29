'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
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
    total: {
        label: 'Total Requests',
        color: 'hsl(var(--primary))',
    },
    success: {
        label: 'Successful',
        color: 'hsl(142, 71%, 45%)', // Green
    },
    filtered: {
        label: 'Filtered/Blocked',
        color: 'hsl(0, 84%, 60%)', // Red
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
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold leading-none tracking-tight">
                            Requests Over Time
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Traffic analysis for the selected period
                        </p>
                    </div>
                </div>

                <div className="h-[350px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <AreaChart
                            accessibilityLayer
                            data={data}
                            margin={{
                                left: 12,
                                right: 12,
                            }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="timestamp"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={formatXAxis}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickCount={5}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <Area
                                dataKey="filtered"
                                type="natural"
                                fill="var(--color-filtered)"
                                fillOpacity={0.4}
                                stroke="var(--color-filtered)"
                                stackId="a"
                            />
                            <Area
                                dataKey="success"
                                type="natural"
                                fill="var(--color-success)"
                                fillOpacity={0.4}
                                stroke="var(--color-success)"
                                stackId="a"
                            />
                            {/* We don't stack 'total' because it's the sum, but we might want to show it as a line or just rely on the stacked components. 
                                Actually, usually 'total' = success + filtered + error. 
                                Let's stack success and filtered (and maybe error if we had it mapped) to show the composition.
                            */}
                            <ChartLegend content={<ChartLegendContent />} />
                        </AreaChart>
                    </ChartContainer>
                </div>
            </div>
        </TechnicalBorder>
    );
}
