"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Settings, Rocket, Activity, Clock, Zap, TrendingUp, Key } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

export default function ProjectDetailsPage({
  params,
}: {
  params: { orgSlug: string; projectSlug: string } | Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [projectSlug, setProjectSlug] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolved = await Promise.resolve(params as { orgSlug: string; projectSlug: string } | Promise<{ orgSlug: string; projectSlug: string }>);
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
        const statsResponse = await fetch(`/api/projects/${projectId}/ai/stats?period=${selectedPeriod}`);
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

  // Refetch stats when period changes
  useEffect(() => {
    if (project?.id) {
      fetchAIStats(project.id, period);
    }
  }, [period, project]);

  async function fetchAIStats(projectId: string, selectedPeriod: string) {
    try {
      const statsResponse = await fetch(`/api/projects/${projectId}/ai/stats?period=${selectedPeriod}`);
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
            <Card key={i}>
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
        <Card>
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
            <Card key={i}>
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
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Hero Section */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={project.status === "active" ? "default" : "secondary"} className="gap-1.5">
              <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </Badge>
            <Badge variant="outline">
              {project.visibility.charAt(0).toUpperCase() + project.visibility.slice(1)}
            </Badge>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold break-words">{project.name}</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              {project.description || "No description provided"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
            <span className="hidden sm:inline">•</span>
            <span className="truncate">ID: {project.slug}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Button variant="outline" asChild className="flex-1 sm:flex-none">
            <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/settings`}>
              <Settings size={16} className="mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/edit`}>
              <Rocket size={16} className="mr-2" />
              Edit Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Time Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Analytics Overview</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI Requests Chart */}
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>AI Requests</CardDescription>
            <CardTitle className="text-3xl">{stats.aiRequests.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-20">
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    requests: {
                      label: "Requests",
                      color: "hsl(var(--primary))",
                    },
                  }}
                  className="h-full w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Bar
                        dataKey="count"
                        fill="var(--color-requests)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>AI Cost</CardDescription>
            <CardTitle className="text-3xl">{stats.aiCost.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-20">
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Bar
                        dataKey="cost"
                        fill="var(--color-cost)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardDescription>Avg Latency</CardDescription>
            <CardTitle className="text-3xl">{stats.avgLatency.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-20">
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    latency: {
                      label: "Latency",
                      color: "hsl(221.2 83.2% 53.3%)",
                    },
                  }}
                  className="h-full w-full"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <Bar
                        dataKey="count"
                        fill="var(--color-latency)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity size={20} />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest deployments and updates</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
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
