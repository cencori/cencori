"use client";

import React, { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Users, Key, AlertTriangle, Copy, Check, Settings } from "lucide-react";
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import { Skeleton } from "@/components/ui/skeleton";

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

// Hook to fetch org and projects with caching
function useOrgSettings(orgSlug: string) {
  return useQuery({
    queryKey: ["orgSettings", orgSlug],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("id, name, slug, description, plan_id, organization_plans(name)")
        .eq("slug", orgSlug)
        .single();

      if (orgError || !orgData) throw new Error("Organization not found");

      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, name, slug, status, created_at")
        .eq("organization_id", orgData.id);

      return {
        organization: orgData as OrganizationData,
        projects: (projectsData || []) as ProjectData[],
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export default function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { updateOrganization: updateOrgContext, refetchData } = useOrganizationProject();

  // Local state
  const [isDeleteProjectDialogOpen, setIsDeleteProjectDialogOpen] = useState(false);
  const [isDeleteOrgDialogOpen, setIsDeleteOrgDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [slugCopied, setSlugCopied] = useState(false);

  // Fetch org with caching - INSTANT ON REVISIT!
  const { data, isLoading, error } = useOrgSettings(orgSlug);
  const organization = data?.organization;
  const projects = data?.projects || [];

  // Sync form state when org loads
  React.useEffect(() => {
    if (organization) {
      setOrgName(organization.name);
      setOrgDescription(organization.description || "");
    }
  }, [organization]);

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgSettings", orgSlug] });
      toast.success("Project deleted");
      setIsDeleteProjectDialogOpen(false);
      setProjectToDelete(null);
    },
    onError: () => toast.error("Failed to delete project"),
  });

  // Delete org mutation
  const deleteOrgMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("organizations").delete().eq("id", organization!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate the organizations list cache
      refetchData();
      toast.success("Organization deleted");
      setIsDeleteOrgDialogOpen(false);
      setConfirmDeleteText("");
      router.push("/dashboard/organizations");
    },
    onError: () => toast.error("Failed to delete organization"),
  });

  const handleSaveOrganization = async () => {
    if (!organization) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name: orgName, description: orgDescription })
      .eq("id", organization.id);

    if (error) {
      toast.error("Failed to update organization");
    } else {
      toast.success("Organization updated");
      queryClient.invalidateQueries({ queryKey: ["orgSettings", orgSlug] });
      updateOrgContext(organization.id, { name: orgName, description: orgDescription });
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <Skeleton className="h-5 w-40 mb-6" />
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  if (error || !organization) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <div className="text-center py-16 flex flex-col items-center">
          <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Organization not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-base font-medium">Organization Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your organization</p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="h-8">
          <TabsTrigger value="general" className="text-xs h-7 px-3">General</TabsTrigger>
          <TabsTrigger value="projects" className="text-xs h-7 px-3">Projects</TabsTrigger>
          <TabsTrigger value="members" className="text-xs h-7 px-3">Members</TabsTrigger>
          <TabsTrigger value="api-keys" className="text-xs h-7 px-3">API Keys</TabsTrigger>
          <TabsTrigger value="danger" className="text-xs h-7 px-3 text-red-500 data-[state=active]:text-red-500">Danger</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general">
          <div className="rounded-md border border-border/40 bg-card p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium mb-0.5">Organization Information</h3>
              <p className="text-[10px] text-muted-foreground">Update your organization&apos;s name and description</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-name" className="text-xs">Name</Label>
                <Input
                  id="org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org-slug" className="text-xs">Slug</Label>
                <div className="flex gap-2">
                  <Input id="org-slug" value={organization.slug} disabled className="h-8 text-xs bg-muted font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(organization.slug);
                      setSlugCopied(true);
                      toast.success("Slug copied");
                      setTimeout(() => setSlugCopied(false), 2000);
                    }}
                  >
                    {slugCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Cannot be changed after creation</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="org-description" className="text-xs">Description</Label>
                <Input
                  id="org-description"
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Organization description"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs">Plan</Label>
                <div>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {organization.organization_plans?.[0]?.name
                      ? organization.organization_plans[0].name.charAt(0).toUpperCase() +
                      organization.organization_plans[0].name.slice(1)
                      : "Free"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSaveOrganization} disabled={isSaving} size="sm" className="h-7 text-xs">
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* PROJECTS TAB */}
        <TabsContent value="projects">
          <div className="rounded-md border border-border/40 bg-card overflow-hidden">
            <div className="p-4 border-b border-border/40">
              <h3 className="text-xs font-medium mb-0.5">Projects</h3>
              <p className="text-[10px] text-muted-foreground">Manage projects in this organization</p>
            </div>
            {projects.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/40">
                    <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 px-4">Name</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Slug</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Status</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8">Created</TableHead>
                    <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider h-8 text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                      <TableCell className="py-2.5 px-4 text-xs font-medium">{project.name}</TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground font-mono">{project.slug}</TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                          <span className={`size-1.5 rounded-full ${project.status === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2.5 text-xs text-muted-foreground">
                        {new Date(project.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="py-2.5 text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => {
                            setProjectToDelete(project);
                            setIsDeleteProjectDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-xs">No projects found</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* MEMBERS TAB */}
        <TabsContent value="members">
          <div className="rounded-md border border-border/40 bg-card p-4">
            <div className="text-center py-12 flex flex-col items-center">
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                <Users className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Team Management Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                Invite team members and assign roles
              </p>
            </div>
          </div>
        </TabsContent>

        {/* API KEYS TAB */}
        <TabsContent value="api-keys">
          <div className="rounded-md border border-border/40 bg-card p-4">
            <div className="text-center py-12 flex flex-col items-center">
              <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                <Key className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">API Key Management Coming Soon</p>
              <p className="text-xs text-muted-foreground">
                Generate and manage API keys
              </p>
            </div>
          </div>
        </TabsContent>

        {/* DANGER ZONE TAB */}
        <TabsContent value="danger">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-xs font-medium text-red-500">Danger Zone</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4">
              Irreversible and destructive actions
            </p>

            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-4">
              <h4 className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Delete Organization</h4>
              <p className="text-[10px] text-muted-foreground mb-3">
                Permanently delete this organization and all associated projects.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setConfirmDeleteText("");
                  setIsDeleteOrgDialogOpen(true);
                }}
              >
                <Trash2 className="h-3 w-3 mr-1.5" />
                Delete Organization
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Project Dialog */}
      <Dialog open={isDeleteProjectDialogOpen} onOpenChange={setIsDeleteProjectDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-sm">Delete Project</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              className="h-7 text-xs"
              onClick={() => projectToDelete && deleteProjectMutation.mutate(projectToDelete.id)}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <AlertDialog open={isDeleteOrgDialogOpen} onOpenChange={(open) => {
        setIsDeleteOrgDialogOpen(open);
        if (!open) setConfirmDeleteText("");
      }}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Delete Organization</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete the organization and all projects.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-3">
            <Label htmlFor="confirm-delete" className="text-xs">
              Type <span className="font-mono font-medium">{organization.name}</span> to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmDeleteText}
              onChange={(e) => setConfirmDeleteText(e.target.value)}
              placeholder="Organization name"
              disabled={deleteOrgMutation.isPending}
              className="h-8 text-xs"
            />
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={deleteOrgMutation.isPending} className="h-7 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteOrgMutation.mutate()}
              disabled={confirmDeleteText !== organization.name || deleteOrgMutation.isPending}
              className="h-7 text-xs bg-red-600 hover:bg-red-700"
            >
              {deleteOrgMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
