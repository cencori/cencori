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

interface HatchedBarChartProps {
    data?: Array<{ label: string; value: number }>;
    title?: string;
    description?: string;
}

export function HatchedBarChart({
    data,
    title = "Cost Analysis",
    description = "Total cost breakdown"
}: HatchedBarChartProps) {
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
                            shape={<CustomPatternBar />}
                        />
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}

const CustomPatternBar = (props: React.SVGProps<SVGRectElement>) => {
    const { fill, x, y, width, height } = props;

    return (
        <>
            <defs>
                <pattern
                    id="hatched-bar-pattern"
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                >
                    <line
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="8"
                        stroke={fill}
                        strokeWidth="4"
                    />
                </pattern>
            </defs>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill="url(#hatched-bar-pattern)"
                stroke="none"
            />
        </>
    );
};
