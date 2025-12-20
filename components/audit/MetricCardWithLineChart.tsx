'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Line, LineChart } from 'recharts';
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
    yAxisDomain?: [number, number];
}

const chartConfig = {
    value: {
        label: 'Value',
        color: 'hsl(142 76% 36%)',
    },
} satisfies ChartConfig;

export function MetricCardWithLineChart({
    title,
    value,
    chartData,
    trend,
    format = 'number',
    lineColor = 'hsl(142, 71%, 45%)',
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
        <div className="rounded-md border border-border/40 bg-card p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
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
                <div className="h-12">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <LineChart
                            data={chartData}
                            margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                        >
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Line
                                dataKey="value"
                                type="monotone"
                                stroke={lineColor}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{
                                    r: 3,
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
    );
}
