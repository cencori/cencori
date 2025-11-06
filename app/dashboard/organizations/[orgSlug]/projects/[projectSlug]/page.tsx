"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Home as HomeIcon } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  created_at: string;
}

export default function ProjectDetailsPage({
  params,
}: {
  params: { orgSlug: string; projectSlug: string } | Promise<{ orgSlug: string; projectSlug: string }>;
}) {
  // Resolve params safely for client component
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
          .select("id, name, slug, description, created_at")
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-muted-foreground">Loading project details...</p>
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
    <div className="container mx-auto py-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{project.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p><strong>Organization:</strong> {organization.name}</p>
          <p><strong>Project ID:</strong> {project.slug}</p>
          <p><strong>Description:</strong> {project.description || "No description provided."}</p>
          <p><strong>Created At:</strong> {new Date(project.created_at).toLocaleDateString()}</p>
        </CardContent>
      </Card>
    </div>
  );
}
