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
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp } from "lucide-react";

interface GradientBarMultipleChartProps {
  data?: Array<{ label: string; value1: number; value2: number }>;
  title?: string;
  description?: string;
  dataKey1?: string;
  dataKey2?: string;
 dataLabel1?: string;
  dataLabel2?: string;
  trend?: { value: number; direction: 'up' | 'down' };
}

export function GradientBarMultipleChart({
  data,
  title = "Bar Chart - Multiple",
  description = "Comparison",
  dataKey1 = "value1",
  dataKey2 = "value2",
  dataLabel1 = "Series 1",
  dataLabel2 = "Series 2",
  trend
}: GradientBarMultipleChartProps) {
  // Default mock data if no data provided
  const defaultData = [
    { label: "Jan", value1: 186, value2: 80 },
    { label: "Feb", value1: 305, value2: 200 },
    { label: "Mar", value1: 237, value2: 120 },
    { label: "Apr", value1: 73, value2: 190 },
    { label: "May", value1: 209, value2: 130 },
    { label: "Jun", value1: 214, value2: 140 },
  ];

  const chartData = data || defaultData;

  const chartConfig = {
    [dataKey1]: {
      label: dataLabel1,
      color: "var(--chart-1)",
    },
    [dataKey2]: {
      label: dataLabel2,
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
              className={`${
                trend.direction === 'up' 
                  ? 'text-green-500 bg-green-500/10' 
                  : 'text-red-500 bg-red-500/10'
              } border-none ml-2`}
            >
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{trend.direction === 'up' ? '+' : '-'}{Math.abs(trend.value)}%</span>
            </Badge>
          )}
        </CardTitle>
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
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" hideLabel />}
            />
            <Bar
              dataKey={dataKey1}
              shape={<CustomGradientBar />}
              fill={`var(--color-${dataKey1})`}
            />
            <Bar
              dataKey={dataKey2}
              shape={<CustomGradientBar />}
              fill={`var(--color-${dataKey2})`}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const CustomGradientBar = (
  props: React.SVGProps<SVGRectElement> & { dataKey?: string }
) => {
  const { fill, x, y, width, height, dataKey } = props;

  return (
    <>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        stroke="none"
        fill={`url(#gradient-multiple-bar-pattern-${dataKey})`}
      />
      <rect x={x} y={y} width={width} height={2} stroke="none" fill={fill} />
      <defs>
        <linearGradient
          id={`gradient-multiple-bar-pattern-${dataKey}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={fill} stopOpacity={0.5} />
          <stop offset="100%" stopColor={fill} stopOpacity={0} />
        </linearGradient>
      </defs>
    </>
  );
};
