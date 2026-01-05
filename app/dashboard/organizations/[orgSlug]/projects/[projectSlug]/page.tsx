"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Copy, Check, ExternalLink, Info, Terminal } from "lucide-react";
import { ChartBarIcon, CurrencyDollarIcon, ClockIcon } from '@heroicons/react/24/outline';
import { Bar, BarChart, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import React, { useState, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnvironment } from "@/lib/contexts/EnvironmentContext";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
}

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  visibility: "public" | "private";
  status: "active" | "inactive";
  created_at: string;
}

interface ActivityItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface AIStats {
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  filteredRequests: number;
  totalCost: string;
  totalTokens: number;
  avgLatency: number;
}

interface ChartDataPoint {
  date: string;
  count: number;
  cost: number;
  tokens: number;
}

interface DotProps {
  key?: string;
  cx?: number;
  cy?: number;
  r?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  index?: number;
  value?: number;
  dataKey?: string;
  payload?: ChartDataPoint;
  [key: string]: unknown;
}

const CustomizedDot = (props: DotProps) => {
  const { cx, cy, stroke } = props;
  return <circle cx={cx} cy={cy} r={2.5} fill={stroke} />;
};

// Getting Started Section Component - Compact
function GettingStartedSection({
  orgSlug,
  projectSlug,
  hasData,
  loading
}: {
  orgSlug: string;
  projectSlug: string;
  hasData: boolean | null;
  loading: boolean;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copyingPrompt, setCopyingPrompt] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (loading || hasData === null || hasData === true) {
    return null;
  }

  const copyPrompt = async () => {
    try {
      setCopyingPrompt(true);
      const response = await fetch('/llm.txt');
      const llmContent = await response.text();
      await navigator.clipboard.writeText(llmContent);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    } finally {
      setCopyingPrompt(false);
    }
  };

  const copyInstall = async () => {
    await navigator.clipboard.writeText("npm install cencori");
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const copyEnv = async () => {
    await navigator.clipboard.writeText("CENCORI_API_KEY=cen_your_api_key_here");
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const copyCode = async () => {
    await navigator.clipboard.writeText(`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Waiting for first request</span>
        </div>
        <h2 className="text-base font-medium">Get started</h2>
        <p className="text-xs text-muted-foreground">
          Install the SDK, add your API key, and make a request.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-emerald-500/5 border border-emerald-500/20 rounded-md">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3 w-3 text-emerald-500" />
          <span>Copy as LLM prompt</span>
        </div>
        <Button variant="ghost" size="sm" onClick={copyPrompt} disabled={copyingPrompt} className="h-6 px-2 text-xs gap-1">
          {copiedPrompt ? <Check className="h-3 w-3" /> : copyingPrompt ? <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> : <Copy className="h-3 w-3" />}
          {copiedPrompt ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="grid gap-2">
        <div className="border border-border/40 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-medium">1</span>
              <span className="text-xs font-medium">Install SDK</span>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyInstall}>
              {copiedInstall ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
            </Button>
          </div>
          <div className="px-3 py-1.5 bg-zinc-950">
            <code className="text-[11px] text-emerald-400 font-mono">npm install cencori</code>
          </div>
        </div>

        <div className="border border-border/40 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-medium">2</span>
              <span className="text-xs font-medium">Add to .env</span>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`} className="text-[10px] text-primary hover:underline">
                Get key →
              </Link>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyEnv}>
              {copiedEnv ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
            </Button>
          </div>
          <div className="px-3 py-1.5 bg-zinc-950">
            <code className="text-[11px] font-mono"><span className="text-blue-400">CENCORI_API_KEY</span><span className="text-zinc-500">=cen_your_api_key_here</span></code>
          </div>
        </div>

        <div className="border border-border/40 rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full border border-muted-foreground/30 text-muted-foreground flex items-center justify-center text-[9px] font-medium">3</span>
              <span className="text-xs font-medium text-muted-foreground">Create client</span>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={copyCode}>
              {copiedCode ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground" />}
            </Button>
          </div>
          <div className="px-3 py-2 bg-zinc-950 space-y-0.5">
            <code className="text-[11px] font-mono block"><span className="text-purple-400">import</span> <span className="text-zinc-300">{"{"}</span> <span className="text-amber-300">Cencori</span> <span className="text-zinc-300">{"}"}</span> <span className="text-purple-400">from</span> <span className="text-emerald-400">&quot;cencori&quot;</span><span className="text-zinc-400">;</span></code>
            <code className="text-[11px] font-mono block text-zinc-600">&nbsp;</code>
            <code className="text-[11px] font-mono block"><span className="text-purple-400">export const</span> <span className="text-blue-400">cencori</span> <span className="text-zinc-400">=</span> <span className="text-purple-400">new</span> <span className="text-amber-300">Cencori</span><span className="text-zinc-300">({"{"}</span></code>
            <code className="text-[11px] font-mono block">  <span className="text-zinc-300">apiKey:</span> <span className="text-blue-400">process.env</span><span className="text-zinc-400">.</span><span className="text-zinc-100">CENCORI_API_KEY</span><span className="text-zinc-400">!,</span></code>
            <code className="text-[11px] font-mono block"><span className="text-zinc-300">{"})"}</span><span className="text-zinc-400">;</span></code>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
          <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/playground`}>
            <Terminal className="h-3 w-3" />
            Playground
          </Link>
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" asChild>
          <Link href="https://cencori.com/docs" target="_blank">
            <ExternalLink className="h-3 w-3" />
            Docs
          </Link>
        </Button>
      </div>
    </div>
  );
}

// Hook to fetch project and organization details with caching
function useProjectAndOrg(orgSlug: string, projectSlug: string) {
  return useQuery({
    queryKey: ["projectOverview", orgSlug, projectSlug],
    queryFn: async () => {
      const { data: { user }, error: userError } = await browserSupabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      const { data: orgData, error: orgError } = await browserSupabase
        .from("organizations")
        .select("id, name, slug")
        .eq("slug", orgSlug)
        .eq("owner_id", user.id)
        .single();

      if (orgError || !orgData) throw new Error("Organization not found");

      const { data: projectData, error: projectError } = await browserSupabase
        .from("projects")
        .select("id, name, slug, description, visibility, status, created_at")
        .eq("organization_id", orgData.id)
        .eq("slug", projectSlug)
        .single();

      if (projectError || !projectData) throw new Error("Project not found");

      return {
        organization: orgData as OrganizationData,
        project: projectData as ProjectData,
      };
    },
    staleTime: 60 * 1000,
  });
}

export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const { orgSlug, projectSlug } = use(params);
  const { environment } = useEnvironment();
  const [period, setPeriod] = useState<string>('7d');

  // Fetch project and org with caching - INSTANT ON REVISIT!
  const { data: projectData, isLoading: projectLoading, error } = useProjectAndOrg(orgSlug, projectSlug);
  const organization = projectData?.organization;
  const project = projectData?.project;

  // Fetch AI stats with caching
  const { data: statsData } = useQuery<{ stats: AIStats; chartData: ChartDataPoint[] }>({
    queryKey: ["aiStats", project?.id, period, environment],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project!.id}/ai/stats?period=${period}&environment=${environment}`);
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: !!project?.id,
    staleTime: 30 * 1000,
  });

  const aiStats = statsData?.stats || null;
  const chartData = statsData?.chartData || [];

  // Check if user has any requests (for showing getting started)
  const { data: hasAnyRequestsData } = useQuery<boolean>({
    queryKey: ["hasAnyRequests", project?.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project!.id}/ai/stats?period=all`);
      if (!response.ok) return false;
      const data = await response.json();
      return data.stats && data.stats.totalRequests > 0;
    },
    enabled: !!project?.id,
    staleTime: 30 * 1000,
  });

  const hasAnyRequests = hasAnyRequestsData ?? null;

  const stats = {
    aiRequests: {
      value: aiStats ? aiStats.totalRequests.toLocaleString() : "0",
      change: aiStats ? `${aiStats.successfulRequests} successful` : "No data",
    },
    aiCost: {
      value: aiStats ? `$${aiStats.totalCost}` : "$0",
      change: aiStats ? `${aiStats.totalTokens.toLocaleString()} tokens` : "No data",
    },
    avgLatency: {
      value: aiStats ? `${aiStats.avgLatency}ms` : "0ms",
      change: aiStats ? `${aiStats.errorRequests} errors` : "No data",
    },
  };

  const recentActivity: ActivityItem[] = aiStats && aiStats.totalRequests > 0 ? [
    { id: "1", type: "ai", message: `${aiStats.totalRequests} AI requests processed`, timestamp: "Last 7 days" },
    { id: "2", type: "ai", message: `${aiStats.successfulRequests} successful responses`, timestamp: "Last 7 days" },
    { id: "3", type: "cost", message: `$${aiStats.totalCost} total cost`, timestamp: "Last 7 days" },
  ] : [
    { id: "1", type: "info", message: "No AI activity yet", timestamp: "Start using the AI API" },
  ];

  if (projectLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !organization || !project) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <div className="text-center py-16">
          <p className="text-sm text-red-500">{error?.message || "Project or Organization not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8">
      {/* Header - Only show when user has data */}
      {hasAnyRequests && (
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            <Badge variant="outline" className="h-5 gap-1 text-[10px]">
              <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
              {project.status}
            </Badge>
          </div>
        </div>
      )}

      {/* Getting Started Section */}
      <GettingStartedSection
        orgSlug={orgSlug}
        projectSlug={projectSlug}
        hasData={hasAnyRequests}
        loading={projectLoading}
      />

      {/* Analytics - Only show when user has data */}
      {hasAnyRequests && (
        <>
          {/* Overview Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Overview</h2>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[120px] h-7 text-xs">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h" className="text-xs">Last Hour</SelectItem>
                <SelectItem value="24h" className="text-xs">24 Hours</SelectItem>
                <SelectItem value="7d" className="text-xs">7 Days</SelectItem>
                <SelectItem value="30d" className="text-xs">30 Days</SelectItem>
                <SelectItem value="all" className="text-xs">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Requests Card */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <ChartBarIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Requests</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">API Calls</p>
              <p className="text-3xl font-semibold mb-1">{stats.aiRequests.value}</p>
              <p className="text-xs text-muted-foreground mb-3">{stats.aiRequests.change}</p>
              <div className="h-28">
                {chartData.length > 0 ? (
                  <ChartContainer
                    config={{ requests: { label: "Requests", color: "hsl(24 80% 50%)" } }}
                    className="h-full w-full"
                  >
                    <BarChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 20 }}>
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickMargin={8}
                        interval="preserveStartEnd"
                      />
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-requests)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                )}
              </div>
            </div>

            {/* Cost Card */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <CurrencyDollarIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Cost</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">Total Spend</p>
              <p className="text-3xl font-semibold mb-1">{stats.aiCost.value}</p>
              <p className="text-xs text-muted-foreground mb-3">{stats.aiCost.change}</p>
              <div className="h-28">
                {chartData.length > 0 ? (
                  <ChartContainer
                    config={{ cost: { label: "Cost", color: "hsl(142 76% 36%)" } }}
                    className="h-full w-full"
                  >
                    <BarChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 20 }}>
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickMargin={8}
                        interval="preserveStartEnd"
                      />
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                        content={<ChartTooltipContent hideLabel formatter={(value) => `$${Number(value).toFixed(6)}`} />}
                      />
                      <Bar
                        dataKey="cost"
                        fill="var(--color-cost)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                )}
              </div>
            </div>

            {/* Latency Card */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <ClockIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Performance</span>
              </div>
              <p className="text-xs text-muted-foreground mb-1">Avg Latency</p>
              <p className="text-3xl font-semibold mb-1">{stats.avgLatency.value}</p>
              <p className="text-xs text-muted-foreground mb-3">{stats.avgLatency.change}</p>
              <div className="h-28">
                {chartData.length > 0 ? (
                  <ChartContainer
                    config={{ latency: { label: "Latency", color: "hsl(244 59% 59%)" } }}
                    className="h-full w-full"
                  >
                    <BarChart data={chartData} margin={{ left: 0, right: 0, top: 0, bottom: 20 }}>
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickMargin={8}
                        interval="preserveStartEnd"
                      />
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--color-latency)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                )}
              </div>
            </div>
          </div>

          {/* Activity and Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Activity */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Recent Activity</h3>
                  <p className="text-xs text-muted-foreground">Latest updates</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/logs`}>
                    View All
                  </Link>
                </Button>
              </div>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="text-xs">{activity.message}</p>
                      <p className="text-[10px] text-muted-foreground">{activity.timestamp}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Project Information */}
            <div className="rounded-xl border border-border/40 bg-card p-5">
              <div className="mb-4">
                <h3 className="text-sm font-medium">Project Information</h3>
                <p className="text-xs text-muted-foreground">Basic details</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Organization</span>
                  <span className="font-medium">{organization.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Project ID</span>
                  <span className="font-mono text-[11px]">{project.slug}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Visibility</span>
                  <Badge variant="outline" className="h-5 text-[10px] px-2">{project.visibility}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="h-5 text-[10px] px-2 gap-1">
                    <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {project.status}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
