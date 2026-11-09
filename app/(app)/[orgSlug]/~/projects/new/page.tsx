/* eslint-disable react/no-unescaped-entities */
"use client";

import { getBrowserAuthUser } from "@/lib/auth/get-browser-auth-user";

import { useRouter } from "next/navigation";
import React, { useState, use } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@/lib/utils";
import { isReservedProjectSlug } from "@/lib/reserved-slugs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { UpgradeDialog } from "@/components/billing/UpgradeDialog";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
}

/**
 * Every project runs in one place: the app, database, files and logs are on Brimble afr-west in
 * Lagos. There is no region to pick. projects.region still has a check constraint (projects_region_check)
 * that rejects the column default, so creation sends the closest value it accepts. Nothing reads it.
 */
const STORED_REGION = "af-south-1";

const formSchema = z.object({
  name: z.string().min(2, { message: "Project name must be at least 2 characters." }),
  description: z.string().optional(),
  region: z.literal(STORED_REGION),
});

type FormValues = z.infer<typeof formSchema>;

interface PageProps {
  params: Promise<{ orgSlug: string }>;
}

// Hook to fetch org with caching
function useOrganization(orgSlug: string) {
  return useQuery({
    queryKey: ["organizationProjectCreation", orgSlug],
    queryFn: async () => {
      const { data: { user }, error: userError } = await getBrowserAuthUser(supabase);
      if (userError || !user) throw new Error("Not authenticated");

      const { data: orgData, error: fetchError } = await supabase
        .from("organizations")
        .select("id, name, slug, subscription_tier")
        .eq("slug", orgSlug)
        .eq("owner_id", user.id)
        .single();

      if (fetchError || !orgData) throw new Error("Organization not found or you don't have permission.");
      return orgData as OrganizationData;
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export default function NewProjectPage({ params }: PageProps) {
  const { orgSlug } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // Fetch org with caching - INSTANT ON REVISIT!
  const { data: organization, isLoading: orgLoading, error: orgError } = useOrganization(orgSlug);
  const { refetchData } = useOrganizationProject();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      region: STORED_REGION,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);

    const { data: { user } } = await getBrowserAuthUser(supabase);

    if (!user) {
      toast.error("You must be logged in to create a project.");
      setLoading(false);
      return;
    }

    if (!organization) {
      toast.error("Organization data is not loaded yet. Please try again.");
      setLoading(false);
      return;
    }

    // Enforce free tier project limit
    const tier = organization.subscription_tier || 'free';
    if (tier === 'free') {
      const { count } = await supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organization.id);
      if ((count ?? 0) >= 1) {
        setLoading(false);
        setUpgradeOpen(true);
        return;
      }
    }

    const baseSlug = slugify(values.name) || "project";
    let newSlug = baseSlug;
    let slugExists = true;

    for (let i = 0; i < 20; i++) {
      // Skip slugs that would collide with an org-level route.
      if (isReservedProjectSlug(newSlug)) {
        newSlug = `${baseSlug}-${i + 2}`;
        continue;
      }
      const { data } = await supabase
        .from("projects")
        .select("slug")
        .eq("organization_id", organization.id)
        .eq("slug", newSlug)
        .single();

      if (!data) {
        slugExists = false;
        break;
      }
      newSlug = `${baseSlug}-${i + 2}`;
    }

    if (slugExists) {
      toast.error("Could not generate a unique project slug. Please try a different name.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("projects").insert({
      name: values.name,
      slug: newSlug,
      description: values.description || null,
      organization_id: organization.id,
      visibility: "private",
      region: values.region,
    });

    if (error?.message?.includes("project_limit_reached")) {
      // The Free plan's project limit, enforced by the database.
      setUpgradeOpen(true);
    } else if (error) {
      console.error("Error creating project:", error.message);
      toast.error("Failed to create project. " + error.message);
    } else {
      toast.success("Project created successfully!");
      // Refresh breadcrumb data + invalidate projects-list cache so the
      // new project shows up immediately on /{org}/~/projects.
      await refetchData();
      await queryClient.invalidateQueries({ queryKey: ["orgProjects", orgSlug] });
      router.push(`/${orgSlug}/${newSlug}`);
    }
    setLoading(false);
  };

  if (orgLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto px-0 sm:px-6 pt-0 pb-10 sm:pt-10">
        <div className="mb-8">
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="bg-card border border-border/40 rounded-md">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4 border-b border-border/40 last:border-b-0">
              <Skeleton className="h-3 w-12" />
              <div className="space-y-1.5">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-2.5 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xs text-red-500">{orgError.message}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-6 pt-0 pb-10 sm:pt-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base font-medium mb-1">Create a new project</h1>
        <p className="text-xs text-muted-foreground">
          Projects contain API keys and configurations for your AI integrations in {organization?.name}.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-card border border-border/40 rounded-md">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          {/* Name Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4 border-b border-border/40">
            <label htmlFor="name" className="text-xs font-medium pt-2">
              Name
            </label>
            <div className="space-y-1.5">
              <Input
                id="name"
                placeholder="Project name"
                autoComplete="off"
                className="h-8 text-xs bg-secondary/50 border-border/50"
                {...form.register("name")}
              />
              <p className="text-[11px] text-muted-foreground">
                What's the name of your project? You can change this later.
              </p>
              {form.formState.errors.name && (
                <p className="text-[11px] text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          {/* Description Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4 border-b border-border/40">
            <label htmlFor="description" className="text-xs font-medium pt-2">
              Description
            </label>
            <div className="space-y-1.5">
              <Input
                id="description"
                placeholder="A brief description (optional)"
                autoComplete="off"
                className="h-8 text-xs bg-secondary/50 border-border/50"
                {...form.register("description")}
              />
              <p className="text-[11px] text-muted-foreground">
                Optional description to help identify this project.
              </p>
            </div>
          </div>

          {/* Region Field */}
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-6 p-4">
            <span className="text-xs font-medium pt-2">
              Region
            </span>
            <div className="space-y-1.5">
              <div className="flex h-8 items-center gap-2 text-xs">
                <span className="text-sm">🇳🇬</span>
                <span>Lagos, Nigeria</span>
                <span className="font-mono text-[10px] text-muted-foreground">afr-west</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Every project runs in Lagos. Its data and logs are stored there.</p>
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-3"
          onClick={() => router.push(`/${orgSlug}/~/projects`)}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-7 text-xs px-4"
          disabled={loading}
          onClick={form.handleSubmit(onSubmit)}
        >
          {loading ? "Creating..." : "Create project"}
        </Button>
      </div>

      {/* Upgrade dialog — shown when free plan project limit is hit */}
      {organization && (
        <UpgradeDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          orgId={organization.id}
          orgSlug={orgSlug}
          orgName={organization.name}
          reason="projects"
          recommendedTier="pro"
        />
      )}
    </div>
  );
}
