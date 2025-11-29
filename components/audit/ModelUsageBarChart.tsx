'use client';

import { TechnicalBorder } from '@/components/landing/TechnicalBorder';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

interface ModelUsageProps {
    data: Record<string, number>;
}

const chartConfig = {
    requests: {
        label: 'Requests',
        color: 'hsl(var(--primary))',
    },
} satisfies ChartConfig;

export function ModelUsageBarChart({ data }: ModelUsageProps) {
    const chartData = Object.entries(data).map(([model, count]) => ({
        model: model.replace('gemini-', ''),
        requests: count,
        fill: 'var(--color-requests)',
    }));

    return (
        <TechnicalBorder className="h-full">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold leading-none tracking-tight">
                            Model Usage
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Distribution of requests by model
                        </p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <BarChart
                            accessibilityLayer
                            data={chartData}
                            margin={{ top: 20 }}
                        >
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="model"
                                tickLine={false}
                                tickMargin={10}
                                axisLine={false}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tickMargin={10}
                            />
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel />}
                            />
                            <Bar
                                dataKey="requests"
                                fill="var(--color-requests)"
                                radius={8}
                            />
                        </BarChart>
                    </ChartContainer>
                </div>
            </div>
        </TechnicalBorder>
    );
}
