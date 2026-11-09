"use client";

import { useCostFormat } from "@/hooks/useDisplayCurrency";
import { useId, useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ProjectOverviewStats {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  filteredRequests: number;
  totalCost: string;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatency: number;
}

export interface ProjectOverviewChartPoint {
  date: string;
  count: number;
  cost: number;
  tokens: number;
  promptTokens: number;
  completionTokens: number;
  successful: number;
  errors: number;
  filtered: number;
}

const PERIODS = [
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
] as const;

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type MetricChartPoint = ProjectOverviewChartPoint & { successRate: number };

export interface MetricSeries {
  /** Field on each data point to plot; every point also needs a `date` label. */
  key: string;
  label: string;
  color: string;
  value: string;
}

export interface MetricCardConfig {
  title: string;
  detail: string;
  series: MetricSeries[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  domainMax?: number;
}

function MetricChart({
  config,
  data,
  hasData,
  reduceMotion,
  className,
}: {
  config: MetricCardConfig;
  data: object[];
  hasData: boolean;
  reduceMotion: boolean | null;
  className?: string;
}) {
  const gradientPrefix = `metric-gradient-${useId().replace(/:/g, "")}`;
  const chartConfig = Object.fromEntries(
    config.series.map((item) => [item.key, { label: item.label, color: item.color }]),
  ) satisfies ChartConfig;
  const lastIndex = data.length - 1;

  return (
    <div className={cn("relative", className)}>
      <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
        <AreaChart data={data} margin={{ left: 4, right: 16, top: 12, bottom: 0 }}>
          <defs>
            {config.series.map((item) => (
              <linearGradient key={item.key} id={`${gradientPrefix}-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${item.key})`} stopOpacity={0.22} />
                <stop offset="100%" stopColor={`var(--color-${item.key})`} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={12}
            minTickGap={28}
            interval="preserveStartEnd"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            width={56}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickCount={6}
            domain={[0, config.domainMax ?? "auto"]}
            tickFormatter={(value) => config.formatAxis(Number(value))}
            tick={{ fontSize: 11 }}
          />
          <ChartTooltip
            cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
            content={
              <ChartTooltipContent
                indicator="dot"
                formatter={(chartValue, name) => {
                  const item = config.series.find((series) => series.key === name);
                  return (
                    <div className="flex min-w-32 items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2 rounded-[1px]" style={{ backgroundColor: item?.color }} />
                        {item?.label ?? name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {config.formatValue(Number(chartValue))}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          {config.series.map((item) => (
            <Area
              key={item.key}
              type="linear"
              dataKey={item.key}
              stroke={`var(--color-${item.key})`}
              strokeWidth={1.75}
              fill={`url(#${gradientPrefix}-${item.key})`}
              dot={(props: { cx?: number; cy?: number; index?: number }) =>
                props.index === lastIndex && hasData && props.cx != null && props.cy != null ? (
                  <circle
                    key={`end-${item.key}`}
                    cx={props.cx}
                    cy={props.cy}
                    r={5}
                    fill="var(--background)"
                    stroke={item.color}
                    strokeWidth={2.25}
                  />
                ) : (
                  <g key={`dot-${item.key}-${props.index}`} />
                )
              }
              activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
              isAnimationActive={!reduceMotion}
              animationDuration={260}
            />
          ))}
        </AreaChart>
      </ChartContainer>
      {!hasData && (
        <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
          <span className="rounded-md bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            No data for this period
          </span>
        </div>
      )}
    </div>
  );
}

export function MetricHeaderSummary({ config }: { config: MetricCardConfig }) {
  const legend = config.series.map((item) => (
    <span key={item.key} className="flex items-center gap-1.5 text-xs">
      <span className="size-2 shrink-0 rounded-[1px]" style={{ backgroundColor: item.color }} />
      {config.series.length > 1 && <span className="text-muted-foreground">{item.label}</span>}
      <span className="font-mono font-medium tabular-nums text-foreground">{item.value}</span>
    </span>
  ));

  // Title and headline value sit on the left; the secondary info sits on the
  // right edge. Multi-series cards lead with the combined total and put the
  // per-series legend on the right; single-series cards lead with their
  // value and put the detail on the right.
  const isMultiSeries = config.series.length > 1;

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-center gap-x-3">
        <p className="text-sm font-medium tracking-[-0.01em] text-foreground">{config.title}</p>
        {isMultiSeries ? (
          <span className="font-mono text-xs font-medium tabular-nums text-foreground">{config.detail}</span>
        ) : (
          legend
        )}
      </div>
      {isMultiSeries ? (
        <div className="flex items-center gap-x-4">{legend}</div>
      ) : (
        <span className="text-xs text-muted-foreground">{config.detail}</span>
      )}
    </div>
  );
}

/** The card chrome every overview chart shares: header summary + body. */
export function MetricCardFrame({
  config,
  loading,
  className,
  children,
}: {
  config: MetricCardConfig;
  loading: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article className={cn("flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/40 bg-muted/30", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border/40 px-5 py-3.5">
        {loading ? <Skeleton className="h-4 w-40 rounded-sm" /> : <MetricHeaderSummary config={config} />}
      </header>
      {loading ? (
        <div className="h-[17rem] p-5">
          <Skeleton className="h-full w-full rounded-sm" />
        </div>
      ) : (
        children
      )}
    </article>
  );
}

export function MetricCard({
  config,
  data,
  loading,
  hasData,
  reduceMotion,
  className,
}: {
  config: MetricCardConfig;
  data: object[];
  loading: boolean;
  hasData: boolean;
  reduceMotion: boolean | null;
  className?: string;
}) {
  return (
    <MetricCardFrame config={config} loading={loading} className={className}>
      <MetricChart
        config={config}
        data={data}
        hasData={hasData}
        reduceMotion={reduceMotion}
        className="h-[17rem] px-2 pb-3 pt-2"
      />
    </MetricCardFrame>
  );
}

export function ProjectOverviewCharts({
  stats,
  chartData,
  period,
  loading,
}: {
  stats: ProjectOverviewStats | null;
  chartData: ProjectOverviewChartPoint[];
  period: string;
  loading: boolean;
}) {
  const { formatCost, formatCostAxis } = useCostFormat();
  const reduceMotion = useReducedMotion();
  const totalRequests = stats?.totalRequests ?? 0;
  const successRate = totalRequests
    ? ((stats?.successfulRequests ?? 0) / totalRequests) * 100
    : 0;
  const totalCost = Number(stats?.totalCost ?? 0);
  const periodLabel = PERIODS.find((option) => option.value === period)?.label ?? "7 days";
  const metricChartData = useMemo<MetricChartPoint[]>(
    () => chartData.map((point) => ({
      ...point,
      successRate: point.count > 0 ? (point.successful / point.count) * 100 : 0,
    })),
    [chartData],
  );
  const hasMetricData = metricChartData.some((point) => point.count > 0);
  const metrics: MetricCardConfig[] = [
    {
      title: "Requests",
      detail: `${(stats?.successfulRequests ?? 0).toLocaleString()} successful`,
      series: [{ key: "count", label: "Requests", color: "#f59e0b", value: totalRequests.toLocaleString() }],
      formatValue: (value) => value.toLocaleString(),
      formatAxis: (value) => compactNumber.format(value),
    },
    {
      title: "Success rate",
      detail: `${(stats?.errorRequests ?? 0).toLocaleString()} errors`,
      series: [{ key: "successRate", label: "Success rate", color: "#22c55e", value: `${successRate.toFixed(1)}%` }],
      formatValue: (value) => `${value.toFixed(1)}%`,
      formatAxis: (value) => `${value.toFixed(0)}%`,
      domainMax: 100,
    },
    {
      title: "Spend",
      detail: `${periodLabel.toLowerCase()} total`,
      series: [{ key: "cost", label: "Spend", color: "#f97316", value: formatCost(totalCost) }],
      formatValue: formatCost,
      formatAxis: formatCostAxis,
    },
    {
      title: "Tokens",
      detail: compactNumber.format(stats?.totalTokens ?? 0),
      series: [
        { key: "promptTokens", label: "Input", color: "#3b82f6", value: compactNumber.format(stats?.totalPromptTokens ?? 0) },
        { key: "completionTokens", label: "Output", color: "#a855f7", value: compactNumber.format(stats?.totalCompletionTokens ?? 0) },
      ],
      formatValue: (value) => compactNumber.format(value),
      formatAxis: (value) => compactNumber.format(value),
    },
  ];

  return (
    <section aria-label="Project usage charts" className="grid gap-4 lg:grid-cols-2">
      {metrics.map((metric) => (
        <MetricCard
          key={metric.title}
          config={metric}
          loading={loading}
          data={metricChartData}
          hasData={hasMetricData}
          reduceMotion={reduceMotion}
        />
      ))}
    </section>
  );
}

