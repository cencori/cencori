'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface MetricCardWithLineChartProps {
    title: string;
    value: string | number;
    chartData: Array<{ label: string; value: number }>;
    trend?: number;
    format?: 'number' | 'currency' | 'percentage' | 'ms';
    lineColor?: string;
}

const chartConfig = {
    value: {
        label: 'Success Rate',
        color: 'hsl(var(--chart-2))',
    },
} satisfies ChartConfig;

export function MetricCardWithLineChart({
    title,
    value,
    chartData,
    trend,
    format = 'number',
    lineColor = 'hsl(142, 71%, 45%)', // Default to green
}: MetricCardWithLineChartProps) {
    const formatValue = (val: string | number) => {
        if (typeof val === 'string') return val;

        switch (format) {
            case 'currency':
                return `$${val.toFixed(6)}`;
            case 'percentage':
                return `${val}%`;
            case 'ms':
                return `${val}ms`;
            default:
                return val.toLocaleString();
        }
    };

    const isPositiveTrend = trend && trend > 0;
    const isNegativeTrend = trend && trend < 0;

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                {/* Header with Title and Value */}
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">{title}</p>
                        <div className="flex items-center gap-2">
                            <p className="text-3xl font-bold">{formatValue(value)}</p>
                            {trend !== undefined && trend !== 0 && (
                                <div
                                    className={cn(
                                        'flex items-center gap-1 px-2 py-1 rounded-md border-none text-xs font-medium',
                                        isPositiveTrend && 'text-green-500 bg-green-500/10',
                                        isNegativeTrend && 'text-red-500 bg-red-500/10'
                                    )}
                                >
                                    {isPositiveTrend ? (
                                        <TrendingUp className="h-3 w-3" />
                                    ) : (
                                        <TrendingDown className="h-3 w-3" />
                                    )}
                                    <span>{Math.abs(trend).toFixed(1)}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mini Line Chart */}
                {chartData.length > 0 && (
                    <div className="h-24 -mx-2">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <LineChart
                                accessibilityLayer
                                data={chartData}
                                margin={{
                                    left: 12,
                                    right: 12,
                                    top: 5,
                                    bottom: 5,
                                }}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.5} />
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tickFormatter={(value) => value.slice(0, 3)}
                                    hide
                                />
                                <YAxis domain={[0, 100]} hide />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Line
                                    dataKey="value"
                                    type="linear"
                                    stroke={lineColor}
                                    strokeWidth={2}
                                    dot={false}
                                    strokeDasharray="4 4"
                                    activeDot={{
                                        r: 4,
                                        fill: lineColor,
                                        stroke: 'var(--background)',
                                        strokeWidth: 2,
                                    }}
                                />
                            </LineChart>
                        </ChartContainer>
                    </div>
                )}
            </div>
        </TechnicalBorder>
    );
}
