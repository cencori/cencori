"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Settings, Rocket, Activity, Clock, Zap, TrendingUp, Key } from "lucide-react";
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
    if (project?.id) {
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
      {/* Hero Section */}
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

      {/* Time Period Selector */}
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
        <Card className="transition-all hover:shadow-md rounded-none border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
          <CardHeader className="pb-2">
            <CardDescription>Requests</CardDescription>
            <CardTitle className="text-3xl">{stats.aiRequests.value}</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* AI Cost Chart */}
        <Card className="transition-all hover:shadow-md rounded-none border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
          <CardHeader className="pb-2">
            <CardDescription>Cost</CardDescription>
            <CardTitle className="text-3xl">{stats.aiCost.value}</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Avg Latency Chart */}
        <Card className="transition-all hover:shadow-md rounded-none border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
          <CardHeader className="pb-2">
            <CardDescription>Average Latency</CardDescription>
            <CardTitle className="text-3xl">{stats.avgLatency.value}</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Recent Activity */}
        <Card className="transition-all hover:shadow-md rounded-none border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest deployments and updates</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/activity`}>
                  View All
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Project Information */}
        <Card className="transition-all hover:shadow-md rounded-none border-2 border-border relative before:absolute before:top-0 before:left-0 before:w-3 before:h-3 before:border-t-4 before:border-l-4 before:border-primary after:absolute after:bottom-0 after:right-0 after:w-3 after:h-3 after:border-b-4 after:border-r-4 after:border-primary">
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
            <CardDescription>Basic details about this project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
