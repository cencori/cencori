"use client";

import { supabase as browserSupabase } from "@/lib/supabaseClient"; // Use browser client
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound, redirect, useRouter } from "next/navigation"; // Import useRouter
import { Home as HomeIcon } from "lucide-react";
import { useBreadcrumbs } from "@/lib/contexts/BreadcrumbContext";
import { useEffect, useState } from "react"; // Import useState
import { PlusIcon } from '@/components/ui/plus';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Import Badge component
import { Input } from "@/components/ui/input"; // Import Input component
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // Import DropdownMenu components
import { MoreHorizontal as MoreHorizontalIcon } from "lucide-react"; // Import MoreHorizontalIcon

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
  const { setBreadcrumbs } = useBreadcrumbs();
  const router = useRouter(); // Initialize useRouter
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [projects, setProjects] = useState<ProjectData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>(""); // New state for search term

  useEffect(() => {
    const fetchOrgAndProjects = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { user }, error: userError } = await browserSupabase.auth.getUser();

        if (userError || !user) {
          redirect("/login");
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

        setBreadcrumbs([
          { label: "Organizations", href: "/dashboard/organizations" },
          { label: orgData.name, href: `/dashboard/organizations/${orgSlug}/projects` },
          { label: "Projects" },
        ]);

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
  }, [orgSlug, setBreadcrumbs]);

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
    <div className="container mx-auto py-8">
        <div className="flex items-center space-x-4 pb-4">
        <h1 className="text-xl font-bold">Projects</h1>
        </div>
      <div className="flex justify-between items-center mb-6">
      <Input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64"
          />
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
          <TableCaption>A list of your projects within {organization.name}.</TableCaption>
          <TableHeader className="border bg-muted/50">
            <TableRow className="border bg-muted/50">
              <TableHead>PROJECT</TableHead>
              <TableHead>VISIBILITY</TableHead>
              <TableHead>DATE CREATED</TableHead>
              <TableHead className="text-right">STATUS</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.filter(project =>
              project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              project.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              project.slug.toLowerCase().includes(searchTerm.toLowerCase())
            ).map((project) => (
              <TableRow key={project.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/organizations/${orgSlug}/projects/${project.slug}`)}>
                <TableCell className="font-light">
                  {project.name}
                  <p className="text-muted-foreground text-xs">ID: {project.slug}</p>
                </TableCell>
                <TableCell>
                  <Badge variant={project.visibility === 'public' ? 'outline' : 'outline'}>
                    {project.visibility.charAt(0).toUpperCase() + project.visibility.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(project.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <Badge variant={project.status === 'active' ? 'outline' : 'destructive'}>
                    <span
                      className={project.status === 'active' ? 'size-1.5 rounded-full bg-green-500' : 'size-1.5 rounded-full bg-destructive'}
                      aria-hidden="true"
                    />
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
                      <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); /* Handle Edit */ }}>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer" onClick={(e) => { e.stopPropagation(); /* Handle Delete */ }}>
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
    </div>
  );
}
