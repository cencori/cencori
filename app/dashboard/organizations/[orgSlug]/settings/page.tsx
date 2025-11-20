"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Settings, Trash2, Users, Key, AlertTriangle } from "lucide-react";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  plan_id: string;
  organization_plans: { name: string }[];
}

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  status: "active" | "inactive";
  created_at: string;
}

export default function OrganizationSettingsPage({
  params,
}: {
  params: { orgSlug: string } | Promise<{ orgSlug: string }>;
}) {
  const router = useRouter();
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);
  const [isDeleteOrgDialogOpen, setIsDeleteOrgDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  // Editable fields
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Get context to update breadcrumbs
  const { updateOrganization: updateOrgContext } = useOrganizationProject();

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

  useEffect(() => {
    if (!orgSlug) return;

    const fetchOrganizationData = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push("/login");
          return;
        }

        // Fetch organization details
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, slug, description, plan_id, organization_plans(name)")
          .eq("slug", orgSlug)
          .single();

        if (orgError || !orgData) {
          console.error("Error fetching organization:", orgError?.message);
          toast.error("Failed to load organization");
          return;
        }

        setOrganization(orgData);
        setOrgName(orgData.name);
        setOrgDescription(orgData.description || "");

        // Fetch projects
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, slug, status, created_at")
          .eq("organization_id", orgData.id);

        if (projectsError) {
          console.error("Error fetching projects:", projectsError.message);
        } else {
          setProjects(projectsData || []);
        }
      } catch (err: unknown) {
        console.error("Unexpected error:", (err as Error).message);
        toast.error("An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [orgSlug, router]);

  const handleSaveOrganization = async () => {
    if (!organization) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: orgName,
        description: orgDescription,
      })
      .eq("id", organization.id);

    if (error) {
      console.error("Error updating organization:", error.message);
      toast.error("Failed to update organization");
    } else {
      toast.success("Organization updated successfully!");
      setOrganization({ ...organization, name: orgName, description: orgDescription });

      // Update context for real-time breadcrumb updates
      updateOrgContext(organization.id, { name: orgName, description: orgDescription });
    }
    setIsSaving(false);
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    const { error } = await supabase.from("projects").delete().eq("id", projectToDelete.id);

    if (error) {
      console.error("Error deleting project:", error.message);
      toast.error("Failed to delete project");
    } else {
      toast.success("Project deleted successfully!");
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
    }
    setIsDeleteProjectDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleDeleteOrganization = async () => {
    if (!organization || confirmDeleteText !== organization.slug) return;

    // Delete organization - this should cascade delete projects if set up in DB
    const { error } = await supabase.from("organizations").delete().eq("id", organization.id);

    if (error) {
      console.error("Error deleting organization:", error.message);
      toast.error("Failed to delete organization");
    } else {
      toast.success("Organization deleted successfully!");
      router.push("/dashboard/organizations");
    }
  };

  if (!orgSlug || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <p className="text-sm text-muted-foreground">Loading settings...</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center space-x-4 pb-12">
        <Settings className="h-6 w-6" />
        <h1 className="text-xl font-bold">Organization Settings</h1>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Information</CardTitle>
              <CardDescription>
                Update your organization&apos;s name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organization name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-slug">Organization Slug</Label>
                <Input id="org-slug" value={organization.slug} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  The slug cannot be changed after creation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="org-description">Description</Label>
                <Input
                  id="org-description"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Enter organization description"
                />
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label>Current Plan</Label>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-sm">
                    {organization.organization_plans[0]?.name?.charAt(0).toUpperCase() +
                      organization.organization_plans[0]?.name?.slice(1) || "Free"}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveOrganization} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROJECTS TAB */}
        <TabsContent value="projects" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Projects Management</CardTitle>
              <CardDescription>
                View and manage all projects under this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {projects.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{project.name}</TableCell>
                        <TableCell className="text-muted-foreground">{project.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1.5 flex items-center w-fit">
                            <span
                              className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"
                                }`}
                              aria-hidden="true"
                            />
                            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(project.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setProjectToDelete(project);
                              setIsDeleteProjectDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No projects found in this organization</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage team members and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Team Management Coming Soon</p>
                <p className="text-sm">
                  Invite team members and assign roles to collaborate on your projects
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API KEYS TAB */}
        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for programmatic access to your organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">API Key Management Coming Soon</p>
                <p className="text-sm">
                  Generate and manage API keys to integrate with your applications
                </p>
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
                Irreversible and destructive actions for this organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-6">
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Delete Organization
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  Once you delete this organization, there is no going back. This will permanently
                  delete the organization and all associated projects, data, and settings.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteOrgDialogOpen(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Organization
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Project Dialog */}
      <Dialog open={isDeleteProjectDialogOpen} onOpenChange={setIsDeleteProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={isDeleteOrgDialogOpen} onOpenChange={setIsDeleteOrgDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the organization, all
              projects, and remove all data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-bold">{organization.slug}</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder="Enter organization slug"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" onClick={() => setConfirmDeleteText("")}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDeleteOrganization}
              disabled={confirmDeleteText !== organization.slug}
              className="bg-red-600 hover:bg-red-700"
            >
              I understand, delete this organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
