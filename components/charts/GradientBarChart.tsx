"use client";

import { Bar, BarChart, XAxis } from "recharts";
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

interface GradientBarChartProps {
    data?: Array<{ label: string; value: number }>;
    title?: string;
    description?: string;
}

export function GradientBarChart({
    data,
    title = "Activity",
    description = "Overview"
}: GradientBarChartProps) {
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
            color: "var(--chart-1)",
        },
    } satisfies ChartConfig;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData}>
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Bar
                            dataKey="value"
                            fill="var(--color-value)"
                            radius={4}
                            shape={<CustomGradientBar />}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

const CustomGradientBar = (props: React.SVGProps<SVGRectElement>) => {
    const { fill, x, y, width, height } = props;

    return (
        <>
            <defs>
                <linearGradient id="gradient-bar-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={fill} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={fill} stopOpacity={0.2} />
                </linearGradient>
            </defs>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="url(#gradient-bar-fill)"
                stroke="none"
                rx={4}
            />
        </>
    );
};
