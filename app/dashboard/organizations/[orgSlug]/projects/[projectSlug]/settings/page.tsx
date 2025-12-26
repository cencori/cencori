"use client";

import React, { useState, use } from "react";
import { notFound, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { GeoMap } from "@/components/dashboard/GeoMap";
import { RegionalCharts } from "@/components/dashboard/RegionalCharts";
import { GeoAnalyticsSection } from "@/components/dashboard/GeoAnalyticsSection";
import { GenerateKeyDialog } from "@/components/api-keys/GenerateKeyDialog";

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

interface PageProps {
  params: Promise<{ orgSlug: string; projectSlug: string }>;
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
  'americas': { name: 'Americas (Auto)', flag: '🌎' },
  'europe': { name: 'Europe (Auto)', flag: '🌍' },
  'asia-pacific': { name: 'Asia-Pacific (Auto)', flag: '🌏' },
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
  'default': { name: 'Americas (Auto)', flag: '🌎' },
};

// Hook to fetch project details with caching
function useProjectDetails(orgSlug: string, projectSlug: string) {
  return useQuery({
    queryKey: ["projectDetails", orgSlug, projectSlug],
    queryFn: async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Not authenticated");

      const { data: organization } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .single();

      if (!organization) throw new Error("Organization not found");

      const { data: projectData } = await supabase
        .from("projects")
        .select("id, name, slug, description, organization_id, visibility, status, region, request_timeout_seconds, max_retries, fallback_provider")
        .eq("slug", projectSlug)
        .eq("organization_id", organization.id)
        .single();

      if (!projectData) throw new Error("Project not found");
      return projectData as ProjectData;
    },
    staleTime: 60 * 1000,
  });
}

