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

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="danger" className="text-red-500 data-[state=active]:text-red-500">Danger</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          {/* Organization Information */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Organization Information</h2>
              <p className="text-xs md:text-[10px] text-muted-foreground">Update your organization&apos;s name and description</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              {/* Name */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-border/40 gap-2 md:gap-0">
                <div className="space-y-0.5">
                  <p className="text-sm md:text-xs font-medium">Name</p>
                  <p className="text-xs md:text-[10px] text-muted-foreground">Displayed throughout the dashboard.</p>
                </div>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Organization name"
                  className="w-full md:w-64 h-10 md:h-8 text-sm md:text-xs"
                />
              </div>
              {/* Slug */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-border/40 gap-2 md:gap-0">
                <div className="space-y-0.5">
                  <p className="text-sm md:text-xs font-medium">Slug</p>
                  <p className="text-xs md:text-[10px] text-muted-foreground">Cannot be changed after creation.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 md:py-1 bg-muted/50 rounded-md font-mono text-sm md:text-xs text-muted-foreground">
                    {organization.slug}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 md:h-7 text-xs gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(organization.slug);
                      setSlugCopied(true);
                      toast.success("Slug copied");
                      setTimeout(() => setSlugCopied(false), 2000);
                    }}
                  >
                    {slugCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </Button>
                </div>
              </div>
              {/* Description */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-border/40 gap-2 md:gap-0">
                <div className="space-y-0.5">
                  <p className="text-sm md:text-xs font-medium">Description</p>
                  <p className="text-xs md:text-[10px] text-muted-foreground">A brief description of your organization.</p>
                </div>
                <Input
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  placeholder="Organization description"
                  className="w-full md:w-64 h-10 md:h-8 text-sm md:text-xs"
                />
              </div>
              {/* Plan */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between px-4 py-3 border-b border-border/40 gap-2 md:gap-0">
                <div className="space-y-0.5">
                  <p className="text-sm md:text-xs font-medium">Plan</p>
                  <p className="text-xs md:text-[10px] text-muted-foreground">Your current subscription tier.</p>
                </div>
                <Badge variant="outline" className="text-xs md:text-[10px] h-7 md:h-5 w-fit">
                  {organization.organization_plans?.[0]?.name
                    ? organization.organization_plans[0].name.charAt(0).toUpperCase() +
                    organization.organization_plans[0].name.slice(1)
                    : "Free"}
                </Badge>
              </div>
              {/* Save Button Row */}
              <div className="flex justify-end px-4 py-2.5 md:py-2 bg-muted/20">
                <Button size="sm" className="h-9 md:h-7 px-4 md:px-3 text-sm md:text-xs" onClick={handleSaveOrganization} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>
          </section>
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
        <TabsContent value="members" className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Team Members</h2>
              <p className="text-xs md:text-[10px] text-muted-foreground">Invite and manage team members.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="text-center py-12 md:py-10 flex flex-col items-center px-4">
                <div className="w-12 h-12 md:w-10 md:h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                  <Users className="h-6 w-6 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">Team Management Coming Soon</p>
                <p className="text-xs text-muted-foreground">
                  Invite team members and assign roles
                </p>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* API KEYS TAB */}
        <TabsContent value="api-keys" className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">API Keys</h2>
              <p className="text-xs md:text-[10px] text-muted-foreground">Generate and manage organization-level API keys.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="text-center py-12 md:py-10 flex flex-col items-center px-4">
                <div className="w-12 h-12 md:w-10 md:h-10 rounded-md bg-secondary flex items-center justify-center mb-3">
                  <Key className="h-6 w-6 md:h-5 md:w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-1">API Key Management Coming Soon</p>
                <p className="text-xs text-muted-foreground">
                  Generate and manage API keys
                </p>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* DANGER ZONE TAB */}
        <TabsContent value="danger" className="space-y-6">
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Delete Organization</h2>
              <p className="text-xs md:text-[10px] text-muted-foreground">Permanently remove your organization and its data.</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 md:h-4 md:w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="space-y-2.5 md:space-y-2 flex-1">
                    <div className="space-y-0.5">
                      <p className="text-sm md:text-xs font-medium">Deleting this organization will remove all data.</p>
                      <p className="text-xs md:text-[10px] text-muted-foreground">
                        This includes all projects, API keys, logs, and analytics. This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full md:w-auto h-10 md:h-7 text-sm md:text-xs gap-1.5"
                      onClick={() => {
                        setConfirmDeleteText("");
                        setIsDeleteOrgDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
                      Delete Organization
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
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
