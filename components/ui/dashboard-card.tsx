'use client';

import { ReactNode } from 'react';
import { Bar, BarChart, XAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface DashboardCardProps {
    /** Title displayed in the header next to the icon */
    title: string;
    /** Subtitle/description below the title */
    subtitle?: string;
    /** Icon to display (pass a Heroicon component) */
    icon?: ReactNode;
    /** Main value to display prominently */
    value: string | number;
    /** Additional description below the value */
    description?: string;
    /** Format for the value display */
    format?: 'number' | 'currency' | 'percentage' | 'ms';
    /** Chart data for the bar chart */
    chartData?: Array<{ label: string; value: number }>;
    /** Color for the chart bars */
    chartColor?: string;
    /** Custom chart config label */
    chartLabel?: string;
    /** Custom tooltip formatter */
    tooltipFormatter?: (value: number) => string;
    /** Children for custom content instead of chart */
    children?: ReactNode;
    /** Additional class names */
    className?: string;
}

export function DashboardCard({
    title,
    subtitle,
    icon,
    value,
    description,
    format = 'number',
    chartData,
    chartColor = 'hsl(142 76% 36%)',
    chartLabel = 'Value',
    tooltipFormatter,
    children,
    className = '',
}: DashboardCardProps) {
    const formatValue = (val: string | number) => {
        if (typeof val === 'string') return val;

        switch (format) {
            case 'currency':
                return val >= 1 ? `$${val.toFixed(2)}` : `$${val.toFixed(6)}`;
            case 'percentage':
                return `${val}%`;
            case 'ms':
                return `${val.toLocaleString()}ms`;
            default:
                return val.toLocaleString();
        }
    };

    const chartConfig: ChartConfig = {
        value: {
            label: chartLabel,
            color: chartColor,
        },
    };

    return (
        <div className={`rounded-xl border border-border/40 bg-card p-5 ${className}`}>
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

            {/* Description */}
            {description && (
                <p className="text-xs text-muted-foreground mb-3">{description}</p>
            )}

            {/* Chart or custom children */}
            {children ? (
                <div className="mt-4">{children}</div>
            ) : chartData && chartData.length > 0 ? (
                <div className="h-28 mt-4">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart
                            data={chartData}
                            margin={{ top: 0, right: 0, bottom: 20, left: 0 }}
                        >
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickMargin={8}
                                interval="preserveStartEnd"
                            />
                            <ChartTooltip
                                cursor={false}
                                content={
                                    <ChartTooltipContent
                                        hideLabel
                                        formatter={tooltipFormatter ? (val) => tooltipFormatter(Number(val)) : undefined}
                                    />
                                }
                            />
                            <Bar
                                dataKey="value"
                                fill={chartColor}
                                radius={[3, 3, 0, 0]}
                            />
                        </BarChart>
                    </ChartContainer>
                </div>
            ) : null}
        </div>
    );
}
