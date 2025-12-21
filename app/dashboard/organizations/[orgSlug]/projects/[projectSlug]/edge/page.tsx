"use client";

import React, { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VercelLogo, SupabaseLogo } from "@/components/icons/BrandIcons";
import { Cloudflare, Aws, Azure, Google } from "@lobehub/icons";

interface PageProps {
    params: Promise<{ orgSlug: string; projectSlug: string }>;
}

interface Integration {
    id: string;
    provider: string;
    status: "connected" | "pending" | "error";
    external_id?: string;
    created_at: string;
}

// Hook to fetch project ID from slugs
function useProjectId(orgSlug: string, projectSlug: string) {
    return useQuery({
        queryKey: ["projectId", orgSlug, projectSlug],
        queryFn: async () => {
            const { data: org } = await supabase
                .from("organizations")
                .select("id")
                .eq("slug", orgSlug)
                .single();

            if (!org) throw new Error("Organization not found");

            const { data: project } = await supabase
                .from("projects")
                .select("id, name")
                .eq("slug", projectSlug)
                .eq("organization_id", org.id)
                .single();

            if (!project) throw new Error("Project not found");

            return { projectId: project.id, projectName: project.name };
        },
        staleTime: 5 * 60 * 1000,
    });
}

// Hook to fetch edge integrations (will use API when table exists)
function useEdgeIntegrations(projectId: string | undefined) {
    return useQuery({
        queryKey: ["edgeIntegrations", projectId],
        queryFn: async () => {
            // For now, return empty array until table is created
            // When the table exists:
            // const { data } = await supabase
            //     .from("edge_integrations")
            //     .select("*")
            //     .eq("project_id", projectId);
            // return data as Integration[];
            return [] as Integration[];
        },
        enabled: !!projectId,
        staleTime: 30 * 1000,
    });
}

export default function EdgePage({ params }: PageProps) {
    const { orgSlug, projectSlug } = use(params);

    const { data: projectData, isLoading: projectLoading } = useProjectId(orgSlug, projectSlug);
    const { data: integrations } = useEdgeIntegrations(projectData?.projectId);

    const getIntegrationStatus = (provider: string) => {
        const integration = integrations?.find(i => i.provider === provider);
        return integration?.status || null;
    };

    if (projectLoading) {
        return (
            <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-96" />
                <div className="grid gap-4 md:grid-cols-2">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto px-6 py-8 space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-xl font-semibold tracking-tight">Edge Integrations</h1>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full border-amber-500/50 text-amber-500">
                        Beta
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl">
                    Connect Cencori to your deployment platforms for automatic AI request protection.
                </p>
            </div>

            {/* Integration Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Vercel Integration */}
                <IntegrationCard
                    icon={VercelLogo}
                    name="Vercel"
                    description="Protect AI requests in Vercel Edge Functions and Middleware."
                    status={getIntegrationStatus("vercel")}
                    features={[
                        "One-click marketplace install",
                        "Automatic environment variables",
                        "Preview deploy protection",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("Vercel integration coming soon!")}
                />

                {/* Supabase Integration */}
                <IntegrationCard
                    icon={SupabaseLogo}
                    name="Supabase"
                    description="Route Supabase Edge Functions through Cencori."
                    status={getIntegrationStatus("supabase")}
                    features={[
                        "Edge function middleware",
                        "Automatic request filtering",
                        "Real-time security events",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("Supabase integration coming soon!")}
                />

                {/* Cloudflare Integration */}
                <IntegrationCard
                    icon={() => <Cloudflare.Color size={20} />}
                    name="Cloudflare"
                    description="Protect AI requests in Cloudflare Workers."
                    status={getIntegrationStatus("cloudflare")}
                    features={[
                        "Workers integration",
                        "Global edge network",
                        "AI Gateway support",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("Cloudflare integration coming soon!")}
                />

                {/* AWS Integration */}
                <IntegrationCard
                    icon={() => <Aws.Color size={20} />}
                    name="AWS"
                    description="Protect AI requests in AWS Lambda and Bedrock."
                    status={getIntegrationStatus("aws")}
                    features={[
                        "Lambda middleware",
                        "Bedrock integration",
                        "API Gateway support",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("AWS integration coming soon!")}
                />

                {/* Azure Integration */}
                <IntegrationCard
                    icon={() => <Azure.Color size={20} />}
                    name="Azure"
                    description="Protect AI requests in Azure Functions and OpenAI Service."
                    status={getIntegrationStatus("azure")}
                    features={[
                        "Azure Functions middleware",
                        "OpenAI Service integration",
                        "App Service support",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("Azure integration coming soon!")}
                />

                {/* Google Cloud Integration */}
                <IntegrationCard
                    icon={() => <Google.Color size={20} />}
                    name="Google Cloud"
                    description="Protect AI requests in Cloud Functions and Vertex AI."
                    status={getIntegrationStatus("gcp")}
                    features={[
                        "Cloud Functions middleware",
                        "Vertex AI integration",
                        "Cloud Run support",
                    ]}
                    comingSoon
                    onConnect={() => toast.info("Google Cloud integration coming soon!")}
                />
            </div>
        </div>
    );
}

// Integration Card Component
function IntegrationCard({
    icon: Icon,
    name,
    description,
    status,
    features,
    comingSoon,
    onConnect,
    onDisconnect,
}: {
    icon: React.ComponentType<{ className?: string }>;
    name: string;
    description: string;
    status: "connected" | "pending" | "error" | null;
    features: string[];
    comingSoon?: boolean;
    onConnect: () => void;
    onDisconnect?: () => void;
}) {
    return (
        <div className="rounded-xl border border-border/50 bg-card p-5 flex flex-col">
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold">{name}</h3>
                            {comingSoon && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full border-amber-500/50 text-amber-500">
                                    Soon
                                </Badge>
                            )}
                        </div>
                        {status && (
                            <StatusBadge status={status} />
                        )}
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground mb-4 flex-1">
                {description}
            </p>

            <ul className="space-y-1.5 mb-4">
                {features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Check className="w-3 h-3 text-emerald-500" />
                        {feature}
                    </li>
                ))}
            </ul>

            <div className="flex gap-2 mt-auto">
                {status === "connected" ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-full"
                        onClick={onDisconnect}
                    >
                        <Unlink className="w-3 h-3 mr-1.5" />
                        Disconnect
                    </Button>
                ) : (
                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-8 text-xs rounded-full"
                        onClick={onConnect}
                        disabled={comingSoon}
                    >
                        <Link2 className="w-3 h-3 mr-1.5" />
                        {comingSoon ? "Coming Soon" : "Connect"}
                    </Button>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: "connected" | "pending" | "error" }) {
    const config = {
        connected: { label: "Connected", className: "text-emerald-500 bg-emerald-500/10" },
        pending: { label: "Pending", className: "text-amber-500 bg-amber-500/10" },
        error: { label: "Error", className: "text-red-500 bg-red-500/10" },
    };

    return (
        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", config[status].className)}>
            {config[status].label}
        </span>
    );
}