export default function ProjectSettingsPage({ params }: PageProps) {
  const { orgSlug, projectSlug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { updateProject: updateProjectContext } = useOrganizationProject();

  // Local form state
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [projectVisibility, setProjectVisibility] = useState<'public' | 'private'>('private');
  const [projectStatus, setProjectStatus] = useState<'active' | 'inactive'>('active');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Webhook dialog state
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>(['request.completed']);

  // API Keys state
  const [showCreateKeyDialog, setShowCreateKeyDialog] = useState(false);
  const [createKeyType, setCreateKeyType] = useState<'secret' | 'publishable'>('secret');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // API Key interface
  interface ApiKeyData {
    id: string;
    name: string;
    key_prefix: string;
    key_type?: 'secret' | 'publishable';
    allowed_domains?: string[] | null;
    created_at: string;
  }

  // Fetch project with caching - INSTANT ON REVISIT!
  const { data: project, isLoading: projectLoading, error } = useProjectDetails(orgSlug, projectSlug);

  // Sync form state when project loads
  React.useEffect(() => {
    if (project) {
      setProjectName(project.name);
      setProjectDescription(project.description || "");
      setProjectVisibility(project.visibility || 'private');
      setProjectStatus(project.status || 'active');
    }
  }, [project]);

  // Fetch webhooks with caching
  const { data: webhooks = [] } = useQuery<WebhookData[]>({
    queryKey: ["webhooks", project?.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project!.id}/webhooks`);
      if (!response.ok) throw new Error("Failed to fetch webhooks");
      const data = await response.json();
      return data.webhooks || [];
    },
    enabled: !!project?.id,
    staleTime: 30 * 1000,
  });

  // Fetch provider health with caching
  const { data: providers = [], isLoading: providersLoading, refetch: refetchProviders } = useQuery<ProviderHealth[]>({
    queryKey: ["providerHealth"],
    queryFn: async () => {
      const response = await fetch('/api/providers/health');
      if (!response.ok) throw new Error("Failed to fetch providers");
      const data = await response.json();
      return data.providers || [];
    },
    staleTime: 60 * 1000,
  });

  // Fetch API keys with caching
  const { data: apiKeys = [], refetch: refetchApiKeys } = useQuery<ApiKeyData[]>({
    queryKey: ["apiKeys", project?.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project!.id}/api-keys`);
      if (!response.ok) throw new Error("Failed to fetch API keys");
      const data = await response.json();
      return data.apiKeys || [];
    },
    enabled: !!project?.id,
    staleTime: 30 * 1000,
  });

  // Computed: split keys by type
  const secretKeys = apiKeys.filter((k: ApiKeyData) => !k.key_type || k.key_type === 'secret');
  const publishableKeys = apiKeys.filter((k: ApiKeyData) => k.key_type === 'publishable');

  // Format relative date helper
  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Copy API key handler
  const handleCopyKey = async (keyPrefix: string) => {
    await navigator.clipboard.writeText(keyPrefix);
    toast.success("Key prefix copied to clipboard");
  };

  // Revoke API key handler
  const handleRevokeKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke "${keyName}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/projects/${project!.id}/api-keys/${keyId}`, {
        method: "PATCH",
      });
      if (!response.ok) throw new Error("Failed to revoke key");
      toast.success("API key revoked");
      refetchApiKeys();
    } catch {
      toast.error("Failed to revoke API key");
    }
  };

  // Fetch service versions with caching
  const { data: versions } = useQuery<{ sdk: string; api: string; proxy: string }>({
    queryKey: ["serviceVersions"],
    queryFn: async () => {
      const response = await fetch('/api/versions');
      if (!response.ok) throw new Error("Failed to fetch versions");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // versions change rarely
  });

  // Fetch rate limits with caching
  const { data: rateLimits } = useQuery<RateLimitsData>({
    queryKey: ["rateLimits", project?.id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${project!.id}/rate-limits`);
      if (!response.ok) throw new Error("Failed to fetch rate limits");
      return response.json();
    },
    enabled: !!project?.id,
    staleTime: 30 * 1000,
  });

  // Create webhook mutation
  const createWebhookMutation = useMutation({
    mutationFn: async (data: { name: string; url: string; events: string[] }) => {
      const response = await fetch(`/api/projects/${project!.id}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create webhook');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", project?.id] });
      setShowWebhookDialog(false);
      setWebhookName('');
      setWebhookUrl('');
      setWebhookEvents(['request.completed']);
      toast.success('Webhook created!');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Delete webhook mutation
  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => {
      const response = await fetch(`/api/projects/${project!.id}/webhooks/${webhookId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete webhook');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", project?.id] });
      toast.success('Webhook deleted!');
    },
    onError: () => toast.error('Failed to delete webhook'),
  });

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
    if (!project) return;
    setIsSaving(true);
    try {
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
        queryClient.invalidateQueries({ queryKey: ["projectDetails", orgSlug, projectSlug] });
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
    if (!project || deleteConfirmName !== project.name) {
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

  if (projectLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-0.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex gap-4 border-b border-border/40 pb-2 mt-4">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="space-y-3 mt-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-[200px]" />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-sm text-red-500">{error?.message || "Project not found."}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">Configure general options and project lifecycle.</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="infrastructure">Infrastructure</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
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
                  onClick={() => refetchProviders()}
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
                      onClick={() => createWebhookMutation.mutate({ name: webhookName, url: webhookUrl, events: webhookEvents })}
                      disabled={createWebhookMutation.isPending || !webhookName || !webhookUrl}
                    >
                      {createWebhookMutation.isPending ? 'Creating...' : 'Create'}
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
                              onClick={() => deleteWebhookMutation.mutate(webhook.id)}
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

        {/* PROVIDERS TAB */}
        <TabsContent value="providers" className="space-y-6">
          {/* Default Provider & Model */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Default Provider</h2>
              <p className="text-xs text-muted-foreground">Select the default provider and model for requests without explicit model specification.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Default provider</p>
                  <p className="text-[10px] text-muted-foreground">Used when no provider is specified in API requests.</p>
                </div>
                <Select defaultValue="openai">
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai" className="text-xs">OpenAI</SelectItem>
                    <SelectItem value="anthropic" className="text-xs">Anthropic</SelectItem>
                    <SelectItem value="google" className="text-xs">Google AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Default model</p>
                  <p className="text-[10px] text-muted-foreground">Fallback model when not specified.</p>
                </div>
                <Select defaultValue="gpt-4o">
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o" className="text-xs">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini" className="text-xs">GPT-4o Mini</SelectItem>
                    <SelectItem value="claude-3-5-sonnet" className="text-xs">Claude 3.5 Sonnet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Rate Limiting */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Rate Limiting</h2>
              <p className="text-xs text-muted-foreground">Configure request limits enforced via your Cencori API key.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Requests per minute</p>
                  <p className="text-[10px] text-muted-foreground">Maximum API requests allowed per minute.</p>
                </div>
                <Input defaultValue="60" className="w-24 h-8 text-xs text-right" />
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Tokens per day</p>
                  <p className="text-[10px] text-muted-foreground">Daily token usage limit across all requests.</p>
                </div>
                <Input defaultValue="1000000" className="w-24 h-8 text-xs text-right" />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Concurrent requests</p>
                  <p className="text-[10px] text-muted-foreground">Max simultaneous requests allowed.</p>
                </div>
                <Input defaultValue="10" className="w-24 h-8 text-xs text-right" />
              </div>
            </div>
          </section>

          {/* Fallback Configuration */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Fallback Configuration</h2>
              <p className="text-xs text-muted-foreground">Configure automatic failover when primary provider is unavailable.</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Enable automatic fallback</p>
                  <p className="text-[10px] text-muted-foreground">Route to backup provider on failure.</p>
                </div>
                <Checkbox defaultChecked />
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Fallback provider</p>
                  <p className="text-[10px] text-muted-foreground">Used when primary fails.</p>
                </div>
                <Select defaultValue="anthropic">
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic" className="text-xs">Anthropic</SelectItem>
                    <SelectItem value="openai" className="text-xs">OpenAI</SelectItem>
                    <SelectItem value="google" className="text-xs">Google AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">Max retries before fallback</p>
                  <p className="text-[10px] text-muted-foreground">Attempts before switching provider.</p>
                </div>
                <Input defaultValue="3" className="w-24 h-8 text-xs text-right" />
              </div>
            </div>
          </section>

          {/* Geographic Usage */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Requests by Geography</h2>
              <p className="text-xs text-muted-foreground">Monitor API request distribution by country.</p>
            </div>
            <GeoAnalyticsSection projectId={project.id} />
          </section>
        </TabsContent>

        {/* API TAB */}
        <TabsContent value="api" className="space-y-8">
          {/* Publishable Keys Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Publishable keys</h2>
                <p className="text-xs text-muted-foreground">Safe for browser use. Requires domain whitelisting for security.</p>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setCreateKeyType('publishable');
                  setShowCreateKeyDialog(true);
                }}
              >
                <Plus className="h-3 w-3" />
                New publishable key
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-2 border-b border-border/40 bg-muted/30">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Name</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">API Key</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase sr-only">Actions</span>
              </div>
              {publishableKeys.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {publishableKeys.map((key) => (
                    <div key={key.id} className="grid grid-cols-[1fr_2fr_auto] gap-4 items-center px-4 py-3">
                      <div>
                        <p className="text-xs font-medium">{key.name}</p>
                        {key.allowed_domains && key.allowed_domains.length > 0 && (
                          <p className="text-[10px] text-muted-foreground">{key.allowed_domains.join(', ')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-secondary px-2.5 py-1 rounded truncate max-w-[280px]">
                          {key.key_prefix}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopyKey(key.key_prefix)}>
                          {copiedKeyId === key.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="text-xs text-red-600 cursor-pointer"
                            onClick={() => handleRevokeKey(key.id, key.name)}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Revoke key
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No publishable keys yet</p>
                </div>
              )}
              <div className="px-4 py-2 border-t border-border/40 bg-muted/20">
                <p className="text-[10px] text-muted-foreground">Publishable keys can be safely shared publicly</p>
              </div>
            </div>
          </section>

          {/* Secret Keys Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-medium">Secret keys</h2>
                <p className="text-xs text-muted-foreground">For server-side use only. Never expose in browser or client code.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  setCreateKeyType('secret');
                  setShowCreateKeyDialog(true);
                }}
              >
                <Plus className="h-3 w-3" />
                New secret key
              </Button>
            </div>
            <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
              <div className="grid grid-cols-[1fr_2fr_auto] gap-4 px-4 py-2 border-b border-border/40 bg-muted/30">
                <span className="text-[10px] font-medium text-muted-foreground uppercase">Name</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase">API Key</span>
                <span className="text-[10px] font-medium text-muted-foreground uppercase sr-only">Actions</span>
              </div>
              {secretKeys.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {secretKeys.map((key) => (
                    <div key={key.id} className="grid grid-cols-[1fr_2fr_auto] gap-4 items-center px-4 py-3">
                      <div>
                        <p className="text-xs font-medium">{key.name}</p>
                        <p className="text-[10px] text-muted-foreground">Created {formatRelativeDate(key.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-secondary px-2.5 py-1 rounded truncate max-w-[280px]">
                          {key.key_prefix}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleCopyKey(key.key_prefix)}>
                          {copiedKeyId === key.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="text-xs text-red-600 cursor-pointer"
                            onClick={() => handleRevokeKey(key.id, key.name)}
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Revoke key
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">No secret keys yet</p>
                </div>
              )}
            </div>
          </section>
        </TabsContent>

      </Tabs>

      {/* Create API Key Dialog */}
      {project && (
        <GenerateKeyDialog
          projectId={project.id}
          open={showCreateKeyDialog}
          onOpenChange={setShowCreateKeyDialog}
          onKeyGenerated={() => refetchApiKeys()}
          defaultKeyType={createKeyType}
        />
      )}
    </div>
  );
}
