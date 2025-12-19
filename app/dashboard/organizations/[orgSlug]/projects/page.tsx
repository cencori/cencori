"use client";

import React, { useEffect, useState } from "react";
import { supabase as browserSupabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound, useRouter } from "next/navigation";
import { FolderKanban, PlusIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal as MoreHorizontalIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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
  visibility: "private" | "public";
  github_repo_url?: string;
  status: "active" | "inactive";
  region?: string;
  created_at: string;
}

// Region display labels
const REGION_LABELS: Record<string, string> = {
  auto: "Auto",
  "us-east-1": "US East",
  "us-west-1": "US West",
  "us-west-2": "US West",
  "eu-west-1": "EU West",
  "eu-central-1": "EU Central",
  "ap-southeast-1": "AP Southeast",
  "ap-northeast-1": "AP Northeast",
  "ap-south-1": "AP South",
  "sa-east-1": "SA East",
  "ca-central-1": "CA Central",
  "me-south-1": "ME South",
  "af-south-1": "AF South",
};

export default function OrgProjectsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolved = await Promise.resolve(params);
        if (mounted && resolved && typeof (resolved as { orgSlug: string }).orgSlug === "string") {
          setOrgSlug((resolved as { orgSlug: string }).orgSlug);
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
  const [projects, setProjects] = useState<ProjectData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null);

  useEffect(() => {
    if (!orgSlug) return;

    const fetchOrgAndProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userError,
        } = await browserSupabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        const { data: orgData, error: orgError } = await browserSupabase
          .from("organizations")
          .select("id, name, slug")
          .eq("slug", orgSlug)
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          notFound();
          return;
        }
        setOrganization(orgData);

        const { data: projectsData, error: projectsError } = await browserSupabase
          .from("projects")
          .select("id, name, slug, description, visibility, github_repo_url, status, region, created_at")
          .eq("organization_id", orgData.id);

        if (projectsError) {
          console.error("Error fetching projects:", projectsError.message);
          setError("Error loading projects.");
          return;
        }
        setProjects(projectsData);
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrgAndProjects();
  }, [orgSlug, router]);

  const handleDeleteProject = async (projectId: string) => {
    setLoading(true);
    const { error: deleteError } = await browserSupabase.from("projects").delete().eq("id", projectId);

    if (deleteError) {
      console.error("Error deleting project:", deleteError.message);
      toast.error("Failed to delete project: " + deleteError.message);
    } else {
      toast.success("Project deleted successfully!");
      setProjects((prevProjects) => (prevProjects ? prevProjects.filter((p) => p.id !== projectId) : null));
    }
    setLoading(false);
    setIsDeleteDialogOpen(false);
  };

  if (!orgSlug || loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex items-center justify-between gap-4 mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="bg-card border border-border/40 rounded-md">
          <div className="border-b border-border/40 px-4 py-2">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-6 ml-auto" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-b border-border/40 px-4 py-3 last:border-b-0">
              <div className="grid grid-cols-4 gap-4 items-center">
                <div className="space-y-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-2.5 w-32" />
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-6 w-6 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xs text-red-500">{error}</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-xs text-red-500">Organization not found.</p>
      </div>
    );
  }

  const filteredProjects = projects?.filter(
    (project) =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.slug.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-base font-medium">Projects</h1>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for a project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            className="w-48 sm:w-64 h-7 pl-7 text-xs rounded border-border/50 bg-transparent placeholder:text-muted-foreground/60"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7 text-xs px-3">
              New project
              <ChevronDown size={12} className="ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link href={`/dashboard/organizations/${orgSlug}/projects/new`}>
                <PlusIcon size={14} className="mr-2" />
                Create new project
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="text-xs cursor-pointer">
              <Link href={`/dashboard/organizations/${orgSlug}/projects/import/github`}>
                <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                    fill="currentColor"
                  />
                </svg>
                Import from GitHub
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Projects Table */}
      {filteredProjects.length > 0 ? (
        <div className="bg-card border border-border/40 rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border/40">
                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Project</TableHead>
                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Region</TableHead>
                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Created</TableHead>
                <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right">Status</TableHead>
                <TableHead className="h-8 w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer hover:bg-secondary/30 border-b border-border/40 last:border-b-0 transition-colors"
                  onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}`)}
                >
                  <TableCell className="py-3 px-4">
                    <div className="text-[13px] font-medium">{project.name}</div>
                    <div className="text-[11px] text-muted-foreground">ID: {project.slug}</div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3 font-mono">
                    {project.region || "americas"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {(() => {
                      const date = new Date(project.created_at);
                      const day = date.getDate();
                      const month = date.toLocaleString("en-US", { month: "short" });
                      return `${month} ${day}, ${date.getFullYear()}`;
                    })()}
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <Badge variant="outline" className="gap-1.5 text-[11px] px-2 py-0.5 border-foreground/20 text-foreground">
                      <span
                        className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`}
                        aria-hidden="true"
                      ></span>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontalIcon className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-xs cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}/edit`);
                          }}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-xs cursor-pointer text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-16 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No projects found</p>
          <p className="text-xs text-muted-foreground mb-4">
            {searchTerm ? `No projects matching "${searchTerm}"` : `Create your first project for ${organization.name}`}
          </p>
          {!searchTerm && (
            <div className="flex items-center gap-2">
              <Button asChild size="sm" className="h-7 text-xs px-3">
                <Link href={`/dashboard/organizations/${orgSlug}/projects/new`}>Create project</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="h-7 text-xs px-3">
                <Link href={`/dashboard/organizations/${orgSlug}/projects/import/github`}>Import project</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-sm">Confirm Deletion</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete the project &quot;{projectToDelete?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id)} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}