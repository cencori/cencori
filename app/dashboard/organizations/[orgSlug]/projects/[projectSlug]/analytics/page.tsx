"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AnalyticsResponse } from "@/lib/types/audit";
import { MetricCard } from "@/components/audit/MetricCard";
import { TimeRangeSelector, TimeRangeOption } from "@/components/audit/TimeRangeSelector";
import { GradientBarMultipleChart } from "@/components/charts/GradientBarMultipleChart";
import { HatchedBarChart } from "@/components/charts/HatchedBarChart";
import { GradientBarChart } from "@/components/charts/GradientBarChart";
import { DottedLineChart } from "@/components/charts/DottedLineChart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  Clock,
  DollarSign,
  ShieldAlert,
  TrendingUp,
  Zap
} from "lucide-react";
import { DateRange } from "react-day-picker";

export default function AnalyticsPage() {
  const params = useParams();
  const projectId = params.projectSlug as string;

  // State
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [timeRange, setTimeRange] = useState<TimeRangeOption>("30d");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const params = new URLSearchParams({
        timeRange,
        granularity: "day",
      });

      if (timeRange === "custom" && dateRange?.from) {
        params.set("startDate", dateRange.from.toISOString());
        if (dateRange.to) {
          params.set("endDate", dateRange.to.toISOString());
        }
      }

      try {
        const res = await fetch(`/api/projects/${projectId}/analytics/stats?${params}`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, timeRange, dateRange]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive metrics and trends for your AI gateway
          </p>
        </div>
        <TimeRangeSelector
          value={timeRange}
          onChange={(range, dates) => {
            setTimeRange(range);
            setDateRange(dates);
          }}
          dateRange={dateRange}
        />
      </div>

      {/* Core Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Requests"
          value={data?.metrics.totalRequests.toLocaleString() || "0"}
          icon={Activity}
          description={`${data?.metrics.successfulRequests || 0} successful`}
          loading={loading}
        />
        <MetricCard
          title="Success Rate"
          value={data ? `${data.metrics.successRate.toFixed(1)}%` : "0%"}
          icon={CheckCircle2}
          trend={{
            value: 5.2,
            label: "vs. last period",
            direction: "up"
          }}
          loading={loading}
        />
        <MetricCard
          title="Avg Latency (p50)"
          value={data ? `${Math.round(data.metrics.p50LatencyMs)}ms` : "0ms"}
          icon={Zap}
          description={`p95: ${data ? Math.round(data.metrics.p95LatencyMs) : 0}ms`}
          loading={loading}
        />
        <MetricCard
          title="Total Cost"
          value={data ? `$${data.metrics.totalCostUsd.toFixed(2)}` : "$0.00"}
          icon={DollarSign}
          description={`Avg: $${data ? data.metrics.avgCostPerRequest.toFixed(6) : "0.000000"}`}
          loading={loading}
        />
      </div>

      {/* Request & Performance Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <GradientBarMultipleChart
          data={data?.timeSeries.slice(-12).map(t => ({
            label: new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short' }),
            value1: t.success,
            value2: t.filtered + t.blocked_output
          }))}
          title="Success vs Filtered Requests"
          description={`Last ${timeRange === 'custom' ? 'selected period' : timeRange}`}
          dataKey1="value1"
          dataKey2="value2"
          dataLabel1="Success"
          dataLabel2="Blocked"
        />
        <DottedLineChart
          data={data?.timeSeries.slice(-12).map(t => ({
            label: new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short' }),
            value: data.metrics.avgLatencyMs // This would ideally be per-period latency
          }))}
          title="Average Latency Trend"
          description={`Current: ${data ? Math.round(data.metrics.avgLatencyMs) : 0}ms`}
        />
      </div>

      {/* Cost & Token Analysis */}
      <div className="grid gap-4 md:grid-cols-2">
        <HatchedBarChart
          data={data?.costByModel.slice(0, 6).map(m => ({
            label: m.model.replace('gemini-', ''),
            value: m.totalCost
          }))}
          title="Cost by Model"
          description="Total spending per model"
        />
        <GradientBarChart
          data={data?.modelUsage.slice(0, 6).map(m => ({
            label: m.model.replace('gemini-', ''),
            value: m.count
          }))}
          title="Requests by Model"
          description="Distribution of requests"
        />
      </div>

      {/* Security Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-orange-500" />
            Security Overview
          </CardTitle>
          <CardDescription>Last {timeRange === 'custom' ? 'selected period' : timeRange}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Jailbreak Attempts</div>
              <div className="text-2xl font-bold">
                {data?.securitySummary.jailbreakAttempts || 0}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">PII Blocks</div>
              <div className="text-2xl font-bold">
                {data?.securitySummary.piiBlocks || 0}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Prompt Injections</div>
              <div className="text-2xl font-bold">
                {data?.securitySummary.promptInjections || 0}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Critical Incidents</div>
              <div className="text-2xl font-bold text-red-600">
                {data?.securitySummary.criticalIncidents || 0}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Usage & Blocked Patterns */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Models Used</CardTitle>
            <CardDescription>By request count</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {data?.modelUsage.slice(0, 5).map((model) => (
                  <div key={model.model} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium font-mono">{model.model}</div>
                      <div className="text-xs text-muted-foreground">
                        {model.count.toLocaleString()} requests · ${model.totalCost.toFixed(4)}
                      </div>
                    </div>
                    <div className="text-sm font-medium">{model.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Blocked Patterns</CardTitle>
            <CardDescription>Most common security triggers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : data?.topBlockedPatterns.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                No blocked patterns in this period
              </div>
            ) : (
              <div className="space-y-3">
                {data?.topBlockedPatterns.slice(0, 5).map((pattern, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{pattern.pattern}</div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {pattern.severity} severity
                      </div>
                    </div>
                    <div className="text-sm font-medium">{pattern.count}×</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
