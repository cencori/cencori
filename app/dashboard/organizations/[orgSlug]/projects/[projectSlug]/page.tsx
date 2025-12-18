"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Settings, Rocket, Activity, Clock, Zap, TrendingUp, Key, Sparkles, Terminal, Copy, Check, ExternalLink, Info, LoaderIcon } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
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

// Type for recharts dot props
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

// Custom animated dot for line charts
const CustomizedDot = (props: DotProps) => {
  const { cx, cy, stroke } = props;

  return (
    <g>
      {/* Main dot */}
      <circle cx={cx} cy={cy} r={3} fill={stroke} />
      {/* Ping animation circles */}
      <circle
        cx={cx}
        cy={cy}
        r={3}
        stroke={stroke}
        fill="none"
        strokeWidth="1"
        opacity="0.8"
      >
        <animate
          attributeName="r"
          values="3;10"
          dur="1s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.8;0"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};

// Getting Started Section Component - Only shows when no AI requests yet
function GettingStartedSection({
  orgSlug,
  projectSlug,
  hasData,
  loading
}: {
  orgSlug: string;
  projectSlug: string;
  hasData: boolean;
  loading: boolean;
}) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copyingPrompt, setCopyingPrompt] = useState(false);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedEnv, setCopiedEnv] = useState(false);

  // Don't show if user has data
  if (hasData || loading) {
    return null;
  }

  const copyPrompt = async () => {
    try {
      setCopyingPrompt(true);
      // Fetch the full llm.txt content
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
    try {
      await navigator.clipboard.writeText("npm install cencori");
      setCopiedInstall(true);
      setTimeout(() => setCopiedInstall(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const copyEnv = async () => {
    try {
      await navigator.clipboard.writeText("CENCORI_API_KEY=cen_your_api_key_here");
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="mb-8 space-y-6">
      {/* Header - constrained to same width as steps */}
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Spinner at top */}
        <div className="flex items-center gap-2">
          <LoaderIcon className="h-4 w-4 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Waiting for your first request</p>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Getting started</p>
          <h2 className="text-2xl font-semibold tracking-tight">Integrate Cencori in your app</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Install the SDK, set your API key, and make your first AI request.
            The moment we detect activity, setup is complete.
          </p>
        </div>

        {/* SDK Icon - Single option */}
        <div className="flex">
          <div className="flex items-center gap-2 px-4 py-2 border rounded-lg bg-muted/30">
            <div className="w-8 h-8 rounded bg-amber-500/10 flex items-center justify-center">
              <span className="text-amber-500 font-bold text-sm">JS</span>
            </div>
            <span className="text-sm font-medium">JavaScript / TypeScript</span>
          </div>
        </div>
      </div>

      {/* LLM Prompt Bar */}
      <div className="flex items-center justify-between gap-4 px-8 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg max-w-3xl mx-auto">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 text-emerald-500" />
          <span>Copy this quickstart guide as a prompt for LLMs to integrate Cencori</span>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={copyPrompt}
          disabled={copyingPrompt}
          className="gap-2"
        >
          {copiedPrompt ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : copyingPrompt ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Copying...
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy prompt
            </>
          )}
        </Button>
      </div>

      {/* Steps */}
      <div className="space-y-8 max-w-3xl mx-auto mt-8">
        {/* Step 1: Install */}
        <div className="flex gap-6">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              1
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium">Install the Cencori SDK</h3>
              <p className="text-sm text-muted-foreground">
                Run the following command to install the SDK.
              </p>
            </div>
            <div className="relative">
              <div className="bg-zinc-950 dark:bg-zinc-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400 font-mono">terminal</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
                    onClick={copyInstall}
                  >
                    {copiedInstall ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="p-4">
                  <code className="text-sm text-emerald-400 font-mono">npm install cencori</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: API Key */}
        <div className="flex gap-6">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              2
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium">Set your Cencori API key</h3>
              <p className="text-sm text-muted-foreground">
                Add this key to your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file.
                Get your key from the{" "}
                <Link
                  href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/api-keys`}
                  className="text-primary hover:underline"
                >
                  API keys page
                </Link>.
              </p>
            </div>
            <div className="relative">
              <div className="bg-zinc-950 dark:bg-zinc-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400 font-mono">.env</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
                    onClick={copyEnv}
                  >
                    {copiedEnv ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="p-4">
                  <code className="text-sm text-blue-400 font-mono">CENCORI_API_KEY=<span className="text-zinc-500">cen_your_api_key_here</span></code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Make Request */}
        <div className="flex gap-6">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 text-muted-foreground flex items-center justify-center text-sm font-semibold">
              3
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="font-medium text-muted-foreground">Make your first AI request</h3>
              <p className="text-sm text-muted-foreground">
                Create a client file or use the playground. Once we detect your first request,
                this setup will complete automatically.
              </p>
            </div>
            <div className="relative">
              <div className="bg-zinc-950 dark:bg-zinc-900 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
                  <span className="text-xs text-zinc-400 font-mono">lib/cencori.ts</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
                    onClick={() => {
                      navigator.clipboard.writeText(`import { Cencori } from "cencori";

export const cencori = new Cencori({
  apiKey: process.env.CENCORI_API_KEY!,
});`);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="p-4 space-y-1">
                  <code className="text-sm font-mono block"><span className="text-purple-400">import</span> <span className="text-zinc-300">{"{"}</span> <span className="text-amber-300">Cencori</span> <span className="text-zinc-300">{"}"}</span> <span className="text-purple-400">from</span> <span className="text-emerald-400">"cencori"</span><span className="text-zinc-300">;</span></code>
                  <code className="text-sm font-mono block text-zinc-600">&nbsp;</code>
                  <code className="text-sm font-mono block"><span className="text-purple-400">export const</span> <span className="text-blue-400">cencori</span> <span className="text-zinc-300">=</span> <span className="text-purple-400">new</span> <span className="text-amber-300">Cencori</span><span className="text-zinc-300">({"{"}</span></code>
                  <code className="text-sm font-mono block">  <span className="text-zinc-300">apiKey:</span> <span className="text-blue-400">process.env</span><span className="text-zinc-300">.</span><span className="text-zinc-100">CENCORI_API_KEY</span><span className="text-zinc-300">!,</span></code>
                  <code className="text-sm font-mono block"><span className="text-zinc-300">{"})"}</span><span className="text-zinc-300">;</span></code>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/playground`}>
                  <Terminal className="h-4 w-4 mr-2" />
                  Try Playground
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="https://cencori.com/docs" target="_blank">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Docs
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function ProjectDetailsPage({
  params,
}: {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolved = await params;
        if (mounted && resolved) {
          if (typeof resolved.orgSlug === "string") setOrgSlug(resolved.orgSlug);
          if (typeof resolved.projectSlug === "string") setProjectSlug(resolved.projectSlug);
        }
      } catch (e) {
        console.error("Failed to resolve params:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [params]);

  const router = useRouter();
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [period, setPeriod] = useState<string>('7d');
  const { environment } = useEnvironment();

  useEffect(() => {
    if (!orgSlug || !projectSlug) return;

    const fetchProjectDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: userError } = await browserSupabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: orgData, error: orgError } = await browserSupabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", orgSlug)
          .eq("owner_id", user.id)
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          notFound();
          return;
        }
        setOrganization(orgData);

        const { data: projectData, error: projectError } = await browserSupabase
          .from("projects")
          .select("id, name, slug, description, visibility, status, created_at")
          .eq("organization_id", orgData.id)
          .eq("slug", projectSlug)
          .single();

        if (projectError || !projectData) {
          console.error("Error fetching project:", projectError?.message);
          notFound();
          return;
        }
        setProject(projectData);

        // Fetch AI stats if project exists
        fetchAIStats(projectData.id, period);
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    async function fetchAIStats(projectId: string, selectedPeriod: string) {
      try {
        const statsResponse = await fetch(`/api/projects/${projectId}/ai/stats?period=${selectedPeriod}&environment=${environment}`);
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setAiStats(statsData.stats);
          setChartData(statsData.chartData || []);
        }
      } catch (err) {
        console.log('AI stats not available yet');
      }
    }

    fetchProjectDetails();
  }, [orgSlug, projectSlug, router]);

  // Refetch stats when period or environment changes
  useEffect(() => {
    if (project?.id && environment) {
      fetchAIStats(project.id, period);
    }
  }, [period, project, environment]);

  async function fetchAIStats(projectId: string, selectedPeriod: string) {
    try {
      const statsResponse = await fetch(`/api/projects/${projectId}/ai/stats?period=${selectedPeriod}&environment=${environment}`);
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setAiStats(statsData.stats);
        setChartData(statsData.chartData || []);
      }
    } catch (err) {
      console.log('AI stats not available yet');
    }
  }

  // Real AI stats
  const stats = {
    aiRequests: {
      value: aiStats ? aiStats.totalRequests.toLocaleString() : "0",
      change: aiStats ? `${aiStats.successfulRequests} successful` : "No data",
      trend: "up"
    },
    aiCost: {
      value: aiStats ? `$${aiStats.totalCost}` : "$0",
      change: aiStats ? `${aiStats.totalTokens.toLocaleString()} tokens` : "No data",
      trend: "stable"
    },
    avgLatency: {
      value: aiStats ? `${aiStats.avgLatency}ms` : "0ms",
      change: aiStats ? `${aiStats.errorRequests} errors` : "Last 7 days",
      trend: "stable"
    },
  };

  // Recent AI activity
  const recentActivity: ActivityItem[] = aiStats && aiStats.totalRequests > 0 ? [
    { id: "1", type: "ai", message: `${aiStats.totalRequests} AI requests processed`, timestamp: "Last 7 days" },
    { id: "2", type: "ai", message: `${aiStats.successfulRequests} successful responses`, timestamp: "Last 7 days" },
    { id: "3", type: "cost", message: `$${aiStats.totalCost} total cost`, timestamp: "Last 7 days" },
    { id: "4", type: "tokens", message: `${aiStats.totalTokens.toLocaleString()} tokens used`, timestamp: "Last 7 days" },
  ] : [
    { id: "1", type: "info", message: "No AI activity yet", timestamp: "Start using the AI API" },
  ];

  if (loading) {
    return (
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Section Skeleton */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Skeleton className="h-10 flex-1 sm:flex-none sm:w-28" />
            <Skeleton className="h-10 flex-1 sm:flex-none sm:w-32" />
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-none">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-9 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Skeleton */}
        <Card className="rounded-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-2 w-2 rounded-full mt-2" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} className="rounded-none">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!organization || !project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">Project or Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1920px] mx-auto px-6 sm:px-4 lg:px-8 py-6 sm:py-4">
      {/* Hero Section - Only show when user has data */}
      {(aiStats !== null && aiStats.totalRequests > 0) && (
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
          <div className="space-y-4 flex-1 min-w-0">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 mt-4 sm:mt-1">
                  <h1 className="text-3xl sm:text-4xl mt-0 font-bold tracking-tight text-foreground">{project.name}</h1>
                  <Badge variant="outline" className="h-5 gap-1.5">
                    <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                    {project.status}
                  </Badge>
                </div>
                <Separator className="my-4 mt-12 w-full max-w-[1920px]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Getting Started Section */}
      <GettingStartedSection
        orgSlug={orgSlug!}
        projectSlug={projectSlug!}
        hasData={aiStats !== null && aiStats.totalRequests > 0}
        loading={loading}
      />

      {/* Time Period Selector and Analytics - Only show when user has data */}
      {(aiStats !== null && aiStats.totalRequests > 0) && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold tracking-tight">Overview</h2>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px] rounded-none border-2 focus:ring-0 focus:ring-offset-0">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="rounded-none border-2">
                <SelectItem value="1h" className="rounded-none cursor-pointer">Last Hour</SelectItem>
                <SelectItem value="24h" className="rounded-none cursor-pointer">Last 24 Hours</SelectItem>
                <SelectItem value="7d" className="rounded-none cursor-pointer">Last 7 Days</SelectItem>
                <SelectItem value="30d" className="rounded-none cursor-pointer">Last 30 Days</SelectItem>
                <SelectItem value="all" className="rounded-none cursor-pointer">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* AI Requests Chart */}
            <TechnicalBorder className="h-full">
              <div className="p-6">
                <div className="pb-2">
                  <p className="text-sm text-muted-foreground">Requests</p>
                  <h3 className="text-3xl font-semibold leading-none tracking-tight">{stats.aiRequests.value}</h3>
                </div>
                <div className="h-32">
                  {chartData.length > 0 ? (
                    <ChartContainer
                      config={{
                        requests: {
                          label: "Requests",
                          color: "hsla(24, 76%, 36%, 1.00)",
                        },
                      }}
                      className="h-full w-full"
                    >
                      <LineChart
                        data={chartData}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 8,
                          bottom: 8,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                          dataKey="count"
                          type="monotone"
                          stroke="var(--color-requests)"
                          strokeWidth={2}
                          dot={(props: DotProps) => {
                            const { key, ...rest } = props;
                            return <CustomizedDot key={key} {...rest} stroke="var(--color-requests)" />;
                          }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      No data yet
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-emerald-600 dark:text-emerald-400">{stats.aiRequests.change}</span>
                </p>
              </div>
            </TechnicalBorder>

            {/* AI Cost Chart */}
            <TechnicalBorder className="h-full">
              <div className="p-6">
                <div className="pb-2">
                  <p className="text-sm text-muted-foreground">Cost</p>
                  <h3 className="text-3xl font-semibold leading-none tracking-tight">{stats.aiCost.value}</h3>
                </div>
                <div className="h-32">
                  {chartData.length > 0 ? (
                    <ChartContainer
                      config={{
                        cost: {
                          label: "Cost",
                          color: "hsl(142.1 76.2% 36.3%)",
                        },
                      }}
                      className="h-full w-full"
                    >
                      <LineChart
                        data={chartData}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 8,
                          bottom: 8,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                          dataKey="cost"
                          type="monotone"
                          stroke="var(--color-cost)"
                          strokeWidth={2}
                          dot={(props: DotProps) => {
                            const { key, ...rest } = props;
                            return <CustomizedDot key={key} {...rest} stroke="var(--color-cost)" />;
                          }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      No data yet
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="text-muted-foreground">{stats.aiCost.change}</span>
                </p>
              </div>
            </TechnicalBorder>

            {/* Avg Latency Chart */}
            <TechnicalBorder className="h-full">
              <div className="p-6">
                <div className="pb-2">
                  <p className="text-sm text-muted-foreground">Average Latency</p>
                  <h3 className="text-3xl font-semibold leading-none tracking-tight">{stats.avgLatency.value}</h3>
                </div>
                <div className="h-32">
                  {chartData.length > 0 ? (
                    <ChartContainer
                      config={{
                        latency: {
                          label: "Latency",
                          color: "hsla(244, 59%, 59%, 1.00)",
                        },
                      }}
                      className="h-full w-full"
                    >
                      <LineChart
                        data={chartData}
                        margin={{
                          left: 12,
                          right: 12,
                          top: 8,
                          bottom: 8,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <ChartTooltip
                          cursor={false}
                          content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                          dataKey="count"
                          type="monotone"
                          stroke="var(--color-latency)"
                          strokeWidth={2}
                          dot={(props: DotProps) => {
                            const { key, ...rest } = props;
                            return <CustomizedDot key={key} {...rest} stroke="var(--color-latency)" />;
                          }}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      No data yet
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.avgLatency.change}
                </p>
              </div>
            </TechnicalBorder>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Recent Activity */}
            <TechnicalBorder className="h-[280px] flex flex-col">
              <div className="flex flex-col h-full">
                <div className="flex-none p-6 pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                        Recent Activity
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">Latest deployments and updates</p>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/activity`}>
                        View All
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6 pt-0">
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={activity.id}>
                        <div className="flex gap-4">
                          <div className="relative">
                            <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                            {index !== recentActivity.length - 1 && (
                              <div className="absolute top-4 left-[3px] w-[2px] h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <p className="text-sm font-medium">{activity.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
                          </div>
                        </div>
                        {index !== recentActivity.length - 1 && <div className="h-px" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TechnicalBorder>

            {/* Project Information */}
            <TechnicalBorder className="h-[280px] flex flex-col">
              <div className="flex flex-col h-full p-6">
                <div className="flex-none pb-4">
                  <h3 className="text-lg font-semibold leading-none tracking-tight">Project Information</h3>
                  <p className="text-sm text-muted-foreground mt-1">Basic details about this project</p>
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Organization</span>
                    <span className="font-medium">{organization.name}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Project ID</span>
                    <span className="font-mono text-xs">{project.slug}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Visibility</span>
                    <Badge variant="outline" className="h-5">
                      {project.visibility}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="outline" className="h-5 gap-1.5">
                      <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                      {project.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </TechnicalBorder>

          </div>
        </>
      )}
    </div>
  );
}
