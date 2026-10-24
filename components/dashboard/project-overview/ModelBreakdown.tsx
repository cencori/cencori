"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  MetricCard,
  MetricCardFrame,
  type MetricCardConfig,
} from "@/components/dashboard/project-overview/ProjectOverviewDashboard";
import { fetchJsonWithFeatureGate, isFeatureGateError } from "@/lib/feature-gate-client";
import { getProviderLogoMark } from "@/components/dashboard/ProviderLogo";
import { SUPPORTED_PROVIDERS, detectProviderFromModel, getModel } from "@/lib/providers/config";

const PROVIDER_NAMES = new Map(SUPPORTED_PROVIDERS.map((provider) => [provider.id, provider.name]));
// Provider names are short; a narrower axis starts the bars under the header title.
const PROVIDER_LABEL_WIDTH = 112;
// Provider labels longer than "Maximo AI" are cut with an ellipsis.
const PROVIDER_NAME_MAX = "Maximo AI".length;
// Bars start under the header's value; longer model names truncate (full name on hover).
const MODEL_LABEL_WIDTH = 120;

type BarLabelKind = "provider" | "model";

// Models no longer in the catalog (retired or renamed) still show up in usage
// history. Recognise their family by id prefix so they keep a logo and a
// readable name. Display-only: routing uses the catalog lookup.
const MODEL_FAMILY_PROVIDERS: Array<[prefix: string, provider: string]> = [
  ["deepseek", "deepseek"],
  ["glm", "zai"],
  ["qwen", "qwen"],
  ["grok", "xai"],
  ["llama", "meta"],
  ["gemma", "google"],
  ["gemini", "google"],
  ["claude", "anthropic"],
  ["gpt", "openai"],
  ["o1", "openai"],
  ["o3", "openai"],
  ["o4", "openai"],
  ["mistral", "mistral"],
  ["codestral", "mistral"],
  ["command", "cohere"],
  ["sonar", "perplexity"],
  ["maximo", "maximo"],
  ["jev", "typesafe"],
];

const MODEL_NAME_WORDS: Record<string, string> = {
  deepseek: "DeepSeek",
  glm: "GLM",
  gpt: "GPT",
  oss: "OSS",
  qwen: "Qwen",
};

function modelFamilyProvider(id: string): string | undefined {
  const lower = id.toLowerCase();
  return MODEL_FAMILY_PROVIDERS.find(([prefix]) => lower.startsWith(prefix))?.[1];
}

