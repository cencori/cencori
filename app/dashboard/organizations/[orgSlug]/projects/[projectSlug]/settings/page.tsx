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
import { CopyIcon, Settings, AlertTriangle, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  description?: string;
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
  const [projectDescription, setProjectDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [projectVisibility, setProjectVisibility] = useState<'public' | 'private'>('private');
  const [projectStatus, setProjectStatus] = useState<'active' | 'inactive'>('active');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const router = useRouter();

  // Get context to update breadcrumbs
  const { updateProject: updateProjectContext } = useOrganizationProject();

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
          .select("id, name, slug, description, organization_id, visibility, status")
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
        setProjectDescription(projectData.description || "");
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
        .update({
          name: projectName,
          description: projectDescription,
          visibility: projectVisibility,
          status: projectStatus
        })
        .eq("id", project.id);

      if (updateError) {
        console.error("Error updating project:", updateError.message);
        toast.error("Failed to update project.");
      } else {
        setProject((prevProject) =>
          prevProject ? {
            ...prevProject,
            name: projectName,
            description: projectDescription,
            visibility: projectVisibility,
            status: projectStatus
          } : null
        );
        toast.success("Project updated successfully!");

        // Update context for real-time breadcrumb updates
        updateProjectContext(project.id, { name: projectName, description: projectDescription });
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
        router.push(`/dashboard/organizations/${orgSlug}/projects`);
      }
    } catch (err) {
      console.error("Unexpected error during deletion:", err);
      toast.error("An unexpected error occurred during deletion.");
    } finally {
      setShowDeleteDialog(false);
      setDeleteConfirmName("");
    }
  };

  // Check if any changes have been made
  const hasChanges = project && (
    projectName !== project.name ||
    projectDescription !== (project.description || "") ||
    projectVisibility !== project.visibility ||
    projectStatus !== project.status
  );

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
    <div className="mx-92 py-24">
      <div className="flex items-center space-x-4 pb-12">
        <Settings className="h-6 w-6" />
        <h1 className="text-xl font-bold">Project Settings</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                View and manage your project&apos;s basic information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-slug">Project ID</Label>
                <div className="flex space-x-2">
                  <Input
                    id="project-slug"
                    value={project.slug}
                    readOnly
                    className="bg-muted"
                  />
                  <Button onClick={handleCopy} variant="secondary" className="cursor-pointer shrink-0">
                    <CopyIcon className="mr-2 h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The project ID cannot be changed after creation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Input
                  id="project-description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Enter project description"
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label htmlFor="project-visibility">Visibility</Label>
                <Select
                  value={projectVisibility}
                  onValueChange={(value: 'public' | 'private') => setProjectVisibility(value)}
                >
                  <SelectTrigger id="project-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Control who can view and access this project
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="project-status">Status</Label>
                <Select
                  value={projectStatus}
                  onValueChange={(value: 'active' | 'inactive') => setProjectStatus(value)}
                >
                  <SelectTrigger id="project-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-red-500" />
                        Inactive
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Set the current operational status of the project
                </p>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DANGER ZONE TAB */}
        <TabsContent value="danger" className="space-y-6">
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </div>
              <CardDescription>
                Irreversible and destructive actions for this project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-6">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Delete Project
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  Once you delete this project, there is no going back. This will permanently
                  delete the project and all associated data and settings.
                </p>
                <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                  <DialogTrigger asChild>
                    <Button
                      variant="destructive"
                      className="cursor-pointer bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
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
                        className="cursor-pointer bg-red-600 hover:bg-red-700"
                      >
                        I understand, delete this project
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
