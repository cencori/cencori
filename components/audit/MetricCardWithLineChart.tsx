'use client';

import { ReactNode } from 'react';
import { Line, LineChart, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface MetricCardWithLineChartProps {
    title: string;
    subtitle?: string;
    value: string | number;
    chartData: Array<{ label: string; value: number }>;
    format?: 'number' | 'currency' | 'percentage' | 'ms';
    lineColor?: string;
    icon?: ReactNode;
    lastUpdate?: string;
}

export function MetricCardWithLineChart({
    title,
    subtitle,
    value,
    chartData,
    format = 'number',
    lineColor = 'hsl(142, 71%, 45%)',
    icon,
    lastUpdate,
}: MetricCardWithLineChartProps) {
    const chartConfig = {
        value: {
            label: 'Value',
            color: lineColor,
        },
    } satisfies ChartConfig;

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

    return (
        <div className="rounded-xl border border-border/40 bg-card p-5">
            {/* Header with icon and title */}
            <div className="flex items-center gap-2.5 mb-2">
                {icon && (
                    <div className="text-muted-foreground">
                        {icon}
                    </div>
                )}
                <span className="text-sm font-medium">{title}</span>
            </div>

            {/* Subtitle */}
            {subtitle && (
                <p className="text-xs text-muted-foreground mb-1">{subtitle}</p>
            )}

            {/* Value */}
            <p className="text-3xl font-semibold mb-1">{formatValue(value)}</p>

            {/* Last update time */}
            {lastUpdate && (
                <p className="text-xs text-muted-foreground mb-2">{lastUpdate}</p>
            )}

            {/* Chart */}
            {chartData.length > 0 && (
                <div className="h-28 mt-4">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <LineChart
                            data={chartData}
                            margin={{ top: 5, right: 5, bottom: 20, left: 0 }}
                        >
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickMargin={8}
                                interval="preserveStartEnd"
                            />
                            <YAxis hide />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={lineColor}
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ChartContainer>
                </div>
            )}
        </div>
    );
}