/** "deepseek-v4-flash" → "DeepSeek V4 Flash". */
function prettifyModelId(id: string): string {
  return id
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => MODEL_NAME_WORDS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveBarLabel(kind: BarLabelKind, id: string): { name: string; logo: React.ReactNode | null } {
  if (id === "Other") return { name: "Other", logo: null };
  if (kind === "provider") {
    return { name: PROVIDER_NAMES.get(id) ?? id, logo: getProviderLogoMark(id, 14) };
  }
  const catalogModel = getModel(id);
  const provider = catalogModel ? detectProviderFromModel(id) : modelFamilyProvider(id) ?? detectProviderFromModel(id);
  return {
    name: catalogModel?.name ?? prettifyModelId(id),
    logo: provider ? getProviderLogoMark(provider, 14) : null,
  };
}

/** Y-axis label for a bar: brand mark + display name, left-aligned under the card title. */
function BarLabelTick({
  x = 0,
  y = 0,
  payload,
  kind,
  width,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  kind: BarLabelKind;
  width: number;
}) {
  const { name, logo } = resolveBarLabel(kind, payload?.value ?? "");
  const shownName = kind === "provider" && name.length > PROVIDER_NAME_MAX
    ? `${name.slice(0, PROVIDER_NAME_MAX).trimEnd()}...`
    : name;
  return (
    <foreignObject x={x - width + 20} y={y - 10} width={width - 28} height={20}>
      <div className="flex h-5 items-center justify-start gap-2 text-[11px] text-muted-foreground">
        {logo && <span className="flex size-3.5 shrink-0 items-center justify-center overflow-hidden">{logo}</span>}
        <span className="truncate" title={name}>{shownName}</span>
      </div>
    </foreignObject>
  );
}

export interface ModelBreakdownData {
  breakdown: {
    model_usage: Record<string, number>;
    cost_by_provider: Record<string, number>;
    requests_by_provider: Record<string, number>;
    latency_percentiles: { p50: number; p75: number; p90: number; p95: number; p99: number };
  };
}

export interface ModelBreakdownTrend {
  timestamp: string;
  total: number;
  error: number;
  filtered: number;
  blocked_output: number;
  latency_samples: number;
  latency_p50: number | null;
  latency_p75: number | null;
  latency_p90: number | null;
  latency_p95: number | null;
  latency_p99: number | null;
}

interface ModelBreakdownTrendsResponse {
  trends: ModelBreakdownTrend[];
  group_by?: "10min" | "hour" | "day";
}

const BAR_LIMIT = 6;
const MODEL_COLOR = "#8b5cf6";
const PROVIDER_COLOR = "#f97316";
const ERROR_SERIES = [
  { key: "error", label: "Errors", color: "#ef4444" },
  { key: "filtered", label: "Filtered", color: "#f59e0b" },
  { key: "blocked", label: "Blocked", color: "#a855f7" },
] as const;
const LATENCY_SERIES = [
  { key: "p50", label: "P50", color: "#22c55e" },
  { key: "p95", label: "P95", color: "#f59e0b" },
  { key: "p99", label: "P99", color: "#ef4444" },
] as const;

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatCost(value: number): string {
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(4)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0ms";
  return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)}s` : `${Math.round(ms)}ms`;
}

function formatTrendLabel(timestamp: string, groupBy: ModelBreakdownTrendsResponse["group_by"]): string {
  const date = new Date(timestamp);
  return groupBy === "day"
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Top entries by value, with the remainder rolled into "Other". */
function topEntries(record: Record<string, number>, limit: number) {
  const sorted = Object.entries(record)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  const top = sorted.slice(0, limit).map(([name, value]) => ({ name, value }));
  const rest = sorted.slice(limit).reduce((sum, [, value]) => sum + value, 0);
  return rest > 0 ? [...top, { name: "Other", value: rest }] : top;
}

/**
 * Model, provider and latency breakdowns for the gateway overview (formerly
 * Observability → AI). Fetched beside usage so the page swaps them together.
 */
export function useModelBreakdown(projectId: string | undefined, period: string, environment: string) {
  const overview = useQuery<ModelBreakdownData>({
    queryKey: ["modelBreakdown", projectId, period, environment],
    queryFn: () => fetchJsonWithFeatureGate<ModelBreakdownData>(
      `/api/projects/${projectId}/analytics/overview?time_range=${period}&environment=${environment}`,
    ),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error) => !isFeatureGateError(error) && failureCount < 1,
  });
  const trends = useQuery<ModelBreakdownTrendsResponse>({
    queryKey: ["modelBreakdownTrends", projectId, period, environment],
    queryFn: () => fetchJsonWithFeatureGate<ModelBreakdownTrendsResponse>(
      `/api/projects/${projectId}/analytics/trends?time_range=${period}&environment=${environment}`,
    ),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error) => !isFeatureGateError(error) && failureCount < 1,
  });
  return { overview, trends };
}

function BarBreakdownChart({
  rows,
  color,
  label,
  formatValue,
  reduceMotion,
  labelKind,
}: {
  rows: Array<{ name: string; value: number }>;
  color: string;
  label: string;
  formatValue: (value: number) => string;
  reduceMotion: boolean | null;
  /** What the category axis lists; drives logos and display names. */
  labelKind: BarLabelKind;
}) {
  const labelWidth = labelKind === "provider" ? PROVIDER_LABEL_WIDTH : MODEL_LABEL_WIDTH;
  const chartConfig = { value: { label, color } } satisfies ChartConfig;

  if (rows.length === 0) {
    return (
      <div className="flex h-[17rem] items-center justify-center">
        <span className="rounded-md bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          No data for this period
        </span>
      </div>
    );
  }

  return (
    <div className="h-[17rem] px-2 pb-3 pt-2">
      <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 16, top: 8, bottom: 0 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} strokeDasharray="4 4" stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            tickCount={5}
            tickFormatter={(value) => formatValue(Number(value))}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={0}
            tick={<BarLabelTick kind={labelKind} width={labelWidth} />}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={
              <ChartTooltipContent
                hideLabel={false}
                indicator="dot"
                labelFormatter={(value) => resolveBarLabel(labelKind, String(value)).name}
                formatter={(chartValue) => (
                  <div className="flex min-w-32 items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-2 rounded-[1px]" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                    <span className="font-mono font-medium tabular-nums">{formatValue(Number(chartValue))}</span>
                  </div>
                )}
              />
            }
          />
          <Bar
            dataKey="value"
            fill="var(--color-value)"
            fillOpacity={0.85}
            radius={[0, 2, 2, 0]}
            maxBarSize={18}
            isAnimationActive={!reduceMotion}
            animationDuration={260}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function ModelBreakdown({
  data,
  trends,
  groupBy,
  loading,
  gated,
}: {
  data: ModelBreakdownData | undefined;
  trends: ModelBreakdownTrend[];
  groupBy?: ModelBreakdownTrendsResponse["group_by"];
  loading: boolean;
  /** The plan doesn't include analytics (or it failed); the section stays hidden. */
  gated: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const breakdown = data?.breakdown;
  const isLoading = loading || !breakdown;

  const modelRows = useMemo(() => topEntries(breakdown?.model_usage ?? {}, BAR_LIMIT), [breakdown?.model_usage]);
  const providerRows = useMemo(
    () => topEntries(breakdown?.cost_by_provider ?? {}, BAR_LIMIT),
    [breakdown?.cost_by_provider],
  );
  const errorData = useMemo(
    () => trends.map((point) => ({
      date: formatTrendLabel(point.timestamp, groupBy),
      error: point.error ?? 0,
      filtered: point.filtered ?? 0,
      blocked: point.blocked_output ?? 0,
    })),
    [groupBy, trends],
  );
  const latencyData = useMemo(
    () => trends.map((point) => ({
      date: formatTrendLabel(point.timestamp, groupBy),
      p50: point.latency_p50 ?? 0,
      p95: point.latency_p95 ?? 0,
      p99: point.latency_p99 ?? 0,
    })),
    [groupBy, trends],
  );

  if (gated) return null;

  const totalModelRequests = Object.values(breakdown?.model_usage ?? {}).reduce((sum, value) => sum + value, 0);
  const modelCount = Object.keys(breakdown?.model_usage ?? {}).length;
  const totalSpend = Object.values(breakdown?.cost_by_provider ?? {}).reduce((sum, value) => sum + value, 0);
  const providerCount = Object.values(breakdown?.cost_by_provider ?? {}).filter((value) => value > 0).length;
  const percentiles = breakdown?.latency_percentiles;
  const errorTotals = {
    error: trends.reduce((sum, point) => sum + (point.error ?? 0), 0),
    filtered: trends.reduce((sum, point) => sum + (point.filtered ?? 0), 0),
    blocked: trends.reduce((sum, point) => sum + (point.blocked_output ?? 0), 0),
  };
  const trendRequests = trends.reduce((sum, point) => sum + (point.total ?? 0), 0);
  const failedRequests = errorTotals.error + errorTotals.filtered + errorTotals.blocked;
  const errorRate = trendRequests > 0 ? (failedRequests / trendRequests) * 100 : 0;

  const modelConfig: MetricCardConfig = {
    title: "Model usage",
    detail: `${modelCount} ${modelCount === 1 ? "model" : "models"}`,
    series: [{ key: "value", label: "Requests", color: MODEL_COLOR, value: totalModelRequests.toLocaleString() }],
    formatValue: (value) => value.toLocaleString(),
    formatAxis: (value) => compactNumber.format(value),
  };
  const providerConfig: MetricCardConfig = {
    title: "Cost by provider",
    detail: `${providerCount} ${providerCount === 1 ? "provider" : "providers"}`,
    series: [{ key: "value", label: "Spend", color: PROVIDER_COLOR, value: formatCost(totalSpend) }],
    formatValue: formatCost,
    formatAxis: formatCost,
  };
  const errorsConfig: MetricCardConfig = {
    title: "Errors",
    detail: `${errorRate.toFixed(1)}%`,
    series: ERROR_SERIES.map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      value: errorTotals[item.key].toLocaleString(),
    })),
    formatValue: (value) => value.toLocaleString(),
    formatAxis: (value) => compactNumber.format(value),
  };
  const latencyConfig: MetricCardConfig = {
    title: "Latency",
    detail: formatLatency(percentiles?.p50 ?? 0),
    series: LATENCY_SERIES.map((item) => ({
      key: item.key,
      label: item.label,
      color: item.color,
      value: formatLatency(percentiles?.[item.key] ?? 0),
    })),
    formatValue: formatLatency,
    formatAxis: formatLatency,
  };

  return (
    <section className="mt-4" aria-label="Model, provider and latency breakdown">

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricCardFrame config={modelConfig} loading={isLoading}>
          <BarBreakdownChart
            rows={modelRows}
            color={MODEL_COLOR}
            label="Requests"
            formatValue={(value) => compactNumber.format(value)}
            reduceMotion={reduceMotion}
            labelKind="model"
          />
        </MetricCardFrame>
        <MetricCardFrame config={providerConfig} loading={isLoading}>
          <BarBreakdownChart
            rows={providerRows}
            color={PROVIDER_COLOR}
            label="Spend"
            formatValue={formatCost}
            reduceMotion={reduceMotion}
            labelKind="provider"
          />
        </MetricCardFrame>
        <MetricCard
          config={latencyConfig}
          data={latencyData}
          loading={isLoading}
          hasData={trends.some((point) => (point.latency_samples ?? 0) > 0)}
          reduceMotion={reduceMotion}
        />
        <MetricCard
          config={errorsConfig}
          data={errorData}
          loading={isLoading}
          hasData={trends.some((point) => (point.total ?? 0) > 0)}
          reduceMotion={reduceMotion}
        />
      </div>
    </section>
  );
}
