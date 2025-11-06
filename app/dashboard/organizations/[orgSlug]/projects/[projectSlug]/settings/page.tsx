"use client";

import React, { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProjectData {
  id: string;
  name: string;
  slug: string; // Project ID
  organization_id: string;
  visibility: 'public' | 'private';
  status: 'active' | 'inactive';
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [projectVisibility, setProjectVisibility] = useState<'public' | 'private'>('private');
  const [projectStatus, setProjectStatus] = useState<'active' | 'inactive'>('active');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchProjectDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        if (!orgSlug || !projectSlug) {
          notFound();
          return;
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          // Handle unauthorized access, e.g., redirect to login
          // router.push("/login");
          notFound();
          return;
        }

        // First, get the organization ID using orgSlug
        const { data: organization, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("slug", orgSlug)
          .single();

        if (orgError || !organization) {
          console.error("Error fetching organization:", orgError?.message);
          notFound();
          return;
        }

        // Then, get project details using projectSlug and organization ID
        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, name, slug, organization_id, visibility, status")
          .eq("slug", projectSlug)
          .eq("organization_id", organization.id)
          .single();

        if (projectError || !projectData) {
          console.error("Error fetching project:", projectError?.message);
          notFound();
          return;
        }

        setProject(projectData);
        setProjectName(projectData.name);
        setProjectVisibility(projectData.visibility || 'private');
        setProjectStatus(projectData.status || 'active');
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [orgSlug, projectSlug]);

  const handleCopy = () => {
    if (project?.slug) {
      navigator.clipboard.writeText(project.slug);
      toast.success("Project ID copied to clipboard!");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (!project) {
        toast.error("Project data not available.");
        setIsSaving(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("projects")
        .update({ name: projectName, visibility: projectVisibility, status: projectStatus })
        .eq("id", project.id);

      if (updateError) {
        console.error("Error updating project name:", updateError.message);
        toast.error("Failed to update project name.");
      } else {
        setProject((prevProject) =>
          prevProject ? { ...prevProject, name: projectName } : null
        );
        toast.success("Project name updated successfully!");
      }
    } catch (err) {
      console.error("Unexpected error during save:", err);
      toast.error("An unexpected error occurred while saving.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmName !== project?.name) {
      toast.error("Project name does not match for deletion.");
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (deleteError) {
        console.error("Error deleting project:", deleteError.message);
        toast.error("Failed to delete project.");
      } else {
        toast.success("Project deleted successfully!");
        router.push(`/dashboard/organizations/${orgSlug}/projects`); // Redirect to projects list
      }
    } catch (err) {
      console.error("Unexpected error during deletion:", err);
      toast.error("An unexpected error occurred during deletion.");
    } finally {
      setShowDeleteDialog(false);
      setDeleteConfirmName("");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-muted-foreground">Loading project settings...</p>
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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-red-500">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-92 py-8 lg:py-16">
      <h1 className="text-xl font-bold mb-6">General Settings</h1>

      <Card >
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
          <CardDescription>View and manage your project's basic information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="projectName">Project name</Label>
            <Input
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="max-w-md"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="projectId">Project ID</Label>
            <div className="flex max-w-md space-x-2">
              <Input id="projectId" type="text" value={project.slug} readOnly />
              <Button onClick={handleCopy} variant="secondary" className="cursor-pointer">
                <CopyIcon className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" className="cursor-pointer">Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving || (projectName === project?.name && projectVisibility === project?.visibility && projectStatus === project?.status)} className="cursor-pointer">
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Visibility</CardTitle>
          <CardDescription>Control who can view and access this project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="projectVisibility">Visibility</Label>
            <Select
              value={projectVisibility}
              onValueChange={(value: 'public' | 'private') => setProjectVisibility(value)}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Project Status</CardTitle>
          <CardDescription>Set the current operational status of the project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <Label htmlFor="projectStatus">Status</Label>
            <Select
              value={projectStatus}
              onValueChange={(value: 'active' | 'inactive') => setProjectStatus(value)}
            >
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8 dark:border-red-900 border-red-500">
        <CardHeader>
          <CardTitle className="text-red-500">Delete Project</CardTitle>
          <CardDescription>Permanently remove this project and all its associated data. This action cannot be undone.</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="cursor-pointer">Delete Project</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm Project Deletion</DialogTitle>
                <DialogDescription>
                  This action is irreversible. To confirm, please type the project name (<b>{project.name}</b>) below.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  id="confirmDelete"
                  placeholder={project.name}
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="cursor-pointer">Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteProject}
                  disabled={deleteConfirmName !== project.name}
                  className="cursor-pointer"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
