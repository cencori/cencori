"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Use browser client
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound, useRouter } from "next/navigation"; // Import useRouter
import { Home as HomeIcon } from "lucide-react";
import { useEffect, useState } from "react"; // Import useState
import { PlusIcon } from '@/components/ui/plus';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Import Badge component
import { Input } from "@/components/ui/input"; // Import Input component
import { Search } from "lucide-react"; // Import Search icon
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import { MoreHorizontal as MoreHorizontalIcon } from "lucide-react"; // Import MoreHorizontalIcon
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Import Dialog components
import { toast } from "sonner";

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
  visibility: 'private' | 'public';
  github_repo_url?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export default function OrgProjectsPage({ params }: { params: { orgSlug: string } }) {
  const { orgSlug } = params;
  const router = useRouter(); // Initialize useRouter
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [projects, setProjects] = useState<ProjectData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // New state for search term
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false); // State for delete dialog
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null); // Project to delete

  useEffect(() => {
    const fetchOrgAndProjects = async () => {
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
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          notFound();
          return;
        }
        setOrganization(orgData);

        // setBreadcrumbs([
        //   { label: "Organizations", href: "/dashboard/organizations" },
        //   { label: orgData.name, href: `/dashboard/organizations/${orgSlug}/projects` },
        //   { label: "Projects" },
        // ]);

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
  }, [orgSlug]);

  const handleDeleteProject = async (projectId: string) => {
    setLoading(true);
    const { error: deleteError } = await browserSupabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (deleteError) {
      console.error("Error deleting project:", deleteError.message);
      toast.error("Failed to delete project: " + deleteError.message);
    } else {
      toast.success("Project deleted successfully!");
      // Remove the deleted project from the state
      setProjects((prevProjects) =>
        prevProjects ? prevProjects.filter((p) => p.id !== projectId) : null
      );
    }
    setLoading(false);
    setIsDeleteDialogOpen(false); // Close dialog after action
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-muted-foreground">Loading projects...</p>
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
    <div className="mx-92 py-24 bg-background">
        <div className="flex items-center space-x-4 pb-12">
        <h1 className="text-xl font-bold">Projects</h1>
        </div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs pl-8"
          />
        </div>
          <Button asChild>
            <Link href={`/dashboard/organizations/${orgSlug}/projects/new`}>
              <PlusIcon size={16} className="mr-2" />
              New Project
            </Link>
          </Button>
      </div>

      {/* Filter projects based on search term */}
      {projects && projects.length > 0 ? (
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="bg-muted/50">
              <TableHead>PROJECT</TableHead>
              <TableHead>DATE CREATED</TableHead>
              <TableHead className="text-right">STATUS</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="border">
            {projects.filter(project =>
              project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              project.slug.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((project) => (
              <TableRow key={project.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}`)}>
                <TableCell className="font-medium">
                  {project.name}
                  <p className="text-muted-foreground text-xs">ID: {project.slug}</p>
                </TableCell>
                <TableCell>
                  {(() => {
                    const date = new Date(project.created_at);
                    const day = date.getDate().toString().padStart(2, '0');
                    const month = date.toLocaleString('en-US', { month: 'short' });
                    const hours = date.getHours().toString().padStart(2, '0');
                    const minutes = date.getMinutes().toString().padStart(2, '0');
                    const seconds = date.getSeconds().toString().padStart(2, '0');
                    return `${day} ${month} ${hours}:${minutes}:${seconds}`;
                  })()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Badge variant={'outline'} className="gap-1.5 flex items-center">
                      <span
                        className={`size-1.5 rounded-full ${project.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`}
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
      ) : (
        <div className="text-center p-10 border rounded-lg">
          <p className="text-xl mb-4">No projects found for {organization.name}.</p>
          <Button asChild>
            <Link href={`/dashboard/organizations/${orgSlug}/projects/new`}>
              Create Your First Project
            </Link>
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project &quot;{projectToDelete?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => projectToDelete && handleDeleteProject(projectToDelete.id)}
              disabled={loading}
            >
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}