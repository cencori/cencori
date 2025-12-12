"use client";

import React, { useEffect, useState } from "react";
import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Use browser client
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound, useRouter } from "next/navigation";
import { FolderCog, Home as HomeIcon } from "lucide-react";
import { PlusIcon } from "@/components/ui/plus";
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
import { Fan } from "@/components/animate-ui/icons/fan";
import { Skeleton } from "@/components/ui/skeleton";
import { TechnicalBorder } from "@/components/landing/TechnicalBorder";

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
  created_at: string;
}

export default function OrgProjectsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  // Resolve params (works whether params is a plain object or a Promise)
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
    if (!orgSlug) return; // wait until slug is resolved

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
          .select("id, name, slug, description, visibility, github_repo_url, status, created_at")
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
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center space-x-4 pb-12">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <Table className="border">
            <TableHeader className="bg-muted/50">
              <TableRow className="bg-muted/50">
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableHead>
                <TableHead className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-5 w-48 mb-1" />
                    <Skeleton className="h-3 w-32" />
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-6 w-16 ml-auto" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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

  if (!organization) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">Organization not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center space-x-4 pb-6 sm:pb-12">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="relative w-full sm:w-auto">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:max-w-xs pl-8 bg-background border-input"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full sm:w-auto">
              New Project
              <ChevronDown size={16} className="ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/new`} className="cursor-pointer">
                <PlusIcon size={16} className="mr-2" />
                Create New Project
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/import/github`} className="cursor-pointer">
                <svg className="mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
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

      {projects && projects.length > 0 ? (
        <TechnicalBorder className="w-full bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/50">
                  <TableHead className="w-[300px]">Project</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects
                  .filter(
                    (project) =>
                      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      project.slug.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}`)}
                    >
                      <TableCell className="font-medium">
                        {project.name}
                        <p className="text-muted-foreground text-xs">{project.slug}</p>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const date = new Date(project.created_at);
                          const day = date.getDate();
                          const month = date.toLocaleString("en-US", { month: "short" });
                          return `${month} ${day}, ${date.getFullYear()}`;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Badge variant={"outline"} className="gap-1.5 flex items-center border-foreground/20 text-foreground">
                            <span
                              className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`}
                              aria-hidden="true"
                            ></span>
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}/edit`);
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer text-red-600"
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
        </TechnicalBorder>
      ) : (
        <div className="text-center p-32 flex flex-col items-center justify-center">
          <FolderCog />
          <p className="text-xl mb-4 mt-4">No projects found for {organization.name}.</p>
          <div className="flex items-center space-x-2">
            <Button asChild>
              <Link href={`/dashboard/organizations/${orgSlug}/projects/new`}>Create Project</Link>
            </Button>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link href={`/dashboard/organizations/${orgSlug}/projects/import/github`}>Import Project</Link>
            </Button>
          </div>
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project &quot;{projectToDelete?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id)} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}