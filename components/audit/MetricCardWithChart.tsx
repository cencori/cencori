'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Bar, BarChart, XAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface MetricCardWithChartProps {
    title: string;
    value: string | number;
    chartData: Array<{ label: string; value: number }>;
    trend?: number; // Percentage change (e.g., 5.2 for 5.2% increase)
    format?: 'number' | 'currency' | 'percentage' | 'ms';
}

const chartConfig = {
    value: {
        label: 'Requests',
        color: 'hsl(var(--chart-1))',
    },
} satisfies ChartConfig;

const DottedBackgroundPattern = () => {
    return (
        <pattern
            id="metric-card-pattern-dots"
            x="0"
            y="0"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
        >
            <circle
                className="dark:text-muted/40 text-muted"
                cx="2"
                cy="2"
                r="1"
                fill="currentColor"
            />
        </pattern>
    );
};

export function MetricCardWithChart({
    title,
    value,
    chartData,
    trend,
    format = 'number',
}: MetricCardWithChartProps) {
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

                {/* Mini Bar Chart */}
                {chartData.length > 0 && (
                    <div className="h-24 -mx-2">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <BarChart
                                accessibilityLayer
                                data={chartData}
                                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                            >
                                <rect
                                    x="0"
                                    y="0"
                                    width="100%"
                                    height="100%"
                                    fill="url(#metric-card-pattern-dots)"
                                />
                                <defs>
                                    <DottedBackgroundPattern />
                                </defs>
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    tickMargin={8}
                                    axisLine={false}
                                    tickFormatter={(value) => value.slice(0, 3)}
                                    className="text-xs"
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Bar
                                    dataKey="value"
                                    fill="hsl(142.1 76.2% 36.3"
                                    radius={4}
                                />
                            </BarChart>
                        </ChartContainer>
                    </div>
                )}
            </div>
        </TechnicalBorder>
    );
}
