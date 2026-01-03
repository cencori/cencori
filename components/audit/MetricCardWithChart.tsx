'use client';

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
    trend?: number;
    format?: 'number' | 'currency' | 'percentage' | 'ms';
}

const chartConfig = {
    value: {
        label: 'Requests',
        color: 'hsl(142 76% 36%)',
    },
} satisfies ChartConfig;

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

    // Get time range display from chart data
    const getTimeRangeDisplay = () => {
        if (chartData.length === 0) return null;
        const first = chartData[0]?.label;
        const last = chartData[chartData.length - 1]?.label;
        if (first === last) return first;
        return `${first} - ${last}`;
    };

    return (
        <div className="rounded-md border border-border/40 bg-card p-4">
            <div className="mb-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{title}</p>
                {chartData.length > 0 && (
                    <p className="text-[9px] text-muted-foreground/60 font-mono mt-0.5">
                        {getTimeRangeDisplay()}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2 mb-2">
                <p className="text-xl font-semibold font-mono">{formatValue(value)}</p>
                {trend !== undefined && trend !== 0 && (
                    <div
                        className={cn(
                            'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                            isPositiveTrend && 'text-emerald-500 bg-emerald-500/10',
                            isNegativeTrend && 'text-red-500 bg-red-500/10'
                        )}
                    >
                        {isPositiveTrend ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                        ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                        )}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                    </div>
                )}
            </div>

            {chartData.length > 0 && (
                <div className="h-24">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart
                            data={chartData}
                            margin={{ top: 8, right: 0, bottom: 16, left: 0 }}
                        >
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                                tickMargin={4}
                                interval="preserveStartEnd"
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar
                                dataKey="value"
                                fill="var(--color-value)"
                                radius={[2, 2, 0, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                </div>
            )}
        </div>
    );
}
