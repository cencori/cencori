"use client";

import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface DottedLineChartProps {
    data?: Array<{ label: string; value: number }>;
    title?: string;
    description?: string;
    trend?: { value: number; direction: 'up' | 'down' };
}

export function DottedLineChart({
    data,
    title = "Dotted Line Chart",
    description = "Trend over time",
    trend
}: DottedLineChartProps) {
    const defaultData = [
        { label: "January", value: 186 },
        { label: "February", value: 305 },
        { label: "March", value: 237 },
        { label: "April", value: 73 },
        { label: "May", value: 209 },
        { label: "June", value: 214 },
    ];

    const chartData = data || defaultData;

    const chartConfig = {
        value: {
            label: "Value",
            color: "var(--chart-2)",
        },
    } satisfies ChartConfig;

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {title}
                    {trend && (
                        <Badge
                            variant="outline"
                            className="text-green-500 bg-green-500/10 border-none ml-2"
                        >
                            <TrendingUp className="h-4 w-4" />
                            <span>{trend.value}%</span>
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <LineChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                            dataKey="value"
                            type="linear"
                            stroke="var(--color-value)"
                            dot={false}
                            strokeDasharray="4 4"
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
