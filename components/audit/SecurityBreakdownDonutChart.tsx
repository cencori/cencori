'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { Pie, PieChart, Label } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from '@/components/ui/chart';

interface SecurityBreakdownProps {
    data: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

const chartConfig = {
    critical: {
        label: 'Critical',
        color: 'hsl(0, 84%, 60%)', // Red
    },
    high: {
        label: 'High',
        color: 'hsl(24, 96%, 53%)', // Orange
    },
    medium: {
        label: 'Medium',
        color: 'hsl(48, 96%, 53%)', // Yellow
    },
    low: {
        label: 'Low',
        color: 'hsl(240, 5%, 65%)', // Zinc
    },
} satisfies ChartConfig;

export function SecurityBreakdownDonutChart({ data }: SecurityBreakdownProps) {
    const chartData = [
        { severity: 'critical', count: data.critical, fill: 'var(--color-critical)' },
        { severity: 'high', count: data.high, fill: 'var(--color-high)' },
        { severity: 'medium', count: data.medium, fill: 'var(--color-medium)' },
        { severity: 'low', count: data.low, fill: 'var(--color-low)' },
    ].filter(item => item.count > 0);

    const totalIncidents = Object.values(data).reduce((acc, curr) => acc + curr, 0);

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold leading-none tracking-tight">
                            Security Incidents
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Breakdown by severity
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-[250px]">
                    {totalIncidents === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p className="text-sm">No security incidents 🎉</p>
                        </div>
                    ) : (
                        <ChartContainer
                            config={chartConfig}
                            className="mx-auto aspect-square max-h-[250px]"
                        >
                            <PieChart>
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent hideLabel />}
                                />
                                <Pie
                                    data={chartData}
                                    dataKey="count"
                                    nameKey="severity"
                                    innerRadius={60}
                                    outerRadius={80}
                                    strokeWidth={5}
                                >
                                    <Label
                                        content={({ viewBox }) => {
                                            if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                                return (
                                                    <text
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                    >
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={viewBox.cy}
                                                            className="fill-foreground text-3xl font-bold"
                                                        >
                                                            {totalIncidents.toLocaleString()}
                                                        </tspan>
                                                        <tspan
                                                            x={viewBox.cx}
                                                            y={(viewBox.cy || 0) + 24}
                                                            className="fill-muted-foreground text-xs"
                                                        >
                                                            Incidents
                                                        </tspan>
                                                    </text>
                                                )
                                            }
                                        }}
                                    />
                                </Pie>
                                <ChartLegend content={<ChartLegendContent />} />
                            </PieChart>
                        </ChartContainer>
                    )}
                </div>
            </div>
        </TechnicalBorder>
    );
}
