"use client";

import React, { useEffect, useState } from "react";
import { notFound, useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, Globe, Clock, Webhook, Server, AlertTriangle, Plus, MoreHorizontal, RefreshCw } from "lucide-react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

interface ProjectData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organization_id: string;
  visibility: 'public' | 'private';
  status: 'active' | 'inactive';
  region?: string;
  request_timeout_seconds?: number;
  max_retries?: number;
  fallback_provider?: string | null;
}

interface WebhookData {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  last_triggered_at?: string;
  failure_count: number;
}

interface ProviderHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: number | null;
  error?: string;
}

interface RateLimitsData {
  tier: string;
  usage: {
    requestsPerMinute: { used: number; limit: number; percentage: number };
    tokensPerDay: { used: number; limit: number; percentage: number };
    concurrentRequests: { used: number; limit: number; percentage: number };
  };
}

const WEBHOOK_EVENTS = [
  { value: 'request.completed', label: 'Request Completed' },
  { value: 'request.failed', label: 'Request Failed' },
  { value: 'security.violation', label: 'Security Violation' },
  { value: 'rate_limit.exceeded', label: 'Rate Limit Exceeded' },
  { value: 'cost.threshold', label: 'Cost Threshold Reached' },
  { value: 'model.fallback', label: 'Model Fallback Triggered' },
];

