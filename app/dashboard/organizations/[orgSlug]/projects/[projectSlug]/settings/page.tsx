"use client";

import React, { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Globe, Zap, Clock, Webhook, Server, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useOrganizationProject } from "@/lib/contexts/OrganizationProjectContext";
import Link from "next/link";

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
  const [copiedSlug, setCopiedSlug] = useState(false);
  const router = useRouter();

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

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          notFound();
          return;
        }

        const { data: organization, error: orgError } = await supabase
          .from("organizations")
          .select("id")
          .eq("slug", orgSlug)
          .single();

        if (orgError || !organization) {
          notFound();
          return;
        }

        const { data: projectData, error: projectError } = await supabase
          .from("projects")
          .select("id, name, slug, description, organization_id, visibility, status")
          .eq("slug", projectSlug)
          .eq("organization_id", organization.id)
          .single();

        if (projectError || !projectData) {
          notFound();
          return;
        }

        setProject(projectData);
        setProjectName(projectData.name);
        setProjectDescription(projectData.description || "");
        setProjectVisibility(projectData.visibility || 'private');
        setProjectStatus(projectData.status || 'active');
      } catch {
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
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
      toast.success("Copied!");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!project) return;

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
        toast.error("Failed to save.");
      } else {
        setProject(prev => prev ? { ...prev, name: projectName, description: projectDescription, visibility: projectVisibility, status: projectStatus } : null);
        toast.success("Saved!");
        updateProjectContext(project.id, { name: projectName, description: projectDescription });
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmName !== project?.name) {
      toast.error("Name doesn't match.");
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);

      if (deleteError) {
        toast.error("Failed to delete.");
      } else {
        toast.success("Project deleted!");
        router.push(`/dashboard/organizations/${orgSlug}/projects`);
      }
    } catch {
      toast.error("An error occurred.");
    } finally {
      setShowDeleteDialog(false);
      setDeleteConfirmName("");
    }
  };

  const hasChanges = project && (
    projectName !== project.name ||
    projectDescription !== (project.description || "") ||
    projectVisibility !== project.visibility ||
    projectStatus !== project.status
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 space-y-8">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-500">{error || "Project not found."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl py-6 space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">Configure general options and project lifecycle.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-6">
          {/* General Settings */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium">General settings</h2>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              {/* Project Name */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Project name</p>
                  <p className="text-[10px] text-muted-foreground">Displayed throughout the dashboard.</p>
                </div>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-64 h-8 text-sm"
                />
              </div>
              {/* Project ID */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Project ID</p>
                  <p className="text-[10px] text-muted-foreground">Reference used in APIs and URLs.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={project.slug}
                    readOnly
                    className="w-52 h-8 bg-muted/50 font-mono text-xs"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                    {copiedSlug ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              {/* Save Button Row */}
              <div className="flex justify-end px-4 py-2 bg-muted/20">
                <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={isSaving || !hasChanges}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </section>

          {/* Project Status */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Project status</h2>
              <p className="text-[10px] text-muted-foreground">Pause or activate your project.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              {/* Status Toggle */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Status</p>
                  <p className="text-[10px] text-muted-foreground">
                    {projectStatus === 'active' ? 'Your project is currently active.' : 'Your project is paused.'}
                  </p>
                </div>
                <Select value={projectStatus} onValueChange={(v: 'active' | 'inactive') => setProjectStatus(v)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Paused
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Visibility */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Visibility</p>
                  <p className="text-[10px] text-muted-foreground">Control who can view this project.</p>
                </div>
                <Select value={projectVisibility} onValueChange={(v: 'public' | 'private') => setProjectVisibility(v)}>
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Project Analytics */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Project analytics</h2>
              <p className="text-[10px] text-muted-foreground">View usage and request statistics.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Analytics</p>
                  <p className="text-[10px] text-muted-foreground">See requests, costs, and latency metrics.</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link href={`/dashboard/organizations/${orgSlug}/projects/${projectSlug}/analytics`}>
                    View
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          {/* Delete Project */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Delete Project</h2>
              <p className="text-[10px] text-muted-foreground">Permanently remove your project and its data.</p>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">Deleting this project will remove all data.</p>
                      <p className="text-[10px] text-muted-foreground">
                        This includes API keys, logs, and analytics. This action cannot be undone.
                      </p>
                    </div>
                    <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-7 text-xs gap-1.5">
                          <Trash2 className="h-3 w-3" />
                          Delete project
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Delete Project</DialogTitle>
                          <DialogDescription className="text-xs">
                            Type <span className="font-mono font-medium text-foreground">{project.name}</span> to confirm.
                          </DialogDescription>
                        </DialogHeader>
                        <Input
                          placeholder={project.name}
                          value={deleteConfirmName}
                          onChange={(e) => setDeleteConfirmName(e.target.value)}
                          className="h-9"
                        />
                        <DialogFooter>
                          <Button variant="ghost" size="sm" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteProject}
                            disabled={deleteConfirmName !== project.name}
                          >
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </TabsContent>

        {/* INFRASTRUCTURE TAB */}
        <TabsContent value="infrastructure" className="space-y-6">
          {/* Proxy Instance */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Proxy instance</h2>
              <p className="text-[10px] text-muted-foreground">Your primary proxy endpoint and region.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Globe className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">Primary Proxy</p>
                    <p className="text-[10px] text-muted-foreground">US East (Virginia) • Edge</p>
                  </div>
                </div>
                <span className="text-lg">🇺🇸</span>
              </div>
            </div>
          </section>

          {/* Service Versions + Provider Connections Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Service Versions */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Service versions</h2>
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="divide-y divide-border/40">
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[10px] text-muted-foreground">SDK Version</span>
                    <span className="text-[10px] font-mono">1.2.0</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[10px] text-muted-foreground">API Version</span>
                    <span className="text-[10px] font-mono">v1</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[10px] text-muted-foreground">Proxy Version</span>
                    <span className="text-[10px] font-mono">2.1.4</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Provider Connections */}
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Provider connections</h2>
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="divide-y divide-border/40">
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px]">OpenAI</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">45ms</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[10px]">Anthropic</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">52ms</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span className="text-[10px]">Google AI</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">120ms</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Rate Limits */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Rate limits</h2>
              <p className="text-[10px] text-muted-foreground">Current usage against your plan limits.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="divide-y divide-border/40">
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Requests / min</span>
                    <span>450 / 1,000</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Tokens / day</span>
                    <span>1.2M / 5M</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '24%' }} />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Concurrent requests</span>
                    <span>8 / 50</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '16%' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Request Configuration */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Request configuration</h2>
              <p className="text-[10px] text-muted-foreground">Default settings for request handling.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="divide-y divide-border/40">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px]">Request timeout</span>
                  </div>
                  <span className="text-[10px] font-mono">30s</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px]">Max retries</span>
                  </div>
                  <span className="text-[10px] font-mono">3</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px]">Fallback provider</span>
                  </div>
                  <span className="text-[10px] font-mono">Anthropic</span>
                </div>
              </div>
            </div>
          </section>

          {/* Webhooks */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Webhooks</h2>
              <p className="text-[10px] text-muted-foreground">HTTP callbacks for request events.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">No webhooks configured</p>
                    <p className="text-[10px] text-muted-foreground">Add webhooks to receive real-time events.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Add webhook
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
