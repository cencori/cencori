"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Settings, Rocket, Activity, Clock, Zap, TrendingUp } from "lucide-react";
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
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [orgSlug, projectSlug, router]);

  // Mock data for stats - replace with real data later
  const stats = {
    deployments: { value: "24", change: "+12%", trend: "up" },
    apiCalls: { value: "1.2M", change: "+23%", trend: "up" },
    uptime: { value: "99.9%", change: "Last 30 days", trend: "stable" },
  };

  // Mock activity data - replace with real data later
  const recentActivity: ActivityItem[] = [
    { id: "1", type: "deployment", message: "Deployed to production", timestamp: "2 hours ago" },
    { id: "2", type: "update", message: "Updated environment variables", timestamp: "5 hours ago" },
    { id: "3", type: "deployment", message: "Deployed to staging", timestamp: "1 day ago" },
    { id: "4", type: "settings", message: "Changed visibility to public", timestamp: "2 days ago" },
  ];

  if (loading) {
    return (
      <div className="mx-92 py-24 space-y-6">
        {/* Hero Section Skeleton */}
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-96" />
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-28" />
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
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
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
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
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
    <div className="mx-92 py-24 space-y-6">
      {/* Hero Section */}
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={project.status === "active" ? "default" : "secondary"} className="gap-1.5">
              <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </Badge>
            <Badge variant="outline">
              {project.visibility.charAt(0).toUpperCase() + project.visibility.slice(1)}
            </Badge>
          </div>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground mt-1">
              {project.description || "No description provided"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock size={14} />
              Created {new Date(project.created_at).toLocaleDateString()}
            </span>
            <span>•</span>
            <span>ID: {project.slug}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/settings`}>
              <Settings size={16} className="mr-2" />
              Settings
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/edit`}>
              <Rocket size={16} className="mr-2" />
              Edit Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Deployments</CardDescription>
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Rocket size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <CardTitle className="text-3xl">{stats.deployments.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">{stats.deployments.change}</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>API Calls</CardDescription>
              <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                <Zap size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <CardTitle className="text-3xl">{stats.apiCalls.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <span className="text-emerald-600 dark:text-emerald-400">{stats.apiCalls.change}</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Uptime</CardDescription>
              <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <CardTitle className="text-3xl">{stats.uptime.value}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.uptime.change}
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

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for this project</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/edit`}>
                <Settings size={16} className="mr-2" />
                Edit Project Details
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/settings`}>
                <Settings size={16} className="mr-2" />
                Project Settings
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <Activity size={16} className="mr-2" />
              View Analytics
              <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
            </Button>
            <Button variant="outline" className="w-full justify-start" disabled>
              <Rocket size={16} className="mr-2" />
              Deploy Project
              <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