const REGION_MAP: Record<string, { name: string; flag: string }> = {
  // General regions (auto-routing)
  'americas': { name: 'Americas (Auto)', flag: '🌎' },
  'europe': { name: 'Europe (Auto)', flag: '🌍' },
  'asia-pacific': { name: 'Asia-Pacific (Auto)', flag: '🌏' },
  // Specific regions
  'us-east-1': { name: 'US East (N. Virginia)', flag: '🇺🇸' },
  'us-west-1': { name: 'US West (N. California)', flag: '🇺🇸' },
  'us-west-2': { name: 'US West (Oregon)', flag: '🇺🇸' },
  'ca-central-1': { name: 'Canada (Central)', flag: '🇨🇦' },
  'eu-west-1': { name: 'EU West (Ireland)', flag: '🇮🇪' },
  'eu-central-1': { name: 'EU Central (Frankfurt)', flag: '🇩🇪' },
  'ap-southeast-1': { name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  'ap-northeast-1': { name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' },
  'ap-south-1': { name: 'Asia Pacific (Mumbai)', flag: '🇮🇳' },
  'sa-east-1': { name: 'South America (São Paulo)', flag: '🇧🇷' },
  'me-south-1': { name: 'Middle East (Bahrain)', flag: '🇧🇭' },
  'af-south-1': { name: 'Africa (Cape Town)', flag: '🇿🇦' },
  // Default fallback
  'default': { name: 'Americas (Auto)', flag: '🌎' },
};

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

  // Infrastructure state
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [versions, setVersions] = useState<{ sdk: string; api: string; proxy: string } | null>(null);
  const [rateLimits, setRateLimits] = useState<RateLimitsData | null>(null);

  // Webhook dialog state
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['request.completed']);
  const [creatingWebhook, setCreatingWebhook] = useState(false);

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
          .select("id, name, slug, description, organization_id, visibility, status, region, request_timeout_seconds, max_retries, fallback_provider")
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

        // Fetch webhooks for this project
        fetchWebhooks(projectData.id);
        // Fetch provider health
        fetchProviders();
        // Fetch service versions
        fetchVersions();
        // Fetch rate limits
        fetchRateLimits(projectData.id);
      } catch {
        setError("An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectDetails();
  }, [orgSlug, projectSlug]);

  // Fetch webhooks for the project
  const fetchWebhooks = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/webhooks`);
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks || []);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    }
  };

  // Fetch provider health status
  const fetchProviders = async () => {
    setProvidersLoading(true);
    try {
      const response = await fetch('/api/providers/health');
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch provider health:', err);
    } finally {
      setProvidersLoading(false);
    }
  };

  // Fetch service versions
  const fetchVersions = async () => {
    try {
      const response = await fetch('/api/versions');
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  };

  // Fetch rate limits for the project
  const fetchRateLimits = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/rate-limits`);
      if (response.ok) {
        const data = await response.json();
        setRateLimits(data);
      }
    } catch (err) {
      console.error('Failed to fetch rate limits:', err);
    }
  };

  // Create a new webhook
  const handleCreateWebhook = async () => {
    if (!project || !webhookName || !webhookUrl) {
      toast.error('Name and URL are required');
      return;
    }

    setCreatingWebhook(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: webhookName,
          url: webhookUrl,
          events: webhookEvents,
        }),
      });

      if (response.ok) {
        toast.success('Webhook created!');
        setShowWebhookDialog(false);
        setWebhookName('');
        setWebhookUrl('');
        setWebhookEvents(['request.completed']);
        fetchWebhooks(project.id);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Failed to create webhook');
      }
    } catch {
      toast.error('Failed to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  // Delete a webhook
  const handleDeleteWebhook = async (webhookId: string) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/projects/${project.id}/webhooks/${webhookId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Webhook deleted!');
        setWebhooks(prev => prev.filter(w => w.id !== webhookId));
      } else {
        toast.error('Failed to delete webhook');
      }
    } catch {
      toast.error('Failed to delete webhook');
    }
  };

  // Toggle webhook event selection
  const toggleWebhookEvent = (event: string) => {
    setWebhookEvents(prev =>
      prev.includes(event)
        ? prev.filter(e => e !== event)
        : [...prev, event]
    );
  };

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
      <div className="w-full px-8 py-6 space-y-6">
        {/* Header */}
        <div className="space-y-0.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-border/40 pb-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>

        {/* General Settings Section */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2 w-32" />
              </div>
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2 w-28" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-8 w-8" />
              </div>
            </div>
            <div className="flex justify-end px-4 py-2 bg-muted/20">
              <Skeleton className="h-7 w-14" />
            </div>
          </div>
        </div>

        {/* Project Status Section */}
        <div className="space-y-3">
          <div className="space-y-0.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-36" />
          </div>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <div className="space-y-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2 w-40" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2 w-36" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
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
    <div className="w-full px-8 py-6 space-y-6">
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
                    <p className="text-[10px] text-muted-foreground">
                      {REGION_MAP[project.region || 'default']?.name || 'US East (Virginia)'} • Edge
                    </p>
                  </div>
                </div>
                <span className="text-lg">{REGION_MAP[project.region || 'default']?.flag || '🇺🇸'}</span>
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
                    <span className="text-[10px] font-mono">{versions?.sdk || '—'}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[10px] text-muted-foreground">API Version</span>
                    <span className="text-[10px] font-mono">{versions?.api || '—'}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2">
                    <span className="text-[10px] text-muted-foreground">Proxy Version</span>
                    <span className="text-[10px] font-mono">{versions?.proxy || '—'}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Provider Connections */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">Provider connections</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={fetchProviders}
                  disabled={providersLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${providersLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
                <div className="divide-y divide-border/40">
                  {providersLoading && providers.length === 0 ? (
                    <>
                      <div className="flex items-center justify-between px-4 py-2">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <div className="flex items-center justify-between px-4 py-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <div className="flex items-center justify-between px-4 py-2">
                        <Skeleton className="h-3 w-18" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                    </>
                  ) : providers.length > 0 ? (
                    providers.map((provider) => (
                      <div key={provider.name} className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${provider.status === 'healthy' ? 'bg-emerald-500' :
                            provider.status === 'degraded' ? 'bg-amber-500' : 'bg-red-500'
                            }`} />
                          <span className="text-[10px]">{provider.name}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {provider.latency ? `${provider.latency}ms` : provider.error || 'N/A'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] text-muted-foreground">Click refresh to check providers</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Rate Limits */}
          <section className="space-y-3">
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium">Rate limits</h2>
              <p className="text-[10px] text-muted-foreground">Current usage against your plan limits{rateLimits?.tier ? ` (${rateLimits.tier} tier)` : ''}.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="divide-y divide-border/40">
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Requests / min</span>
                    <span>{rateLimits?.usage.requestsPerMinute.used.toLocaleString() || '—'} / {rateLimits?.usage.requestsPerMinute.limit.toLocaleString() || '—'}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(rateLimits?.usage.requestsPerMinute.percentage || 0) > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${rateLimits?.usage.requestsPerMinute.percentage || 0}%` }}
                    />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Tokens / day</span>
                    <span>{rateLimits?.usage.tokensPerDay.used.toLocaleString() || '—'} / {rateLimits?.usage.tokensPerDay.limit.toLocaleString() || '—'}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(rateLimits?.usage.tokensPerDay.percentage || 0) > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${rateLimits?.usage.tokensPerDay.percentage || 0}%` }}
                    />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-muted-foreground">Concurrent requests</span>
                    <span>{rateLimits?.usage.concurrentRequests.used || '—'} / {rateLimits?.usage.concurrentRequests.limit || '—'}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(rateLimits?.usage.concurrentRequests.percentage || 0) > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${rateLimits?.usage.concurrentRequests.percentage || 0}%` }}
                    />
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
                  <span className="text-[10px] font-mono">{project?.request_timeout_seconds || 30}s</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <ArrowPathIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px]">Max retries</span>
                  </div>
                  <span className="text-[10px] font-mono">{project?.max_retries ?? 3}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Server className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px]">Fallback provider</span>
                  </div>
                  <span className="text-[10px] font-mono">{project?.fallback_provider || 'None'}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Webhooks */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h2 className="text-sm font-medium">Webhooks</h2>
                <p className="text-[10px] text-muted-foreground">HTTP callbacks for request events.</p>
              </div>
              <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />
                    Add webhook
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Webhook</DialogTitle>
                    <DialogDescription className="text-xs">
                      Add a webhook to receive real-time event notifications.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label htmlFor="webhook-name" className="text-xs">Name</Label>
                      <Input
                        id="webhook-name"
                        placeholder="My Webhook"
                        value={webhookName}
                        onChange={(e) => setWebhookName(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhook-url" className="text-xs">Endpoint URL</Label>
                      <Input
                        id="webhook-url"
                        placeholder="https://your-server.com/webhook"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Events</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {WEBHOOK_EVENTS.map((event) => (
                          <div key={event.value} className="flex items-center gap-2">
                            <Checkbox
                              id={event.value}
                              checked={webhookEvents.includes(event.value)}
                              onCheckedChange={() => toggleWebhookEvent(event.value)}
                            />
                            <label htmlFor={event.value} className="text-[10px] cursor-pointer">
                              {event.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" size="sm" onClick={() => setShowWebhookDialog(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateWebhook}
                      disabled={creatingWebhook || !webhookName || !webhookUrl}
                    >
                      {creatingWebhook ? 'Creating...' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              {webhooks.length === 0 ? (
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Webhook className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium">No webhooks configured</p>
                      <p className="text-[10px] text-muted-foreground">Add webhooks to receive real-time events.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${webhook.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'
                          }`} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{webhook.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{webhook.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-500 text-xs"
                              onClick={() => handleDeleteWebhook(webhook.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
